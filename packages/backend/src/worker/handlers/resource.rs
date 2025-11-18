use std::collections::HashSet;

use tracing::{debug, instrument};

use crate::{
    api::message::{ProcessorMessage, ResourceMessage, ResourceTagMessage, TunnelOneshot},
    store::{
        db::Database,
        models::{
            current_time, random_uuid, CompositeResource, EmbeddingResource, EmbeddingType,
            InternalResourceTagNames, PaginatedResult, PaginationParams, PostProcessingJob,
            Resource, ResourceMetadata, ResourceOrSpace, ResourceProcessingState, ResourceTag,
            ResourceTagFilter, ResourceTextContentMetadata, ResourceTextContentType, SearchEngine,
            SearchResourcesParams, SearchResult, SearchResultItem, SearchResultSpaceItem,
            SpaceEntryExtended, SpaceEntryType,
        },
    },
    worker::{send_worker_response, Worker},
    BackendError, BackendResult,
};
use std::{path::Path, str::FromStr};

impl Worker {
    #[instrument(level = "trace", skip(self, tags, metadata))]
    pub fn create_resource(
        &mut self,
        resource_type: String,
        mut tags: Option<Vec<ResourceTag>>,
        mut metadata: Option<ResourceMetadata>,
    ) -> BackendResult<CompositeResource> {
        let mut tx = self.db.begin()?;

        let resource_id = random_uuid();
        let ct = current_time();
        let extension = crate::utils::get_resource_file_extension(&resource_type);
        let name = metadata.as_ref().map(|m| m.name.as_ref());
        let resource_name = crate::utils::get_resource_filename(&resource_id, name);

        let resource = Resource {
            id: resource_id.clone(),
            resource_path: Path::new(&self.resources_path)
                .join(format!("{}.{}", resource_name, extension))
                .as_os_str()
                .to_string_lossy()
                .to_string(),
            resource_type: resource_type.clone(),
            created_at: ct,
            updated_at: ct,
            deleted: 0,
        };
        Database::create_resource_tx(&mut tx, &resource)?;

        if let Some(metadata) = &mut metadata {
            metadata.id = random_uuid();
            metadata.resource_id = resource.id.clone();

            Database::create_resource_metadata_tx(&mut tx, metadata)?;

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
                            format!("Tag name {} is reserved", InternalResourceTagNames::Deleted)
                                .to_owned(),
                        ));
                    }
                    Ok(InternalResourceTagNames::Type) => {
                        return Err(BackendError::GenericError(
                            format!("Tag name {} is reserved", InternalResourceTagNames::Type)
                                .to_owned(),
                        ));
                    }
                    _ => {}
                }

                tag.id = random_uuid();
                tag.resource_id = resource.id.clone();

                Database::create_resource_tag_tx(&mut tx, tag)?;
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
            post_processing_job: None,
            space_ids: None,
        })
    }

    #[instrument(level = "trace", skip(self))]
    pub fn read_resource(
        &mut self,
        id: &str,
        include_annotations: bool,
    ) -> BackendResult<Option<CompositeResource>> {
        let resource = match self.db.get_resource(id)? {
            Some(data) => data,
            None => return Ok(None),
        };
        let metadata = self.db.get_resource_metadata_by_resource_id(&resource.id)?;
        let processing_state = self.db.get_resource_processing_state(&resource.id)?;
        let space_ids = self.db.list_space_ids_by_resource_id(&resource.id)?;
        let resource_tags = self.db.list_resource_tags(&resource.id)?;
        let resource_tags = (!resource_tags.is_empty()).then_some(resource_tags);
        let mut resource_annotations = None;
        if include_annotations {
            let annotations = self.db.list_resource_annotations(&[id])?;
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
            post_processing_job: processing_state,
            space_ids: Some(space_ids),
        }))
    }

    #[instrument(level = "trace", skip(self))]
    pub fn remove_resources(&mut self, ids: Vec<String>) -> BackendResult<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let mut resources_to_remove = Vec::new();
        let mut all_embedding_keys = Vec::new();

        for id in &ids {
            if let Some(resource) = self.db.get_resource(id)? {
                resources_to_remove.push(resource);

                let embedding_keys = self
                    .db
                    .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, id)?;
                all_embedding_keys.extend(embedding_keys);
            }
        }

        if resources_to_remove.is_empty() {
            return Ok(());
        }
        let mut tx = self.db.begin()?;

        Database::remove_resources_tx(&mut tx, &ids)?;
        self.ai
            .upsert_embeddings(all_embedding_keys, vec![], vec![])?;
        for resource in resources_to_remove {
            match std::fs::remove_file(&resource.resource_path) {
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => {
                    return Err(BackendError::GenericError(format!(
                        "Failed to remove some resource files: {}",
                        e
                    )));
                }
            }
        }

        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn remove_resources_by_tags(&mut self, tags: Vec<ResourceTagFilter>) -> BackendResult<()> {
        let ids = self.db.list_resource_ids_by_tags(&tags, None)?;
        self.remove_resources(ids)
    }

    #[instrument(level = "trace", skip(self))]
    pub fn recover_resource(&mut self, id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_deleted_tx(&mut tx, &id, 1)?;
        Database::update_resource_tag_by_name_tx(&mut tx, &ResourceTag::new_deleted(&id, false))?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    // Only return resource ids
    pub fn list_resources_by_tags(
        &mut self,
        tags: Vec<ResourceTagFilter>,
        pagination: PaginationParams,
        // None = no space filter, Some("") = no space, Some(id) = specific space
        space_filter: Option<String>,
    ) -> BackendResult<PaginatedResult<String>> {
        self.db
            .list_resource_ids_by_tags_paginated(&tags, pagination, space_filter)
    }

    #[instrument(level = "trace", skip(self))]
    pub fn list_all_resources_and_spaces(
        &mut self,
        tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<Vec<ResourceOrSpace>> {
        self.db.list_all_resources_and_spaces(tags)
    }

    fn get_filtered_ids_for_search(
        &mut self,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        space_id: Option<String>,
    ) -> BackendResult<Option<Vec<String>>> {
        if let Some(resource_tag_filters) = resource_tag_filters {
            return Ok(Some(
                self.db
                    .list_resource_ids_by_tags(&resource_tag_filters, space_id)?,
            ));
        }
        if let Some(space_id) = space_id {
            return Ok(Some(self.db.list_resource_ids_by_space_id(&space_id)?));
        }
        Ok(None)
    }

    // TODO: break up this function
    #[instrument(level = "trace", skip(self))]
    pub fn search_resources(
        &mut self,
        params: SearchResourcesParams,
    ) -> BackendResult<SearchResult> {
        if let Some(resource_tag_filters) = &params.resource_tag_filters {
            // we use an `INTERSECT` for each resouce tag filter
            // so limiting the number of filters
            if resource_tag_filters.len() > 20 {
                return Err(BackendError::GenericError(format!(
                    "Max {} filters allowed",
                    20
                )));
            }
        }
        let keyword_limit = params.keyword_limit.unwrap_or(100);

        let semantic_search_enabled = params.semantic_search_enabled.unwrap_or_default();

        let embeddings_distance_threshold = params.embeddings_distance_threshold.unwrap_or(0.4);
        let embeddings_limit = params.embeddings_limit.unwrap_or(100);

        let mut seen_keys: HashSet<String> = HashSet::new();
        let mut results: Vec<SearchResultItem> = vec![];

        let filtered_resource_ids =
            self.get_filtered_ids_for_search(params.resource_tag_filters, params.space_id.clone())?;

        let db_results =
            self.db
                .search_resources(&params.query, &filtered_resource_ids, Some(keyword_limit))?;

        for result in db_results.items {
            if result.resource.resource.resource_type.ends_with(".ignore") {
                continue;
            }
            if seen_keys.contains(&result.resource.resource.id) {
                continue;
            }
            seen_keys.insert(result.resource.resource.id.clone());
            results.push(result)
        }

        if semantic_search_enabled {
            let vector_search_results = self.ai.vector_search(
                &self.db,
                params.query.clone(),
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
                });
            }
        }
        let spaces: Vec<SearchResultSpaceItem>;
        let mut space_entries: Option<Vec<SpaceEntryExtended>> = None;
        match params.space_id {
            Some(space_id) => {
                spaces = self.db.search_sub_space_entries(&space_id, &params.query)?;
                let resource_ids = results
                    .iter()
                    .map(|r| r.resource.resource.id.clone())
                    .collect::<Vec<_>>();
                let child_space_ids = spaces
                    .iter()
                    .map(|s| s.space.id.clone())
                    .collect::<Vec<_>>();

                let mut entries: Vec<SpaceEntryExtended> = vec![];
                let r_entries = self.db.get_space_entries_by_resource_ids(&resource_ids)?;
                r_entries.iter().for_each(|entry| {
                    entries.push(SpaceEntryExtended {
                        id: entry.id.clone(),
                        space_id: space_id.clone(),
                        entry_id: entry.resource_id.clone(),
                        entry_type: SpaceEntryType::Resource,
                        created_at: entry.created_at,
                        updated_at: entry.updated_at,
                        manually_added: entry.manually_added,
                        resource_type: None,
                    });
                });
                let s_entries = self
                    .db
                    .get_sub_space_entries_by_space_ids(&space_id, &child_space_ids)?;
                s_entries.iter().for_each(|entry| {
                    entries.push(SpaceEntryExtended {
                        id: entry.id.clone(),
                        space_id: space_id.clone(),
                        entry_id: entry.child_space_id.clone(),
                        entry_type: SpaceEntryType::Space,
                        created_at: entry.created_at,
                        updated_at: entry.updated_at,
                        manually_added: entry.manually_added,
                        resource_type: None,
                    });
                });
                space_entries = Some(entries);
            }
            None => {
                spaces = self.db.search_spaces(&params.query)?;
            }
        }
        Ok(SearchResult {
            total: results.len() as i64 + spaces.len() as i64,
            items: results,
            spaces,
            space_entries,
        })
    }

    pub fn set_post_processing_job_state(
        &mut self,
        job_id: String,
        state: ResourceProcessingState,
    ) -> BackendResult<()> {
        self.db.set_post_processing_job_state(job_id, state)
    }

    #[instrument(level = "trace", skip(self))]
    pub fn post_processing_job(&mut self, resource_id: String) -> BackendResult<PostProcessingJob> {
        let resource = self
            .read_resource(resource_id.as_str(), false)?
            // mb this should be a `DatabaseError`?
            .ok_or(BackendError::GenericError(
                "resource does not exist".to_owned(),
            ))?;
        let content_hash =
            self.db
                .get_resource_hash(&resource.resource.id)?
                .ok_or(BackendError::GenericError(
                    "resource content hash does not exist".to_owned(),
                ))?;

        let job = PostProcessingJob {
            id: random_uuid(),
            created_at: current_time(),
            updated_at: current_time(),
            resource_id,
            content_hash,
            state: ResourceProcessingState::Pending,
        };
        self.db.create_processing_job_entry(&job)?;

        self.tqueue_tx
            .send(ProcessorMessage::ProcessResource(
                job.clone(),
                Box::new(resource.clone()),
            ))
            .map_err(|err| {
                let mut errors = vec![BackendError::GenericError(err.to_string())];
                if let Err(err) = self.db.remove_processing_job_entry(job.id.clone()) {
                    errors.push(err)
                }
                if errors.len() > 1 {
                    BackendError::MultipleErrors(errors)
                } else {
                    errors.pop().unwrap()
                }
            })?;

        Ok(job)
    }

    #[instrument(level = "trace", skip(self, resource))]
    pub fn update_resource(&mut self, resource: Resource) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_tx(&mut tx, &resource)?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
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

    #[instrument(level = "trace", skip(self))]
    pub fn create_resource_tag(&mut self, mut tag: ResourceTag) -> BackendResult<ResourceTag> {
        let mut tx = self.db.begin()?;
        tag.id = random_uuid();
        Database::create_resource_tag_tx(&mut tx, &tag)?;
        tx.commit()?;
        Ok(tag)
    }

    #[instrument(level = "trace", skip(self))]
    pub fn delete_resource_tag_by_id(&mut self, tag_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::remove_resource_tag_tx(&mut tx, &tag_id)?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
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

    #[instrument(level = "trace", skip(self))]
    pub fn update_resource_tag_by_name(&mut self, tag: ResourceTag) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_resource_tag_by_name_tx(&mut tx, &tag)?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self, content))]
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
            let embedding_chunks = self.ai.chunker.chunk(c);
            // same metadata for each chunk
            metadatas.extend(std::iter::repeat_n(m.clone(), embedding_chunks.len()));
            chunks.extend(embedding_chunks);
        }
        let old_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, &resource_id)?;

        let mut tx = self
            .db
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let content_ids = Database::upsert_resource_text_content(
            &mut tx,
            &resource_id,
            &content_type,
            &chunks,
            &metadatas,
        )?;

        // NOTE: for Note content type for performance reasons we do not generate the embeddings
        // right away as updates are too frequent but instead do it lazily only when we need it
        // we thefore add a tag to the resource indicating that the resource needs post processing
        if content_type == ResourceTextContentType::Note {
            let generate_embeddings_tag = ResourceTag::new_generate_lazy_embeddings(&resource_id);
            Database::create_resource_tag_tx(&mut tx, &generate_embeddings_tag)?;
            tx.commit()?;
            return Ok(());
        }

        tx.commit()?;

        // TODO: no embeddings for image tags and captions for now
        if content_type == ResourceTextContentType::ImageTags
            || content_type == ResourceTextContentType::ImageCaptions
        {
            return Ok(());
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

    // TODO: add a 'status' in the embedding resource table to indicate whether the new embedding
    // resource entries are pending on upsertion, currently the old entries being in the table
    // while the upsertion is in progress is not a problem, but it might be in the future
    #[instrument(level = "trace", skip(self, chunks))]
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

        // first insert new embedding resources
        // these will be deleted later if there is an upsertion error
        let mut tx = self.db.begin()?;
        let mut new_row_ids = vec![];
        for content_id in content_ids {
            let rowid = Database::create_embedding_resource_tx(
                &mut tx,
                &EmbeddingResource {
                    rowid: None,
                    resource_id: resource_id.clone(),
                    content_id,
                    embedding_type: embedding_type.clone(),
                },
            )?;
            new_row_ids.push(rowid);
        }
        // commit transaction already to not hold the table lock
        tx.commit()?;

        match self
            .ai
            .upsert_embeddings(old_keys.clone(), new_row_ids.clone(), chunks)
        {
            Ok(_) => {}
            Err(e) => {
                let mut errors = Vec::new();
                errors.push(e);

                // cleanup newly inserted embedding resources
                debug!("upsert_embeddings failed, cleaning up newly inserted embedding resources");
                let mut tx = match self.db.begin() {
                    Ok(tx) => tx,
                    Err(e) => {
                        errors.push(e);
                        return Err(BackendError::MultipleErrors(errors));
                    }
                };
                for key in new_row_ids.iter() {
                    if let Err(delete_error) =
                        Database::remove_embedding_resource_by_row_id_tx(&mut tx, key)
                    {
                        errors.push(delete_error);
                        return Err(BackendError::MultipleErrors(errors));
                    }
                }
                if let Err(tx_error) = tx.commit() {
                    errors.push(BackendError::DatabaseError(tx_error));
                    return Err(BackendError::MultipleErrors(errors));
                }
                return Err(if errors.len() == 1 {
                    errors.into_iter().next().unwrap()
                } else {
                    BackendError::MultipleErrors(errors)
                });
            }
        }

        // finally remove old keys if upsertion was successful
        let mut tx = self.db.begin()?;
        for key in old_keys.iter() {
            Database::remove_embedding_resource_by_row_id_tx(&mut tx, key)?;
        }
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn upsert_resource_hash(&mut self, resource_id: String, hash: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::upsert_resource_hash_tx(&mut tx, &resource_id, &hash)?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn get_resource_hash(&mut self, resource_id: String) -> BackendResult<Option<String>> {
        self.db.get_resource_hash(&resource_id)
    }

    #[instrument(level = "trace", skip(self))]
    pub fn delete_resource_hash(&mut self, resource_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::delete_resource_hash_tx(&mut tx, &resource_id)?;
        tx.commit()?;
        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub fn fail_active_post_processing_jobs(&mut self) -> BackendResult<()> {
        self.db.fail_active_post_processing_jobs(&self.created_at)
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

#[tracing::instrument(level = "trace", skip(worker, oneshot, message))]
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
            let result = worker.read_resource(&id, include_annotations);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::RemoveResources(ids) => {
            let result = worker.remove_resources(ids);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::RecoverResource(id) => {
            let result = worker.recover_resource(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::RemoveResourcesByTags(tags) => {
            let result = worker.remove_resources_by_tags(tags);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::ListResourcesByTags(tags, pagination_params, space_filter) => {
            let result = worker.list_resources_by_tags(tags, pagination_params, space_filter);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::ListAllResourcesAndSpaces(tags) => {
            let result = worker.list_all_resources_and_spaces(tags);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::SearchResources(search_params) => {
            let result = worker.search_resources(search_params);
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
            let result = worker.post_processing_job(id);
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
        ResourceMessage::SetPostProcessingState { id, state } => {
            let result = worker.set_post_processing_job_state(id, state);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        ResourceMessage::FailActivePostProcessingJobs => {
            let result = worker.fail_active_post_processing_jobs();
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
