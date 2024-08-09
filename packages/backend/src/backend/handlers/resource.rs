use std::collections::HashMap;

use crate::{
    backend::{
        message::{
            AIMessage, ProcessorMessage, ResourceMessage, ResourceTagMessage, TunnelOneshot,
        },
        worker::{send_worker_response, Worker},
    },
    store::{
        db::{
            CompositeResource, Database, SearchEngine, SearchResult, SearchResultItem,
            SearchResultSimple,
        },
        models::{
            current_time, random_uuid, EmbeddingResource, EmbeddingType, InternalResourceTagNames,
            Resource, ResourceMetadata, ResourceTag, ResourceTagFilter,
            ResourceTextContentMetadata, ResourceTextContentType,
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
            resource_type: resource_type.clone(),
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
            // TODO: how to separate metadata embeddings from text content rag relevant embeddings

            /*
            self.aiqueue_tx
                // TODO: not clone?
                .send(AIMessage::GenerateMetadataEmbeddings(metadata.clone()))
                .map_err(|e| BackendError::GenericError(e.to_string()))?;

            match resource_type.as_str() {
                t if t.starts_with("application/vnd.space.article")
                    || t.starts_with("application.vnd.space.link") =>
                {
                    self.aiqueue_tx
                        .send(AIMessage::GenerateWebpageEmbeddings(metadata.clone()))
                        .map_err(|e| BackendError::GenericError(e.to_string()))?;
                }
                t if t.starts_with("application/vnd.space.post.youtube") => {
                    self.aiqueue_tx
                        .send(AIMessage::GenerateYoutubeVideoEmbeddings(metadata.clone()))
                        .map_err(|e| BackendError::GenericError(e.to_string()))?;
                }
                _ => (),
            }
            */
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
            resource_annotations: None,
        })
    }

    pub fn read_resource(
        &mut self,
        id: String,
        include_annotations: bool,
    ) -> BackendResult<Option<CompositeResource>> {
        let resource = match self.db.get_resource(&id)? {
            Some(data) => data,
            None => return Ok(None),
        };
        let metadata = self.db.get_resource_metadata_by_resource_id(&resource.id)?;
        let resource_tags = self.db.list_resource_tags(&resource.id)?;
        let resource_tags = (!resource_tags.is_empty()).then_some(resource_tags);
        let mut resource_annotations = None;
        if include_annotations {
            let annotations = self.db.list_resource_annotations(&[id.as_str()])?;
            if let Some((_, first_entry)) = annotations.into_iter().next() {
                resource_annotations = Some(first_entry);
            }
        }

        Ok(Some(CompositeResource {
            resource,
            metadata,
            text_content: None,
            resource_tags,
            resource_annotations,
        }))
    }

    pub fn remove_resource(&mut self, id: String) -> BackendResult<()> {
        let embedding_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, &id)?;

        let mut tx = self.db.begin()?;
        Database::update_resource_deleted_tx(&mut tx, &id, 1)?;
        Database::update_resource_tag_by_name_tx(&mut tx, &ResourceTag::new_deleted(&id, true))?;
        self.ai.upsert_embeddings(embedding_keys, vec![], vec![])?;
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
            None => 500.0,
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

    // Only return resource ids
    pub fn list_resources_by_tags(
        &mut self,
        tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<SearchResultSimple> {
        self.db.list_resources_by_tags(tags)
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
        include_annotations: Option<bool>,
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
        let include_annotations = include_annotations.unwrap_or(false);
        // TODO: find sane defaults for these
        let proximity_distance_threshold = match proximity_distance_threshold {
            Some(threshold) => threshold,
            None => 500.0,
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
            None => 0.4,
        };
        let embeddings_limit = match embeddings_limit {
            Some(limit) => limit,
            None => 100,
        };

        // let mut query_embedding: Vec<f32> = Vec::new();

        // if query != "" && semantic_search_enabled {
        //     // TODO: what if query is too big?
        //     // TODO: can we use one of the ai threads instead of the main thread
        //     query_embedding = self.embedding_model.encode_single(&query)?;
        // }

        let mut results_hashmap: HashMap<String, SearchResultItem> = HashMap::new();

        let db_results = self.db.search_resources(
            &query,
            vec![],
            resource_tag_filters,
            proximity_distance_threshold,
            proximity_limit,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
            include_annotations,
        )?;

        for result in db_results.items {
            if result.resource.resource.resource_type.ends_with(".ignore") {
                continue;
            }
            results_hashmap.insert(result.resource.resource.id.clone(), result);
        }

        if semantic_search_enabled {
            let vector_search_results = self.ai.vector_search(
                &self.db,
                query,
                embeddings_limit as usize,
                None,
                true,
                Some(embeddings_distance_threshold),
            )?;
            for result in vector_search_results {
                if result.resource.resource_type.ends_with(".ignore") {
                    continue;
                }
                results_hashmap.insert(
                    result.resource.id.clone(),
                    SearchResultItem {
                        resource: result,
                        engine: SearchEngine::Embeddings,
                        card_ids: vec![],
                        distance: None,
                        ref_resource_id: None,
                    },
                );
            }
        }
        let results = results_hashmap
            .into_iter()
            .map(|(_, v)| v)
            .collect::<Vec<_>>();
        Ok(SearchResult {
            total: results.len() as i64,
            items: results,
        })
    }

    pub fn post_process_job(&mut self, resource_id: String) -> BackendResult<()> {
        let resource = self
            .read_resource(resource_id, false)?
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
        /*
        self.aiqueue_tx
            // TODO: not clone?
            .send(AIMessage::GenerateMetadataEmbeddings(metadata.clone()))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;
        */
        self.db.update_resource_metadata(&metadata)
    }

    pub fn create_resource_tag(&mut self, mut tag: ResourceTag) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        tag.id = random_uuid();
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

    pub fn delete_resource_tag_by_name(
        &mut self,
        resource_id: String,
        tag_name: String,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_resource_tag_by_tag_name_tx(&mut tx, &resource_id, &tag_name)?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_resource_tag_by_name(&mut self, tag: ResourceTag) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_tag_by_name_tx(&mut tx, &tag)?;
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_resource_text_content(
        &mut self,
        resource_id: String,
        content: String,
        content_type: ResourceTextContentType,
        metadata: ResourceTextContentMetadata,
    ) -> BackendResult<()> {
        let chunks = self.ai.chunker.chunk(&content);
        let old_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, &resource_id)?;

        let mut tx = self.db.begin()?;

        let metadatas = std::iter::repeat(metadata.clone())
            .take(chunks.len())
            .collect::<Vec<_>>();

        let content_ids = Database::upsert_resource_text_content(
            &mut tx,
            &resource_id,
            &content_type,
            &chunks,
            &metadatas,
        )?;
        tx.commit()?;

        if content_type.should_store_embeddings() {
            self.upsert_embeddings(
                resource_id,
                EmbeddingType::TextContent,
                old_keys,
                content_ids,
                chunks,
            )?;
        }
        Ok(())
    }

    pub fn batch_upsert_resource_text_content(
        &mut self,
        resource_id: String,
        content_type: ResourceTextContentType,
        content: Vec<String>,
        metadata: Vec<ResourceTextContentMetadata>,
    ) -> BackendResult<()> {
        if content.len() != metadata.len() {
            return Err(BackendError::GenericError(
                "content and metadata must have the same length".to_owned(),
            ));
        }
        let mut chunks: Vec<String> = vec![];
        let mut metadatas: Vec<ResourceTextContentMetadata> = vec![];

        for (c, m) in content.iter().zip(metadata.iter()) {
            let embedding_chunks = self.ai.chunker.chunk(&c);
            // same metadata for each chunk
            metadatas.extend(std::iter::repeat(m.clone()).take(embedding_chunks.len()));
            chunks.extend(embedding_chunks);
        }
        let old_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, &resource_id)?;

        let mut tx = self.db.begin()?;
        let content_ids = Database::upsert_resource_text_content(
            &mut tx,
            &resource_id,
            &content_type,
            &chunks,
            &metadatas,
        )?;
        tx.commit()?;

        // TODO: no embeddings for image tags and captions for now
        match content_type {
            ResourceTextContentType::ImageTags | ResourceTextContentType::ImageCaptions => {
                return Ok(());
            }
            _ => (),
        }

        Ok(self.upsert_embeddings(
            resource_id,
            EmbeddingType::TextContent,
            old_keys,
            content_ids,
            chunks,
        )?)
    }

    pub fn upsert_embeddings(
        &mut self,
        resource_id: String,
        embedding_type: EmbeddingType,
        old_keys: Vec<i64>,
        content_ids: Vec<i64>,
        chunks: Vec<String>,
    ) -> BackendResult<()> {
        if content_ids.len() != chunks.len() {
            return Err(BackendError::GenericError(
                "content_ids and chunks must have the same length".to_owned(),
            ));
        }
        println!("upserting embedding");

        let mut tx = self.db.begin()?;

        for key in old_keys.iter() {
            Database::remove_embedding_resource_by_row_id_tx(&mut tx, key)?;
        }
        let mut new_row_ids = vec![];

        for (_, content_id) in content_ids.iter().enumerate() {
            let rowid = Database::create_embedding_resource_tx(
                &mut tx,
                &EmbeddingResource {
                    rowid: None,
                    resource_id: resource_id.clone(),
                    content_id: *content_id,
                    embedding_type: embedding_type.clone(),
                },
            )?;
            new_row_ids.push(rowid);
        }
        match self.ai.upsert_embeddings(old_keys, new_row_ids, chunks) {
            Ok(_) => {}
            Err(e) => {
                tx.rollback()?;
                eprintln!("failed to upsert embeddings: {:#?}", e);
                return Err(e);
            }
        }
        tx.commit()?;
        println!("added embeddings");
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
        ResourceTagMessage::RemoveResourceTagByName {
            resource_id,
            tag_name,
        } => send_worker_response(
            channel,
            oneshot,
            worker.delete_resource_tag_by_name(resource_id, tag_name),
        ),
        ResourceTagMessage::UpdateResourceTag(tag) => {
            send_worker_response(channel, oneshot, worker.update_resource_tag_by_name(tag))
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
        ResourceMessage::GetResource(id, include_annotations) => send_worker_response(
            channel,
            oneshot,
            worker.read_resource(id, include_annotations),
        ),
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
        ResourceMessage::ListResourcesByTags(tags) => {
            send_worker_response(channel, oneshot, worker.list_resources_by_tags(tags))
        }
        ResourceMessage::SearchResources {
            query,
            resource_tag_filters,
            proximity_distance_threshold,
            proximity_limit,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
            include_annotations,
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
                include_annotations,
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
            content_type,
            metadata,
        } => send_worker_response(
            channel,
            oneshot,
            worker.upsert_resource_text_content(resource_id, content, content_type, metadata),
        ),
        ResourceMessage::BatchUpsertResourceTextContent {
            resource_id,
            content_type,
            content,
            metadata,
        } => send_worker_response(
            channel,
            oneshot,
            worker.batch_upsert_resource_text_content(resource_id, content_type, content, metadata),
        ),
    }
}
