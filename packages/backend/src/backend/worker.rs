use super::message::WorkerMessage;
use super::tunnel::TunnelMessage;
use crate::store::{db::*, models::*};
use crate::{BackendError, BackendResult};
use std::str::FromStr;

use chrono::{DateTime, Utc};

use neon::{prelude::*, types::Deferred};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc;

struct Worker {
    db: Database,
    resources_path: String,
}

#[allow(dead_code)]
impl Worker {
    fn new(backend_root_path: String) -> Self {
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

    fn parse_datetime(datetime: &str) -> BackendResult<DateTime<chrono::Utc>> {
        Ok(parse_datetime_from_str(datetime)?)
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

        let resource_id = random_uuid();
        let ct = current_time();
        let resource = Resource {
            id: resource_id.clone(),
            resource_path: Path::new(&self.resources_path)
                .join(resource_id)
                .as_os_str()
                .to_string_lossy()
                .to_string(),
            resource_type,
            created_at: ct.clone(),
            updated_at: ct,
            deleted: 0,
        };
        Database::create_resource_tx(&mut tx, &resource)?;

        if let Some(metadata) = &mut metadata {
            metadata.id = random_uuid();
            metadata.resource_id = resource.id.clone();

            Database::create_resource_metadata_tx(&mut tx, &metadata)?;
        }

        if let Some(tags) = &mut tags {
            for tag in tags {
                let tag_name = InternalResourceTagNames::from_str(&tag.tag_name);
                match tag_name {
                    Ok(InternalResourceTagNames::Deleted) => {
                        return Err(BackendError::GenericError(
                            format!(
                                "Tag name {} is reserved",
                                InternalResourceTagNames::Deleted.to_string(),
                            )
                            .to_owned(),
                        ));
                    }
                    Ok(InternalResourceTagNames::Type) => {
                        return Err(BackendError::GenericError(
                            format!(
                                "Tag name {} is reserved",
                                InternalResourceTagNames::Type.to_string(),
                            )
                            .to_owned(),
                        ));
                    }
                    _ => {}
                }

                tag.id = random_uuid();
                tag.resource_id = resource.id.clone();

                Database::create_resource_tag_tx(&mut tx, &tag)?;
            }
        }
        Database::create_resource_tag_tx(&mut tx, &ResourceTag::new_deleted(&resource.id, false))?;
        Database::create_resource_tag_tx(
            &mut tx,
            &ResourceTag::new_type(&resource.id, &resource.resource_type),
        )?;
        tx.commit()?;

        Ok(CompositeResource {
            resource,
            metadata,
            text_content: None,
            resource_tags: tags,
        })
    }

    pub fn list_horizons(&mut self) -> BackendResult<Vec<Horizon>> {
        Ok(self.db.list_all_horizons()?)
    }

    pub fn create_horizon(&mut self, name: &str) -> BackendResult<Horizon> {
        let horizon_id = uuid::Uuid::new_v4().to_string();
        let current_time = Utc::now();
        let horizon = Horizon {
            id: horizon_id,
            horizon_name: name.to_owned(),
            icon_uri: "".to_owned(),
            created_at: current_time.clone(),
            updated_at: current_time,
        };
        let mut tx = self.db.begin()?;
        Database::create_horizon_tx(&mut tx, &horizon)?;
        tx.commit()?;
        Ok(horizon)
    }

    pub fn update_horizon_name(&mut self, id: &str, name: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_horizon_name_tx(&mut tx, id, name)?;
        tx.commit()?;
        Ok(())
    }

    pub fn remove_horizon(&mut self, id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_horizon_tx(&mut tx, id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn list_all_cards_in_horizon(&mut self, horizon_id: &str) -> BackendResult<Vec<Card>> {
        Ok(self.db.list_all_cards(horizon_id)?)
    }

    pub fn list_cards(
        &mut self,
        horizon_id: &str,
        limit: i64,
        offset: i64,
    ) -> BackendResult<PaginatedCards> {
        Ok(self.db.list_cards(horizon_id, limit, offset)?)
    }

    pub fn create_card(&mut self, mut card: Card) -> BackendResult<Card> {
        let mut tx = self.db.begin()?;
        Database::create_card_tx(&mut tx, &mut card)?;
        tx.commit()?;
        Ok(card)
    }

    pub fn get_card(&mut self, card_id: &str) -> BackendResult<Option<Card>> {
        Ok(self.db.get_card(card_id)?)
    }

    pub fn update_card_data(&mut self, card_id: &str, data: Vec<u8>) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_data_tx(&mut tx, card_id, data)?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_dimensions(
        &mut self,
        card_id: &str,
        position_x: i64,
        position_y: i64,
        width: i32,
        height: i32,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_dimensions_tx(
            &mut tx, card_id, position_x, position_y, width, height,
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_resource_id(
        &mut self,
        card_id: &str,
        resource_id: &str,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_resource_id_tx(&mut tx, card_id, resource_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_stacking_order_tx(
        &mut self,
        card_id: &str,
        stacking_order: &str,
    ) -> BackendResult<()> {
        let dt = Worker::parse_datetime(stacking_order)?;
        let mut tx = self.db.begin()?;
        Database::update_card_stacking_order_tx(&mut tx, card_id, dt)?;
        tx.commit()?;
        Ok(())
    }

    pub fn remove_card(&mut self, card_id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_card_tx(&mut tx, card_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn create_userdata(&mut self, user_id: &str) -> BackendResult<Userdata> {
        let userdata_id = uuid::Uuid::new_v4().to_string();
        let userdata = Userdata {
            id: userdata_id,
            user_id: user_id.to_owned(),
        };
        let mut tx = self.db.begin()?;
        Database::create_userdata_tx(&mut tx, &userdata)?;
        tx.commit()?;
        Ok(userdata)
    }

    pub fn get_userdata_by_user_id(&mut self, user_id: &str) -> BackendResult<Option<Userdata>> {
        Ok(self.db.get_userdata_by_user_id(user_id)?)
    }

    pub fn remove_userdata(&mut self, user_id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_userdata_tx(&mut tx, user_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn read_resource(&mut self, id: String) -> BackendResult<Option<CompositeResource>> {
        let resource = match self.db.get_resource(&id)? {
            Some(data) => data,
            None => return Ok(None),
        };
        let metadata = self.db.get_resource_metadata_by_resource_id(&resource.id)?;
        let resource_tags = self.db.list_resource_tags(&resource.id)?;
        let resource_tags = (!resource_tags.is_empty()).then_some(resource_tags);

        Ok(Some(CompositeResource {
            resource,
            metadata,
            text_content: None,
            resource_tags,
        }))
    }

    pub fn delete_resource(&mut self, id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_deleted_tx(&mut tx, &id, 1)?;
        Database::update_resource_tag_by_name_tx(&mut tx, &ResourceTag::new_deleted(&id, true))?;
        tx.commit()?;
        Ok(())
    }

    pub fn recover_resource(&mut self, id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_deleted_tx(&mut tx, &id, 1)?;
        Database::update_resource_tag_by_name_tx(&mut tx, &ResourceTag::new_deleted(&id, false))?;
        tx.commit()?;
        Ok(())
    }

    pub fn search_resources(
        &mut self,
        query: String,
        tags: Option<Vec<ResourceTag>>,
    ) -> BackendResult<SearchResult> {
        // TODO: handle deleted resources
        self.db.search_resources(&query, tags)
    }

    pub fn post_process_job(&mut self, resource_id: String) -> BackendResult<()> {
        let resource = self
            .db
            .get_resource(&resource_id)?
            // mb this should be a `DatabaseError`?
            .ok_or(BackendError::GenericError(
                "resource does not exist".to_owned(),
            ))?;

        // TODO: make use of strum(?) for this
        match resource.resource_type.as_str() {
            "text/space-notes" => {
                let html_data = std::fs::read_to_string(resource.resource_path)?;
                let mut output = String::new();
                let mut in_tag = false;

                for c in html_data.chars() {
                    match (in_tag, c) {
                        (true, '>') => in_tag = false,
                        (false, '<') => {
                            in_tag = true;
                            output.push(' ');
                        }
                        (false, _) => output.push(c),
                        _ => (),
                    }
                }

                let output = output
                    .chars()
                    .take(256 * 3)
                    .collect::<String>()
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");

                self.db.create_resource_text_content(&ResourceTextContent {
                    id: random_uuid(),
                    resource_id,
                    content: output,
                })
            }
            _ => Ok(()),
        }
    }
}

pub fn worker_entry_point(
    rx: mpsc::Receiver<TunnelMessage>,
    mut channel: Channel,
    backend_root_path: String,
) {
    let mut worker = Worker::new(backend_root_path);

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
            WorkerMessage::ListHorizons() => {
                send_worker_response(&mut channel, deferred, worker.list_horizons())
            }
            WorkerMessage::CreateHorizon(name) => {
                send_worker_response(&mut channel, deferred, worker.create_horizon(&name))
            }
            WorkerMessage::UpdateHorizonName(id, name) => send_worker_response(
                &mut channel,
                deferred,
                worker.update_horizon_name(&id, &name),
            ),
            WorkerMessage::RemoveHorizon(id) => {
                send_worker_response(&mut channel, deferred, worker.remove_horizon(&id))
            }
            WorkerMessage::ListCardsInHorizon(horizon_id) => send_worker_response(
                &mut channel,
                deferred,
                worker.list_all_cards_in_horizon(&horizon_id),
            ),
            WorkerMessage::GetCard(card_id) => {
                send_worker_response(&mut channel, deferred, worker.get_card(&card_id))
            }
            WorkerMessage::CreateCard(card) => {
                let result = worker.create_card(card);
                send_worker_response(&mut channel, deferred, result)
            }
            WorkerMessage::UpdateCardResourceID(card_id, resource_id) => send_worker_response(
                &mut channel,
                deferred,
                worker.update_card_resource_id(&card_id, &resource_id),
            ),
            WorkerMessage::UpdateCardData(card_id, data) => send_worker_response(
                &mut channel,
                deferred,
                worker.update_card_data(&card_id, data),
            ),
            WorkerMessage::UpdateCardDimensions(card_id, position_x, position_y, width, height) => {
                send_worker_response(
                    &mut channel,
                    deferred,
                    worker.update_card_dimensions(&card_id, position_x, position_y, width, height),
                )
            }
            WorkerMessage::UpdateCardStackingOrder(card_id, datetime) => send_worker_response(
                &mut channel,
                deferred,
                worker.update_card_stacking_order_tx(&card_id, &datetime),
            ),
            WorkerMessage::RemoveCard(card_id) => {
                send_worker_response(&mut channel, deferred, worker.remove_card(&card_id))
            }
            WorkerMessage::CreateUserdata(user_id) => {
                send_worker_response(&mut channel, deferred, worker.create_userdata(&user_id))
            }
            WorkerMessage::GetUserdataByUserId(user_id) => send_worker_response(
                &mut channel,
                deferred,
                worker.get_userdata_by_user_id(&user_id),
            ),
            WorkerMessage::RemoveUserdata(user_id) => {
                send_worker_response(&mut channel, deferred, worker.remove_userdata(&user_id))
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
            WorkerMessage::PostProcessJob(resource_id) => {
                send_worker_response(&mut channel, deferred, worker.post_process_job(resource_id))
            }
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
