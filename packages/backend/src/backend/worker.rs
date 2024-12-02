use super::{
    message::{
        AIMessage, EventBusMessage, ProcessorMessage, TunnelMessage, TunnelOneshot, WorkerMessage,
    },
    tunnel::SurfBackendHealth,
};
use crate::{ai::ai::AI, backend::handlers::*, store::db::Database, BackendError, BackendResult};

use crossbeam_channel as crossbeam;
use neon::prelude::*;
use serde::Serialize;
use std::{path::Path, sync::Arc};

pub struct Worker {
    pub db: Database,
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
}

impl Worker {
    fn new(
        app_path: String,
        backend_root_path: String,
        api_base: String,
        api_key: String,
        _local_ai_mode: bool,
        language_setting: String,
        tqueue_tx: crossbeam::Sender<ProcessorMessage>,
        aiqueue_tx: crossbeam::Sender<AIMessage>,
        channel: Channel,
        event_bus_rx: Arc<Root<JsFunction>>,
        run_migrations: bool,
        surf_backend_health: SurfBackendHealth,
    ) -> Self {
        let db_path = Path::new(&backend_root_path)
            .join("surf-0-01.sqlite")
            .as_os_str()
            .to_string_lossy()
            .to_string();
        let resources_path = Path::new(&backend_root_path)
            .join("resources")
            .as_os_str()
            .to_string_lossy()
            .to_string();
        let local_ai_socket_path = Path::new(&backend_root_path)
            .join("sffs-ai.sock")
            .as_os_str()
            .to_string_lossy()
            .to_string();

        Self {
            db: Database::new(&db_path, run_migrations).unwrap(),
            ai: AI::new(api_base, api_key, local_ai_socket_path).unwrap(),
            channel,
            event_bus_rx,
            tqueue_tx,
            aiqueue_tx,
            app_path,
            backend_root_path,
            resources_path,
            language_setting,
            async_runtime: tokio::runtime::Runtime::new().unwrap(),
            surf_backend_health,
        }
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
            if let Err(e) = event_bus_rx.call(&mut cx, this, &[string]) {
                tracing::debug!("event bus callback failed: {e:?}");
            }

            Ok(())
        });
    }
}

pub fn worker_thread_entry_point(
    worker_rx: crossbeam::Receiver<TunnelMessage>,
    tqueue_tx: crossbeam::Sender<ProcessorMessage>,
    aiqueue_tx: crossbeam::Sender<AIMessage>,
    channel: Channel,
    event_bus_rx: Arc<Root<JsFunction>>,
    app_path: String,
    backend_root_path: String,
    api_base: String,
    api_key: String,
    local_ai_mode: bool,
    language_setting: String,
    run_migrations: bool,
    surf_backend_health: SurfBackendHealth,
) {
    let mut worker = Worker::new(
        app_path,
        backend_root_path,
        api_base,
        api_key,
        local_ai_mode,
        language_setting,
        tqueue_tx,
        aiqueue_tx,
        channel,
        event_bus_rx,
        run_migrations,
        surf_backend_health,
    );

    while let Ok(TunnelMessage(message, oneshot)) = worker_rx.recv() {
        match message {
            WorkerMessage::CardMessage(_message) => {
                // handle_card_message(&mut worker, oneshot, message)
            }
            WorkerMessage::HorizonMessage(_message) => {
                // handle_horizon_message(&mut worker, oneshot, message)
            }
            WorkerMessage::UserdataMessage(_message) => {
                // handle_userdata_message(&mut worker, oneshot, message)
            }
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
