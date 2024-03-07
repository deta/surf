use crate::{
    backend::{handlers::*, message::WorkerMessage, tunnel::TunnelMessage},
    store::db::Database,
    BackendError, BackendResult,
};
use neon::prelude::*;
use serde::Serialize;
use std::{path::Path, sync::mpsc};

use super::tunnel::TunnelOneshot;

pub struct Worker {
    pub db: Database,
    pub resources_path: String,
}

impl Worker {
    fn new(backend_root_path: String) -> Self {
        println!("data root path: {}", backend_root_path);
        let db_path = Path::new(&backend_root_path)
            .join("sffs.sqlite")
            .as_os_str()
            .to_string_lossy()
            .to_string();
        let resources_path = Path::new(&backend_root_path)
            .join("resources")
            .as_os_str()
            .to_string_lossy()
            .to_string();
        Self {
            db: Database::new(&db_path).unwrap(),
            resources_path,
        }
    }
}

pub fn worker_entry_point(
    rx: mpsc::Receiver<TunnelMessage>,
    mut channel: Channel,
    backend_root_path: String,
) {
    let mut worker = Worker::new(backend_root_path);

    while let Ok(TunnelMessage(message, oneshot)) = rx.recv() {
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
        }
    }
}

pub fn send_worker_response<T: Serialize + Send + 'static>(
    channel: &mut Channel,
    oneshot: TunnelOneshot,
    result: BackendResult<T>,
) {
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
