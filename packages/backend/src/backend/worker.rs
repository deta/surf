// TODO: proper error-handling at project level

use super::message::WorkerMessage;
use crate::store::{db::Database, models};
use crate::BackendResult;

use neon::{prelude::*, types::Deferred};
use serde::Serialize;
use std::error::Error;
use std::sync::mpsc;
use uuid::Uuid;

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

    // This is simply an example task that the worker is able
    // to handle. It accepts a string to print out to `stdout`
    // and returns back a string to the Javascript world.
    pub fn print_job(&mut self, content: String) -> BackendResult<String> {
        println!("print_job: {}", content);
        Ok("ok".to_owned())
    }

    pub fn get_resource(&mut self, id: String) -> String {
        let resource = self.db.get_resource(id);
        return format!("{:?}", resource);
    }

    pub fn create_resource(&mut self, resource: &models::Resource) -> Result<(), Box<dyn Error>> {
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
            WorkerMessage::GetResource(resource_id, deferred) => {
                let result = worker.get_resource(resource_id);
                channel.send(move |mut cx| {
                    let result = cx.string(result);
                    deferred.resolve(&mut cx, result);
                    Ok(())
                });
            }
            WorkerMessage::Print(content, deferred) => {
                // let the worker execute the print job
                // and then resolve the deferred promise
                // to the output of the task.
                let result = worker.print_job(content);
                send_worker_response(&mut channel, result, deferred)
            }
            WorkerMessage::CreateResource(resource, deferred) => {
                let result = worker.create_resource(&resource);
                channel.send(move |mut cx| {
                    let result = cx.string("ok");
                    deferred.resolve(&mut cx, result);
                    Ok(())
                });
            }
        }
    }
}

fn send_worker_response<T: Serialize + Send + 'static>(
    channel: &mut Channel,
    result: BackendResult<T>,
    deferred: Deferred,
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
