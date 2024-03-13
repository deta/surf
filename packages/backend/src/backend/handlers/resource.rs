use crate::{
    backend::{
        message::{
            AIMessage, ProcessorMessage, ResourceMessage, ResourceTagMessage, TunnelOneshot,
        },
        worker::{send_worker_response, Worker},
    },
    store::{
        db::{CompositeResource, Database, SearchResult},
        models::{
            current_time, random_uuid, Embedding, EmbeddingResource, InternalResourceTagNames,
            Resource, ResourceMetadata, ResourceTag, ResourceTagFilter, ResourceTextContent,
        },
    },
    BackendError, BackendResult,
};
use neon::prelude::Channel;
use std::{path::Path, str::FromStr};

impl Worker {
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

            metadata
                .get_tags()
                .iter()
                .try_for_each(|tag| -> BackendResult<()> {
                    Database::create_resource_tag_tx(&mut tx, tag)?;
                    Ok(())
                })?;

            // generate metadata embeddings in separate AI thread
            self.aiqueue_tx
                // TODO: not clone?
                .send(AIMessage::GenerateMetadataEmbeddings(metadata.clone()))
                .map_err(|e| BackendError::GenericError(e.to_string()))?;
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

    pub fn remove_resource(&mut self, id: String) -> BackendResult<()> {
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

    pub fn proximity_search_resources(
        &mut self,
        resource_id: String,
        proximity_distance_threshold: Option<f32>,
        proximity_limit: Option<i64>,
    ) -> BackendResult<SearchResult> {
        // TODO: find sane defaults for these
        let proximity_distance_threshold = match proximity_distance_threshold {
            Some(threshold) => threshold,
            None => 100000.0,
        };

        let proximity_limit = match proximity_limit {
            Some(limit) => limit,
            None => 10,
        };

        self.db.proximity_search_resources(
            &resource_id,
            proximity_distance_threshold,
            proximity_limit,
        )
    }

    pub fn search_resources(
        &mut self,
        query: String,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        proximity_distance_threshold: Option<f32>,
        proximity_limit: Option<i64>,
        semantic_search_enabled: Option<bool>,
        embeddings_distance_threshold: Option<f32>,
        embeddings_limit: Option<i64>,
    ) -> BackendResult<SearchResult> {
        if let Some(resource_tag_filters) = &resource_tag_filters {
            // we use an `INTERSECT` for each resouce tag filter
            // so limiting the number of filters
            if resource_tag_filters.len() > 20 {
                return Err(BackendError::GenericError(format!(
                    "Max {} filters allowed",
                    20
                )));
            }
        }
        // TODO: find sane defaults for these
        let proximity_distance_threshold = match proximity_distance_threshold {
            Some(threshold) => threshold,
            None => 100000.0,
        };

        let proximity_limit = match proximity_limit {
            Some(limit) => limit,
            None => 10,
        };

        let semantic_search_enabled = match semantic_search_enabled {
            Some(enabled) => enabled,
            None => false,
        };

        let embeddings_distance_threshold = match embeddings_distance_threshold {
            Some(threshold) => threshold,
            None => 1.0,
        };
        let embeddings_limit = match embeddings_limit {
            Some(limit) => limit,
            None => 100,
        };

        let mut query_embedding: Vec<f32> = Vec::new();

        if query != "" && semantic_search_enabled {
            // TODO: what if query is too big?
            // TODO: can we use one of the ai threads instead of the main thread
            query_embedding = self.embedding_model.encode_single(&query)?;
        }

        self.db.search_resources(
            &query,
            query_embedding,
            resource_tag_filters,
            proximity_distance_threshold,
            proximity_limit,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
        )
    }

    pub fn post_process_job(&mut self, resource_id: String) -> BackendResult<()> {
        let resource = self
            .read_resource(resource_id)?
            // mb this should be a `DatabaseError`?
            .ok_or(BackendError::GenericError(
                "resource does not exist".to_owned(),
            ))?;

        self.tqueue_tx
            .send(ProcessorMessage::ProcessResource(resource.clone()))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;

        self.aiqueue_tx
            .send(AIMessage::DescribeImage(resource))
            .map_err(|e| BackendError::GenericError(e.to_string()))

        // // TODO: make use of strum(?) for this
        // match resource.resource_type.as_str() {
        //     "application/vnd.space.document.space-note" => {
        //         let html_data = std::fs::read_to_string(resource.resource_path)?;
        //         let mut output = String::new();
        //         let mut in_tag = false;

        //         for c in html_data.chars() {
        //             match (in_tag, c) {
        //                 (true, '>') => in_tag = false,
        //                 (false, '<') => {
        //                     in_tag = true;
        //                     output.push(' ');
        //                 }
        //                 (false, _) => output.push(c),
        //                 _ => (),
        //             }
        //         }

        //         let output = output
        //             .chars()
        //             .take(256 * 3)
        //             .collect::<String>()
        //             .split_whitespace()
        //             .collect::<Vec<_>>()
        //             .join(" ");

        //         self.db.create_resource_text_content(&ResourceTextContent {
        //             id: random_uuid(),
        //             resource_id,
        //             content: output,
        //         })
        //     }
        //     _ => Ok(()),
        // }
    }

    pub fn update_resource_metadata(&mut self, metadata: ResourceMetadata) -> BackendResult<()> {
        self.aiqueue_tx
            // TODO: not clone?
            .send(AIMessage::GenerateMetadataEmbeddings(metadata.clone()))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;

        self.db.update_resource_metadata(&metadata)
    }

    pub fn create_resource_tag(&mut self, tag: ResourceTag) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::create_resource_tag_tx(&mut tx, &tag)?;
        tx.commit()?;
        Ok(())
    }

