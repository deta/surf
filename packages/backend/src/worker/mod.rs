pub mod handlers;
pub mod processor;
pub mod tunnel;

const _MODULE_PREFIX: &str = "backend";

use crate::{
    ai::AI,
    api::message::{
        AIMessage, EventBusMessage, ProcessorMessage, TunnelMessage, TunnelOneshot, WorkerMessage,
    },
    store::{db::Database, kv::KeyValueStore, models::current_time},
    BackendError, BackendResult,
};
use handlers::*;
use tunnel::SurfBackendHealth;

use chrono::{DateTime, Utc};
use crossbeam_channel as crossbeam;
use neon::prelude::*;
use serde::Serialize;
use std::{path::Path, sync::Arc};

pub struct PathConfig {
    pub app_path: String,
    pub backend_root_path: String,
}

impl PathConfig {
    pub fn new(app_path: String, backend_root_path: String) -> Self {
        Self {
            app_path,
            backend_root_path,
        }
    }

    pub fn resources_path(&self) -> String {
        Path::new(&self.backend_root_path)
            .join("resources")
            .as_os_str()
            .to_string_lossy()
            .to_string()
    }

    pub fn db_path(&self) -> String {
        Path::new(&self.backend_root_path)
            .join("surf-0-01.sqlite")
            .as_os_str()
            .to_string_lossy()
            .to_string()
    }

    pub fn kv_db_path(&self) -> String {
        Path::new(&self.backend_root_path)
            .join("kv-0-01.sqlite")
            .as_os_str()
            .to_string_lossy()
            .to_string()
    }

    pub fn local_ai_socket_path(&self) -> String {
        Path::new(&self.backend_root_path)
            .join("sffs-ai.sock")
            .as_os_str()
            .to_string_lossy()
            .to_string()
    }
}

pub struct AIConfig {
    pub local_ai_mode: bool,
}

impl AIConfig {
    pub fn new(local_ai_mode: bool) -> Self {
        Self { local_ai_mode }
    }
}

pub struct ChannelConfig {
    pub tqueue_tx: crossbeam::Sender<ProcessorMessage>,
    pub aiqueue_tx: crossbeam::Sender<AIMessage>,
    pub channel: Channel,
    pub event_bus_rx: Arc<Root<JsFunction>>,
}

pub struct WorkerConfig {
    pub path_config: PathConfig,
    pub ai_config: AIConfig,
    pub channel_config: ChannelConfig,
    pub language_setting: String,
    pub run_migrations: bool,
    pub surf_backend_health: SurfBackendHealth,
}

pub struct Worker {
    pub db: Database,
    pub kv: KeyValueStore,
    pub ai: AI,
    pub channel: Channel,
    pub event_bus_rx: Arc<Root<JsFunction>>,
    pub tqueue_tx: crossbeam::Sender<ProcessorMessage>,
    pub aiqueue_tx: crossbeam::Sender<AIMessage>,
    pub app_path: String,
    pub backend_root_path: String,
    pub resources_path: String,
    pub language_setting: String,
    pub async_runtime: tokio::runtime::Runtime,
    pub surf_backend_health: SurfBackendHealth,
    pub created_at: DateTime<Utc>,
}

impl Worker {
    fn new(config: WorkerConfig) -> BackendResult<Self> {
        let db_path = config.path_config.db_path();
        let kv_db_path = config.path_config.kv_db_path();
        let resources_path = config.path_config.resources_path();
        let local_ai_socket_path = config.path_config.local_ai_socket_path();

        Ok(Self {
            db: Database::new(&db_path, config.run_migrations)?,
            kv: KeyValueStore::new(&kv_db_path)?,
            ai: AI::new(local_ai_socket_path)?,
            channel: config.channel_config.channel,
            event_bus_rx: config.channel_config.event_bus_rx,
            tqueue_tx: config.channel_config.tqueue_tx,
            aiqueue_tx: config.channel_config.aiqueue_tx,
            app_path: config.path_config.app_path.clone(),
            backend_root_path: config.path_config.backend_root_path.clone(),
            resources_path,
            language_setting: config.language_setting,
            async_runtime: tokio::runtime::Runtime::new()?,
            surf_backend_health: config.surf_backend_health,
            created_at: current_time(),
        })
    }

