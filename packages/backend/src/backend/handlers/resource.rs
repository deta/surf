use std::collections::HashSet;

use crate::{
    backend::{
        message::{
            AIMessage, ProcessorMessage, ResourceMessage,
            ResourceTagMessage, TunnelOneshot,
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
        let resource = self.db.get_resource(&id)?;
        // deletion is no-op if resource does not exist
        if resource.is_none() {
            return Ok(());
        }

        let embedding_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, &id)?;

        let mut tx = self.db.begin()?;
        /*
        Database::update_resource_deleted_tx(&mut tx, &id, 1)?;
        Database::update_resource_tag_by_name_tx(&mut tx, &ResourceTag::new_deleted(&id, true))?;
        */
        Database::remove_resource_tx(&mut tx, &id)?;
        let resource_path = resource.unwrap().resource_path;
        self.ai.upsert_embeddings(embedding_keys, vec![], vec![])?;
        match std::fs::remove_file(&resource_path) {
            Ok(_) => {}
            // Path not found is non-error
            // this also happens if another resource was pointing to the same file and was already deleted
            // or if the underlying file was deleted manually but the resource was not
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                return Err(BackendError::GenericError(format!(
                    "failed to remove resource file from disk: {:#?}",
                    e
                )))
            }
        }
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

    fn get_filtered_ids_for_search(
        &mut self,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        space_id: Option<String>,
    ) -> BackendResult<Option<Vec<String>>> {
        if let Some(resource_tag_filters) = resource_tag_filters {
            if let Some(space_id) = space_id {
                return Ok(Some(self.db.list_resource_ids_by_tags_space_id(
                    &resource_tag_filters,
                    &space_id,
                )?));
            }
            return Ok(Some(
                self.db.list_resource_ids_by_tags(&resource_tag_filters)?,
            ));
        }
        if let Some(space_id) = space_id {
            return Ok(Some(self.db.list_resource_ids_by_space_id(&space_id)?));
        }
        Ok(None)
    }

    // TODO: break up this function
    pub fn search_resources(
        &mut self,
        query: String,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        semantic_search_enabled: Option<bool>,
        embeddings_distance_threshold: Option<f32>,
        embeddings_limit: Option<i64>,
        include_annotations: Option<bool>,
        space_id: Option<String>,
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

        let mut seen_keys: HashSet<String> = HashSet::new();
        let mut results: Vec<SearchResultItem> = vec![];

        let filtered_resource_ids =
            self.get_filtered_ids_for_search(resource_tag_filters, space_id)?;

        let db_results =
            self.db
                .search_resources(&query, &filtered_resource_ids, include_annotations)?;

        for result in db_results.items {
            if result.resource.resource.resource_type.ends_with(".ignore") {
                continue;
            }
            // db_results are always unique by resource id
            seen_keys.insert(result.resource.resource.id.clone());
            results.push(result)
        }

        if semantic_search_enabled {
            let vector_search_results = self.ai.vector_search(
                &self.db,
                query,
                embeddings_limit as usize,
                filtered_resource_ids,
                true,
                Some(embeddings_distance_threshold),
            )?;
            for result in vector_search_results {
                if result.resource.resource_type.ends_with(".ignore") {
                    continue;
                }
                if seen_keys.contains(&result.resource.id) {
                    continue;
                }
                seen_keys.insert(result.resource.id.clone());
                results.push(SearchResultItem {
                    resource: result,
                    engine: SearchEngine::Embeddings,
                    card_ids: vec![],
                    ref_resource_id: None,
                    distance: None,
                });
            }
        }
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

        if resource.resource.resource_type.starts_with("image/") {
            self.aiqueue_tx
                .send(AIMessage::DescribeImage(resource))
                .map_err(|e| BackendError::GenericError(e.to_string()))?
        }

        Ok(())
    }

    pub fn update_resource(&mut self, resource: Resource) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_tx(&mut tx, &resource)?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_resource_metadata(&mut self, metadata: ResourceMetadata) -> BackendResult<()> {
        /*
        self.aiqueue_tx
            // TODO: not clone?
            .send(AIMessage::GenerateMetadataEmbeddings(metadata.clone()))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;
        */
        let mut tx = self.db.begin()?;
        Database::update_resource_metadata_tx(&mut tx, &metadata)?;
        tx.commit()?;
        Ok(())
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
                resource_id.clone(),
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

        self.upsert_embeddings(
            resource_id.clone(),
            EmbeddingType::TextContent,
            old_keys,
            content_ids,
            chunks,
        )?;
        Ok(())
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
        tx.commit()?;

        match self.ai.upsert_embeddings(old_keys, new_row_ids, chunks) {
            Ok(_) => {}
            Err(e) => {
                self.db
                    .delete_all_embedding_resources(&resource_id, embedding_type)?;
                eprintln!("failed to upsert embeddings: {:#?}", e);
                return Err(e);
            }
        }
        Ok(())
    }

    pub fn upsert_resource_hash(&mut self, resource_id: String, hash: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::upsert_resource_hash_tx(&mut tx, &resource_id, &hash)?;
        tx.commit()?;
        Ok(())
    }

    pub fn get_resource_hash(&mut self, resource_id: String) -> BackendResult<Option<String>> {
        self.db.get_resource_hash(&resource_id)
    }

    pub fn delete_resource_hash(&mut self, resource_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::delete_resource_hash_tx(&mut tx, &resource_id)?;
        tx.commit()?;
        Ok(())
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_resource_tag_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: ResourceTagMessage,
) {
    match message {
        ResourceTagMessage::CreateResourceTag(tag) => {
            let result = worker.create_resource_tag(tag);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceTagMessage::RemoveResourceTag(tag_id) => {
            let result = worker.delete_resource_tag_by_id(tag_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceTagMessage::RemoveResourceTagByName {
            resource_id,
            tag_name,
        } => {
            let result = worker.delete_resource_tag_by_name(resource_id, tag_name);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceTagMessage::UpdateResourceTag(tag) => {
            let result = worker.update_resource_tag_by_name(tag);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_resource_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: ResourceMessage,
) {
    match message {
        ResourceMessage::CreateResource {
            resource_type,
            resource_tags,
            resource_metadata,
        } => {
            let result = worker.create_resource(resource_type, resource_tags, resource_metadata);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::GetResource(id, include_annotations) => {
            let result = worker.read_resource(id, include_annotations);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::RemoveResource(id) => {
            let result = worker.remove_resource(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::RecoverResource(id) => {
            let result = worker.recover_resource(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::ProximitySearchResources {
            resource_id,
            proximity_distance_threshold,
            proximity_limit,
        } => {
            let result = worker.proximity_search_resources(
                resource_id,
                proximity_distance_threshold,
                proximity_limit,
            );
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::ListResourcesByTags(tags) => {
            let result = worker.list_resources_by_tags(tags);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::SearchResources {
            query,
            resource_tag_filters,
            semantic_search_enabled,
            embeddings_distance_threshold,
            embeddings_limit,
            include_annotations,
            space_id,
        } => {
            let result = worker.search_resources(
                query,
                resource_tag_filters,
                semantic_search_enabled,
                embeddings_distance_threshold,
                embeddings_limit,
                include_annotations,
                space_id,
            );
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::UpdateResource(resource) => {
            let result = worker.update_resource(resource);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::UpdateResourceMetadata(metadata) => {
            let result = worker.update_resource_metadata(metadata);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::PostProcessJob(id) => {
            let result = worker.post_process_job(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::UpsertResourceTextContent {
            resource_id,
            content,
            content_type,
            metadata,
        } => {
            let result =
                worker.upsert_resource_text_content(resource_id, content, content_type, metadata);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::BatchUpsertResourceTextContent {
            resource_id,
            content_type,
            content,
            metadata,
        } => {
            let result = worker.batch_upsert_resource_text_content(
                resource_id,
                content_type,
                content,
                metadata,
            );
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::UpsertResourceHash { resource_id, hash } => {
            let result = worker.upsert_resource_hash(resource_id, hash);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::GetResourceHash(resource_id) => {
            let result = worker.get_resource_hash(resource_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::DeleteResourceHash(resource_id) => {
            let result = worker.delete_resource_hash(resource_id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
