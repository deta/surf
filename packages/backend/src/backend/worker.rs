use super::message::WorkerMessage;
use crate::store::{db::Database, models};
use crate::BackendResult;

use neon::{prelude::*, types::Deferred};
use serde::Serialize;
use std::sync::mpsc;

struct Worker {
    db: Database,
}

impl Worker {
    fn new() -> Self {
        println!("{:?}", std::env::current_dir().unwrap());
        Self {
            db: Database::new("./database.sqlite").unwrap(),
        }
    }

    pub fn print(&mut self, content: String) -> BackendResult<String> {
        println!("print: {}", content);
        Ok("ok".to_owned())
    }

    pub fn get_resource(&mut self, id: String) -> BackendResult<Option<models::Resource>> {
        self.db.get_resource(id)
    }

    pub fn create_resource(&mut self, resource: &models::Resource) -> BackendResult<()> {
        let mut tx = self.db.begin().unwrap();
        let result = Database::create_resource_tx(&mut tx, &resource)?;
        tx.commit()?;
        Ok(result)
    }
}

pub fn worker_entry_point(rx: mpsc::Receiver<WorkerMessage>, mut channel: Channel) {
    let mut worker = Worker::new();

    while let Ok(message) = rx.recv() {
        match message {
            WorkerMessage::Print(content, deferred) => {
                send_worker_response(&mut channel, deferred, worker.print(content))
            }
            WorkerMessage::GetResource(resource_id, deferred) => {
                send_worker_response(&mut channel, deferred, worker.get_resource(resource_id))
            }
            WorkerMessage::CreateResource(resource, deferred) => {
                send_worker_response(&mut channel, deferred, worker.create_resource(&resource))
            }
        }
    }
}

fn send_worker_response<T: Serialize + Send + 'static>(
    channel: &mut Channel,
    deferred: Deferred,
    result: BackendResult<T>,
) {
    channel.send(move |mut cx| {
        let serialized_response = match &result {
            Ok(value) => serde_json::to_string(value),
            Err(e) => serde_json::to_string(&e.to_string()),
        };

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
