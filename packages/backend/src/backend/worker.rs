use super::message::WorkerMessage;
use super::tunnel::TunnelMessage;
use crate::store::db::{CompositeResource, SearchResult};
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

    pub fn create_resource(
        &mut self,
        resource_type: String,
        mut tags: Option<Vec<ResourceTag>>,
        mut metadata: Option<ResourceMetadata>,
    ) -> BackendResult<CompositeResource> {
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

        if let Some(metadata) = &mut metadata {
            metadata.id = uuid::Uuid::new_v4().to_string();
            metadata.resource_id = resource.id.clone();

            Database::create_resource_metadata_tx(&mut tx, &metadata)?;
        }

        if let Some(tags) = &mut tags {
            for tag in tags {
                tag.id = uuid::Uuid::new_v4().to_string();
                tag.resource_id = resource.id.clone();

                Database::create_resource_tag_tx(&mut tx, &tag)?;
            }
        }

        tx.commit()?;

        Ok(CompositeResource {
            resource,
            metadata,
            text_content: None,
            resource_tags: tags,
        })
    }

    pub fn read_resource(&mut self, id: String) -> BackendResult<Option<Resource>> {
        self.db.get_resource(&id)
    }

    pub fn delete_resource(&mut self, id: String) -> BackendResult<()> {
        self.db.update_resource_deleted(&id, 1)
    }

    pub fn recover_resource(&mut self, id: String) -> BackendResult<()> {
        self.db.update_resource_deleted(&id, 0)
    }

    pub fn search_resources(
        &mut self,
        query: String,
        tags: Option<Vec<ResourceTag>>,
    ) -> BackendResult<SearchResult> {
        self.db.search_resource_metadata(&query, tags)
    }
}

pub fn worker_entry_point(rx: mpsc::Receiver<TunnelMessage>, mut channel: Channel) {
    let mut worker = Worker::new();

    while let Ok(TunnelMessage(message, deferred)) = rx.recv() {
        match message {
            WorkerMessage::Print(content) => {
                send_worker_response(&mut channel, deferred, worker.print(content))
            }
            WorkerMessage::CreateResource {
                resource_type,
                resource_tags,
                resource_metadata,
            } => {
                let result =
                    worker.create_resource(resource_type, resource_tags, resource_metadata);
                send_worker_response(&mut channel, deferred, result)
            }
            WorkerMessage::ReadResource(resource_id) => {
                send_worker_response(&mut channel, deferred, worker.read_resource(resource_id))
            }
            WorkerMessage::DeleteResource(resource_id) => {
                send_worker_response(&mut channel, deferred, worker.delete_resource(resource_id))
            }
            WorkerMessage::RecoverResource(resource_id) => {
                send_worker_response(&mut channel, deferred, worker.recover_resource(resource_id))
            }
            WorkerMessage::SearchResources {
                query,
                resource_tags,
            } => send_worker_response(
                &mut channel,
                deferred,
                worker.search_resources(query, resource_tags),
            ),
        }
    }
}

fn send_worker_response<T: Serialize + Send + 'static>(
    channel: &mut Channel,
    deferred: Deferred,
    result: BackendResult<T>,
) {
    let serialized_response = match &result {
        Ok(value) => serde_json::to_string(value),
        Err(e) => serde_json::to_string(&e.to_string()),
    };

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