    pub fn send_event_bus_message(&mut self, message: EventBusMessage) {
        let message = match serde_json::to_string(&message) {
            Ok(result) => result,
            Err(e) => {
                tracing::debug!("serde to json string failed: {e:?}");
                return;
            }
        };
        let event_bus_rx = self.event_bus_rx.clone();

        self.channel.send(move |mut cx| {
            let this = cx.undefined();
            let event_bus_rx = event_bus_rx.to_inner(&mut cx);
            let string = cx.string(message).as_value(&mut cx);
            if let Err(e) = event_bus_rx.call(&mut cx, this, [string]) {
                tracing::debug!("event bus callback failed: {e:?}");
            }

            Ok(())
        });
    }
}

pub fn worker_thread_entry_point(
    worker_rx: crossbeam::Receiver<TunnelMessage>,
    config: WorkerConfig,
) {
    let mut worker = Worker::new(config).expect("Failed to initialize worker");

    while let Ok(TunnelMessage(message, oneshot)) = worker_rx.recv() {
        match message {
            WorkerMessage::MiscMessage(message) => {
                handle_misc_message(&mut worker, oneshot, message)
            }
            WorkerMessage::HistoryMessage(message) => {
                handle_history_message(&mut worker, oneshot, message)
            }
            WorkerMessage::ResourceMessage(message) => {
                handle_resource_message(&mut worker, oneshot, message)
            }
            WorkerMessage::ResourceTagMessage(message) => {
                handle_resource_tag_message(&mut worker, oneshot, message)
            }
            WorkerMessage::SpaceMessage(message) => {
                handle_space_message(&mut worker, oneshot, message)
            }
            WorkerMessage::KVStoreMessage(message) => {
                handle_kv_store_message(&mut worker, oneshot, message)
            }
            WorkerMessage::AppMessage(message) => handle_app_message(&mut worker, oneshot, message),
        }
    }
}

pub fn send_serialized_worker_response(
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    result: BackendResult<String>,
) {
    let oneshot = match oneshot {
        Some(oneshot) => oneshot,
        None => return,
    };

    match oneshot {
        TunnelOneshot::Rust(tx) => {
            let _ = tx
                .send(result)
                .map_err(|e| eprintln!("oneshot receiver is dropped: {e}"));
        }
        TunnelOneshot::Javascript(deferred) => {
            channel.send(move |mut cx| {
                match result {
                    Ok(resp) => {
                        let resp = cx.string(&resp);
                        deferred.resolve(&mut cx, resp);
                    }
                    Err(err) => {
                        let err = cx.string(err.to_string());
                        deferred.reject(&mut cx, err);
                    }
                }
                Ok(())
            });
        }
    }
}

pub fn send_worker_response<T: Serialize + Send + 'static>(
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    result: BackendResult<T>,
) {
    let oneshot = match oneshot {
        Some(oneshot) => oneshot,
        None => return,
    };

    match oneshot {
        TunnelOneshot::Rust(tx) => {
            let response = result.map(|t| serde_json::to_string(&t)).and_then(|inner| {
                inner.map_err(|e| {
                    BackendError::GenericError(format!("Failed to serialize response: {}", e))
                })
            });
            let _ = tx
                .send(response)
                .map_err(|e| eprintln!("oneshot receiver is dropped: {e}"));
        }
        TunnelOneshot::Javascript(deferred) => {
            let serialized_response = match result.as_ref() {
                Ok(data) => serde_json::to_string(data),
                Err(err) => Ok(err.to_string()),
            };
            channel.send(move |mut cx| {
                match serialized_response {
                    Ok(resp) => {
                        let resp = cx.string(&resp);
                        if result.is_ok() {
                            deferred.resolve(&mut cx, resp);
                        } else {
                            deferred.reject(&mut cx, resp);
                        }
                    }
                    Err(err) => {
                        let message = cx.string(format!("failed to serialize response: {}", err));
                        deferred.reject(&mut cx, message);
                    }
                }
                Ok(())
            });
        }
    }
}