    pub fn delete_resource_tag_by_id(&mut self, tag_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_resource_tag_tx(&mut tx, &tag_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn create_resource_text_content(
        &mut self,
        resource_id: String,
        content: String,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::create_resource_text_content_tx(
            &mut tx,
            &ResourceTextContent {
                id: random_uuid(),
                resource_id,
                content,
            },
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_resource_text_content(
        &mut self,
        resource_id: String,
        content: String,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::upsert_resource_text_content(&mut tx, &resource_id, &content)?;
        tx.commit()?;

        self.aiqueue_tx
            .send(AIMessage::GenerateTextContentEmbeddings(
                ResourceTextContent {
                    id: "".to_string(), // TODO: don't like this empty string behavior
                    resource_id,
                    content,
                },
            ))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;
        Ok(())
    }

    pub fn insert_embeddings(
        &mut self,
        resource_id: &String,
        embedding_type: &String,
        embeddings: &Vec<Vec<f32>>,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        embeddings.iter().try_for_each(|v| -> BackendResult<()> {
            let rowid = Database::create_embedding_resource_tx(
                &mut tx,
                &EmbeddingResource {
                    rowid: None,
                    resource_id: resource_id.clone(),
                    embedding_type: embedding_type.clone(),
                },
            )?;
            let em = Embedding::new_with_rowid(rowid, v);
            Database::create_embedding_tx(&mut tx, &em)?;
            Ok(())
        })?;
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_embeddings(
        &mut self,
        resource_id: &String,
        embedding_type: &String,
        embeddings: &Vec<Vec<f32>>,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_embedding_resource_by_type_tx(&mut tx, resource_id, embedding_type)?;
        embeddings.iter().try_for_each(|v| -> BackendResult<()> {
            let rowid = Database::create_embedding_resource_tx(
                &mut tx,
                &EmbeddingResource {
                    rowid: None,
                    resource_id: resource_id.clone(),
                    embedding_type: embedding_type.clone(),
                },
            )?;
            let em = Embedding::new_with_rowid(rowid, v);
            Database::create_embedding_tx(&mut tx, &em)?;
            Ok(())
        })?;
        tx.commit()?;
        Ok(())
    }
}

pub fn handle_resource_tag_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: ResourceTagMessage,
) {
    match message {
        ResourceTagMessage::CreateResourceTag(tag) => {
            send_worker_response(channel, oneshot, worker.create_resource_tag(tag))
        }
        ResourceTagMessage::RemoveResourceTag(tag_id) => {
            send_worker_response(channel, oneshot, worker.delete_resource_tag_by_id(tag_id))
        }
    }
}

pub fn handle_resource_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: ResourceMessage,
) {
    match message {
        ResourceMessage::CreateResource {
            resource_type,
            resource_tags,
            resource_metadata,
        } => send_worker_response(
            channel,
            oneshot,
            worker.create_resource(resource_type, resource_tags, resource_metadata),
        ),
        ResourceMessage::CreateResourceTextContent {
            resource_id,
            content,
        } => send_worker_response(
            channel,
            oneshot,
            worker.create_resource_text_content(resource_id, content),
        ),
        ResourceMessage::GetResource(id) => {
            send_worker_response(channel, oneshot, worker.read_resource(id))
        }
        ResourceMessage::RemoveResource(id) => {
            send_worker_response(channel, oneshot, worker.remove_resource(id))
        }
        ResourceMessage::RecoverResource(id) => {
            send_worker_response(channel, oneshot, worker.recover_resource(id))
        }
        ResourceMessage::ProximitySearchResources {
            resource_id,
            proximity_distance_threshold,
            proximity_limit,
        } => send_worker_response(
            channel,
            oneshot,
            worker.proximity_search_resources(
                resource_id,
                proximity_distance_threshold,
                proximity_limit,
            ),
        ),
        ResourceMessage::SearchResources {
            query,
            resource_tag_filters,
            proximity_distance_threshold,
            proximity_limit,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
        } => send_worker_response(
            channel,
            oneshot,
            worker.search_resources(
                query,
                resource_tag_filters,
                proximity_distance_threshold,
                proximity_limit,
                semantic_search_enabled,
                embeddings_distance_threshold,
                embeddings_limit,
            ),
        ),
        ResourceMessage::UpdateResourceMetadata(metadata) => {
            send_worker_response(channel, oneshot, worker.update_resource_metadata(metadata))
        }
        ResourceMessage::PostProcessJob(id) => {
            send_worker_response(channel, oneshot, worker.post_process_job(id))
        }
        ResourceMessage::UpsertResourceTextContent {
            resource_id,
            content,
        } => send_worker_response(
            channel,
            oneshot,
            worker.upsert_resource_text_content(resource_id, content),
        ),
        ResourceMessage::InsertEmbeddings {
            resource_id,
            embedding_type,
            embeddings,
        } => send_worker_response(
            channel,
            oneshot,
            worker.insert_embeddings(&resource_id, &embedding_type, &embeddings),
        ),
        ResourceMessage::UpsertEmbeddings {
            resource_id,
            embedding_type,
            embeddings,
        } => send_worker_response(
            channel,
            oneshot,
            worker.upsert_embeddings(&resource_id, &embedding_type, &embeddings),
        ),
    }
}
