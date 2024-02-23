use super::message::WorkerMessage;
use crate::store::{db::Database, models::*};
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

    pub fn get_resource(&mut self, id: String) -> BackendResult<Option<Resource>> {
        self.db.get_resource(id)
    }

    pub fn create_resource(
        &mut self,
        resource_type: String,
        tags: Option<Vec<ResourceTag>>,
        metadata: Option<ResourceMetadata>,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;

        let resource_id = uuid::Uuid::new_v4().to_string();
        let current_time = format!("{:?}", std::time::SystemTime::now());
        let resource = Resource {
            id: resource_id.clone(),
            resource_path: format!("SOME_ROOT_PATH/{resource_id}"),
            resource_type,
            created_at: current_time.clone(),
            updated_at: current_time,
            deleted: 0,
        };
        Database::create_resource_tx(&mut tx, &resource)?;

        if let Some(mut metadata) = metadata {
            metadata.id = uuid::Uuid::new_v4().to_string();
            metadata.resource_id = resource.id.clone();

            Database::create_resource_metadata_tx(&mut tx, &metadata)?;
        }

        if let Some(mut tags) = tags {
            for tag in &mut tags {
                tag.id = uuid::Uuid::new_v4().to_string();
                tag.resource_id = resource.id.clone();

                Database::create_resource_tag_tx(&mut tx, &tag)?;
            }
        }

        Ok(tx.commit()?)
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
            WorkerMessage::CreateResource {
                resource_type,
                resource_tags,
                resource_metadata,
                deferred,
            } => {
                let result =
                    worker.create_resource(resource_type, resource_tags, resource_metadata);
                send_worker_response(&mut channel, deferred, result)
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
