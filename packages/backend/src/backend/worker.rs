use super::message::{AIMessage, ProcessorMessage, TunnelMessage, TunnelOneshot};
use crate::{
    ai::ai::AI,
    backend::{handlers::*, message::WorkerMessage},
    store::db::Database,
    BackendError, BackendResult,
};

use crossbeam_channel as crossbeam;
use neon::prelude::*;
use serde::Serialize;
use std::{path::Path, sync::mpsc};

pub struct Worker {
    pub db: Database,
    pub ai: AI,
    pub tqueue_tx: crossbeam::Sender<ProcessorMessage>,
    pub aiqueue_tx: crossbeam::Sender<AIMessage>,
    pub app_path: String,
    pub backend_root_path: String,
    pub resources_path: String,
    pub async_runtime: tokio::runtime::Runtime,
}

impl Worker {
    fn new(
        app_path: String,
        backend_root_path: String,
        openai_api_key: String,
        openai_api_endpoint: String,
        local_ai_mode: bool,
        tqueue_tx: crossbeam::Sender<ProcessorMessage>,
        aiqueue_tx: crossbeam::Sender<AIMessage>,
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
        let openai_api_endpoint = match openai_api_endpoint.is_empty() {
            true => None, // uses default if None
            false => Some(openai_api_endpoint),
        };

        Self {
            db: Database::new(&db_path, true).unwrap(),
            ai: AI::new(
                openai_api_key,
                local_ai_mode,
                local_ai_socket_path,
                openai_api_endpoint,
            )
            .unwrap(),
            tqueue_tx,
            aiqueue_tx,
            app_path,
            backend_root_path,
            resources_path,
            async_runtime: tokio::runtime::Runtime::new().unwrap(),
        }
    }
}

pub fn worker_thread_entry_point(
    worker_rx: mpsc::Receiver<TunnelMessage>,
    tqueue_tx: crossbeam::Sender<ProcessorMessage>,
    aiqueue_tx: crossbeam::Sender<AIMessage>,
    mut channel: Channel,
    app_path: String,
    backend_root_path: String,
    openai_api_key: String,
    openai_api_endpoint: String,
    local_ai_mode: bool,
) {
    let mut worker = Worker::new(
        app_path,
        backend_root_path,
        openai_api_key,
        openai_api_endpoint,
        local_ai_mode,
        tqueue_tx,
        aiqueue_tx,
    );

    while let Ok(TunnelMessage(message, oneshot)) = worker_rx.recv() {
        match message {
            WorkerMessage::MiscMessage(message) => {
                handle_misc_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::CardMessage(message) => {
                handle_card_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::HistoryMessage(message) => {
                handle_history_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::HorizonMessage(message) => {
                handle_horizon_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::ResourceMessage(message) => {
                handle_resource_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::ResourceTagMessage(message) => {
                handle_resource_tag_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::UserdataMessage(message) => {
                handle_userdata_message(&mut worker, &mut channel, oneshot, message)
            }
            WorkerMessage::SpaceMessage(message) => {
                handle_space_message(&mut worker, &mut channel, oneshot, message)
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

    let serialized_response = match &result {
        Ok(value) => serde_json::to_string(value),
        Err(e) => serde_json::to_string(&e.to_string()),
    };

    match oneshot {
        TunnelOneshot::Rust(tx) => {
            let response =
                serialized_response.map_err(|e| BackendError::GenericError(e.to_string()));
            let _ = tx
                .send(response)
                .map_err(|e| eprintln!("oneshot receiver is dropped: {e}"));
        }
        TunnelOneshot::Javascript(deferred) => {
            channel.send(move |mut cx| {
                match serialized_response {
                    Ok(response) => {
                        let resp = cx.string(&response);
                        if result.is_ok() {
                            deferred.resolve(&mut cx, resp);
                        } else {
                            deferred.reject(&mut cx, resp);
                        }
                    }
                    Err(serialize_error) => {
                        let error_message =
                            cx.string(format!("Failed to serialize response: {}", serialize_error));
                        deferred.reject(&mut cx, error_message);
                    }
                }
                Ok(())
            });
        }
    }
}
