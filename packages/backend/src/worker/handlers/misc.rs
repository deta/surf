use crate::{
    ai::{
        llm::{
            client::Model,
            models::{Message, MessageContent},
        },
        youtube::YoutubeTranscript,
        {ChatInput, ChatResult, DocsSimilarity},
    },
    api::message::{MiscMessage, TunnelOneshot},
    store::{
        db::Database,
        models::{
            random_uuid, AIChatSession, AIChatSessionHistory, AIChatSessionMessage,
            AIChatSessionMessageSource, CompositeResource, EmbeddingType, InternalResourceTagNames,
            ResourceTextContent,
        },
    },
    worker::{send_worker_response, Worker},
    BackendError, BackendResult,
};
use neon::prelude::*;
use std::collections::HashSet;

impl Worker {
    pub fn print(&mut self, content: String) -> BackendResult<String> {
        println!("print: {}", content);
        Ok("ok".to_owned())
    }

    pub fn get_ai_chat_message(&mut self, id: String) -> BackendResult<AIChatSessionHistory> {
        let session = self
            .db
            .get_ai_session(&id)?
            .ok_or_else(|| BackendError::GenericError("AI chat session not found".to_string()))?;
        let messages = self.db.list_non_context_ai_session_messages(&id)?;
        Ok(AIChatSessionHistory {
            id: session.id,
            system_prompt: session.system_prompt,
            title: session.title,
            created_at: session.created_at,
            updated_at: session.updated_at,
            messages,
        })
    }

    pub fn create_ai_chat_message(
        &mut self,
        system_prompt: String,
        title: String,
    ) -> BackendResult<String> {
        let new_chat = AIChatSession {
            id: random_uuid(),
            system_prompt,
            title,
            updated_at: chrono::Utc::now(),
            created_at: chrono::Utc::now(),
        };
        let mut tx = self.db.begin()?;
        Database::create_ai_session_tx(&mut tx, &new_chat)?;
        tx.commit()?;
        Ok(new_chat.id)
    }

    pub fn update_ai_chat_message(&mut self, id: String, title: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_ai_session_tx(&mut tx, &id, &title, chrono::Utc::now())?;
        tx.commit()?;
        Ok(())
    }

    pub fn list_ai_chats(&mut self, limit: Option<i64>) -> BackendResult<Vec<AIChatSession>> {
        self.db.list_ai_sessions(limit)
    }

    pub fn search_ai_chats(
        &mut self,
        search: &str,
        limit: Option<i64>,
    ) -> BackendResult<Vec<AIChatSession>> {
        self.db.search_ai_sessions(search, limit)
    }

    pub fn delete_ai_chat_message(&mut self, session_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::delete_ai_session_tx(&mut tx, &session_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn get_ai_docs_similarity(
        &mut self,
        query: String,
        docs: Vec<String>,
        threshold: Option<f32>,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        self.ai.get_docs_similarity(query, docs, threshold)
    }

    pub fn create_app_query(
        &mut self,
        mut chunk_callback: Root<JsFunction>,
        done_callback: Root<JsFunction>,
        query: String,
        model: &Model,
        custom_key: Option<String>,
        inline_images: Option<Vec<String>>,
    ) -> BackendResult<()> {
        // frontend sends a query with a trailing <p></p> for some reason
        let query = match query.strip_suffix("<p></p>") {
            Some(q) => q.to_string(),
            None => query,
        };

        let mut stream = self
            .ai
            .create_app(query, model, custom_key, inline_images)?;

        for chunk in stream.by_ref() {
            match chunk {
                Ok(data) => {
                    chunk_callback = self.send_callback(chunk_callback, data)?;
                }
                Err(err) => return Err(err),
            }
        }
        self.send_done_callback(done_callback)?;
        Ok(())
    }

    pub fn create_chat_completion(
        &mut self,
        messages: Vec<Message>,
        model: Model,
        custom_key: Option<String>,
        _response_format: Option<&str>,
    ) -> BackendResult<String> {
        self.ai
            .client
            .create_chat_completion(messages, &model, custom_key, None)
    }

    pub fn send_chat_query(
        &mut self,
        session_id: Option<String>,
        callback: Root<JsFunction>,
        search_only: bool,
        chat_input: ChatInput,
    ) -> BackendResult<()> {
        // frontend sends a query with a trailing <p></p> sometimes for some reason
        let query = match chat_input.query.strip_suffix("<p></p>") {
            Some(q) => q.to_string(),
            None => chat_input.query.clone(),
        };

        if search_only {
            return self.handle_search_only_query(
                query,
                chat_input.number_documents,
                Some(chat_input.resource_ids),
                callback,
            );
        }
        self.handle_full_chat_query(session_id, callback, chat_input)
    }

    // TODO: store history
    fn handle_search_only_query(
        &mut self,
        query: String,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
        callback: Root<JsFunction>,
    ) -> BackendResult<()> {
        let results = self.ai.vector_search(
            &self.db,
            query,
            number_documents as usize,
            resource_ids,
            false,
            None,
        )?;

        let sources_str = self.process_search_results(&results)?;
        self.send_callback(callback, sources_str)?;
        Ok(())
    }

    fn process_search_results(&self, results: &[CompositeResource]) -> BackendResult<String> {
        let mut sources_str = String::from("<sources>");

        for (i, result) in results.iter().enumerate() {
            let source =
                AIChatSessionMessageSource::from_resource_index(result, i).ok_or_else(|| {
                    eprintln!(
                        "Failed to get ai chat session message source from composite resource"
                    );
                    BackendError::GenericError(
                        "Failed to get AI chat session message source from composite resource"
                            .to_string(),
                    )
                })?;
            sources_str.push_str(&source.to_xml());
        }

        sources_str.push_str("</sources>\n<answer> </answer>");
        Ok(sources_str)
    }

    // 'true' if more than on resource
    // 'true' if single resource and text content is more than 24k characters
    // 'false' otherwise
    fn should_send_cluster_query(&self, ids: &[String]) -> BackendResult<bool> {
        if !ids.is_empty() {
            if ids.len() == 1 {
                // TODO: count the number of text content
                let resource = match self.db.get_resource(&ids[0])? {
                    Some(r) => r,
                    None => return Ok(false),
                };
                let text_content_count = self.db.count_resource_text_content_by_ids(ids)?;
                // for all other resources, we cluster by 2k characters per chunk
                // 12 chunks is 24k characters, which is the limit within which we could send
                // all the content to the LLM
                // for youtube videos, we cluster by ~20 seconds per chunk, which is about ~300 characters
                // so the threshold is 80 chunks which is 24k characters
                // TODO: check if the thresholds produce good results
                // TODO: special handling for code snippets?
                match resource.resource_type.as_ref() {
                    "application/vnd.space.post.youtube" => {
                        return Ok(text_content_count > 80);
                    }
                    _ => return Ok(text_content_count > 12),
                };
            }
            return Ok(true);
        }
        Ok(false)
    }

    fn handle_full_chat_query(
        &mut self,
        session_id: Option<String>,
        callback: Root<JsFunction>,
        mut chat_input: ChatInput,
    ) -> BackendResult<()> {
        let mut history: Vec<Message> = vec![];

        if let Some(ref session_id) = session_id {
            history = self
                .ai
                .parse_chat_history(self.db.list_ai_session_messages_skip_sources(session_id)?)?;
        }

        let mut should_cluster = false;
        let send_cluster_query =
            !chat_input.general && self.should_send_cluster_query(&chat_input.resource_ids)?;

        if send_cluster_query {
            let composite_resources = self
                .db
                .list_resources_metadata_by_ids(&chat_input.resource_ids)?;
            let should_cluster_result = self.ai.should_cluster(
                &chat_input.query,
                &chat_input.model,
                chat_input.custom_key.clone(),
                self.ai
                    .llm_metadata_messages_from_sources(&composite_resources),
            )?;
            should_cluster = should_cluster_result.embeddings_search_needed;
            // we are already narrowing down the search space
            // if the llm pre-determines the search space
            if let Some(search_space) = should_cluster_result.relevant_context_ids {
                if !search_space.is_empty() {
                    let mut pruned_resources_ids: Vec<String> = vec![];

                    // the relevant context ids are the indices of the resources for llm efficiency
                    for str_index in search_space {
                        match str_index.parse::<usize>() {
                            Ok(i) => {
                                pruned_resources_ids
                                    .push(composite_resources[i].resource.id.clone());
                            }
                            Err(_) => continue,
                        };
                    }
                    chat_input.resource_ids = pruned_resources_ids;
                }
            }
        }

        self.handle_lazy_embeddings(&chat_input.resource_ids)?;

        let (assistant_message, chat_result) =
            self.process_chat_stream(callback, chat_input, history, should_cluster)?;

        if let Some(session_id) = session_id {
            self.save_messages(session_id, assistant_message, chat_result)?;
        }
        Ok(())
    }

    fn upsert_lazy_embedding(&mut self, resource_id: &str) -> BackendResult<()> {
        let old_keys = self
            .db
            .list_embedding_ids_by_type_resource_id(EmbeddingType::TextContent, resource_id)?;

        let (content_ids, chunks) = self
            .db
            .list_resource_text_content_rowids_and_content_by_resource_id(resource_id)?;

        self.upsert_embeddings(
            resource_id.to_string(),
            EmbeddingType::TextContent,
            old_keys,
            content_ids,
            chunks,
        )?;

        Ok(())
    }

    // TODO: refactor for all the matches
    fn handle_lazy_embeddings(&mut self, resource_ids: &[String]) -> BackendResult<()> {
        resource_ids.iter().for_each(|id| {
            match self.db.get_resource_tag_by_name(
                id,
                InternalResourceTagNames::GenerateLazyEmbeddings.as_str(),
            ) {
                Ok(Some(_)) => match self.upsert_lazy_embedding(id) {
                    Ok(_) => {
                        if let Err(err) = self.db.remove_resource_tag_by_tag_name(
                            id,
                            InternalResourceTagNames::GenerateLazyEmbeddings.as_str(),
                        ) {
                            eprintln!(
                                "Error removing lazy embeddings tag for resource {}: {}",
                                id, err
                            );
                        }
                    }
                    Err(err) => {
                        eprintln!(
                            "Error processing lazy embeddings for resource {}: {}",
                            id, err
                        );
                    }
                },
                Ok(None) => {}
                Err(err) => {
                    eprintln!(
                        "Error checking lazy embeddings tag for resource {}: {}",
                        id, err
                    );
                }
            }
        });
        Ok(())
    }

    fn process_chat_stream(
        &self,
        mut callback: Root<JsFunction>,
        chat_input: ChatInput,
        history: Vec<Message>,
        should_cluster: bool,
    ) -> BackendResult<(String, ChatResult)> {
        let mut chat_result = self
            .ai
            .chat(&self.db, chat_input, history, should_cluster)?;

        callback = self.send_callback(callback, chat_result.sources_xml.clone())?;

        let mut assistant_message = String::new();
        for chunk in chat_result.stream.by_ref() {
            match chunk {
                Ok(data) => {
                    assistant_message.push_str(&data);
                    callback = self.send_callback(callback, data)?;
                }
                Err(err) => return Err(err),
            }
        }

        Ok((assistant_message, chat_result))
    }

    fn send_callback(
        &self,
        callback: Root<JsFunction>,
        data: String,
    ) -> BackendResult<Root<JsFunction>> {
        self.channel
            .send(|mut cx| {
                let f = callback.into_inner(&mut cx);
                let this = cx.undefined();
                let args = vec![cx.string(data).upcast::<JsValue>()];
                f.call(&mut cx, this, args)?;
                Ok(f.root(&mut cx))
            })
            .join()
            .map_err(|err| BackendError::GenericError(err.to_string()))
    }

    fn send_done_callback(&self, callback: Root<JsFunction>) -> BackendResult<Root<JsFunction>> {
        self.channel
            .send(|mut cx| {
                let f = callback.into_inner(&mut cx);
                let this = cx.undefined();
                let args = vec![];
                f.call(&mut cx, this, args)?;
                Ok(f.root(&mut cx))
            })
            .join()
            .map_err(|err| BackendError::GenericError(err.to_string()))
    }

    // NOTE: each chat_result.message only has a single content
    // but the content is a vector of MessageContent because of the llm API
    fn save_messages(
        &mut self,
        session_id: String,
        assistant_message: String,
        chat_result: ChatResult,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        for msg in chat_result.messages.iter() {
            if msg.content.len() != 1 {
                continue;
            }
            let (msg_type, content) = match msg.content[0] {
                MessageContent::Text(ref t) => ("text".to_owned(), t.text.clone()),
                MessageContent::Image(ref i) => ("image".to_owned(), i.image_url.url.clone()),
            };

            let message = AIChatSessionMessage {
                ai_session_id: session_id.clone(),
                role: msg.role.to_string(),
                content,
                truncatable: msg.truncatable,
                is_context: msg.is_context,
                msg_type,
                created_at: chrono::Utc::now(),
                sources: None,
            };
            Database::create_ai_session_message_tx(&mut tx, &message)?;
        }
        Database::create_ai_session_message_tx(
            &mut tx,
            &AIChatSessionMessage {
                ai_session_id: session_id.clone(),
                role: "assistant".to_owned(),
                content: assistant_message,
                truncatable: false,
                is_context: false,
                msg_type: "text".to_owned(),
                created_at: chrono::Utc::now(),
                sources: Some(chat_result.sources),
            },
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn get_youtube_transcript(&self, video_url: String) -> BackendResult<YoutubeTranscript> {
        // use english as default language
        let lang = Some("en");
        crate::ai::youtube::fetch_transcript(&video_url, lang)
    }

    pub fn query_sffs_resources(
        &self,
        prompt: String,
        model: &Model,
        custom_key: Option<String>,
        sql_query: Option<String>,
        embedding_query: Option<String>,
        embedding_distance_threshold: Option<f32>,
    ) -> BackendResult<String> {
        #[derive(serde::Deserialize, Debug)]
        struct JsonResult {
            sql_query: String,
            embedding_search_query: Option<String>,
        }
        #[derive(serde::Serialize, Debug)]
        struct FunctionResult {
            sql_query: String,
            embedding_search_query: Option<String>,
            sql_query_results: HashSet<String>,
            embedding_search_results: Option<HashSet<String>>,
        }

        let result = match sql_query {
            Some(string) => JsonResult {
                sql_query: string,
                embedding_search_query: embedding_query,
            },
            None => serde_json::from_str::<JsonResult>(
                self.ai
                    .get_sql_query(prompt, model, custom_key)?
                    .replace("```json", "")
                    .replace("```", "")
                    .as_str(),
            )
            .map_err(|e| BackendError::GenericError(e.to_string()))?,
        };
        let mut resource_ids_first: HashSet<String> = HashSet::new();
        let mut resource_ids_stmt = self.db.read_only_conn.prepare(result.sql_query.as_str())?;
        let mut resource_ids_rows = resource_ids_stmt.query([])?;
        let mut resource_ids_second = None;

        while let Some(row) = resource_ids_rows.next()? {
            resource_ids_first.insert(row.get(0)?);
        }

        // TODO: is there a more performant way to do this?
        let silent_resource_ids: HashSet<String> = self
            .db
            .conn
            .prepare(&format!(
                "SELECT resource_id FROM resource_tags
                 WHERE resource_id IN ({})
                 AND tag_name = 'silent' AND tag_value = 'true'",
                std::iter::repeat_n("?", resource_ids_first.len())
                    .collect::<Vec<_>>()
                    .join(",")
            ))?
            .query_map(
                rusqlite::params_from_iter(resource_ids_first.iter()),
                |row| row.get(0),
            )?
            .filter_map(Result::ok)
            .collect();

        resource_ids_first.retain(|id| !silent_resource_ids.contains(id));

        if let Some(ref query) = result.embedding_search_query {
            let filter: Vec<String> = resource_ids_first.iter().map(|id| id.to_string()).collect();
            //
            // TODO: why 100?
            let resources = self.ai.vector_search(
                &self.db,
                query.clone(),
                100,
                Some(filter),
                true,
                Some(embedding_distance_threshold.unwrap_or(0.4)),
            )?;
            let mut resource_ids: HashSet<String> = HashSet::new();
            for resource in resources {
                resource_ids.insert(resource.resource.id);
            }
            resource_ids_second = Some(resource_ids.into_iter().collect());
        }

        serde_json::to_string(&FunctionResult {
            sql_query: result.sql_query.clone(),
            embedding_search_query: result.embedding_search_query.clone(),
            sql_query_results: resource_ids_first,
            embedding_search_results: resource_ids_second,
        })
        .map_err(|e| BackendError::GenericError(e.to_string()))
    }

    pub fn get_ai_chat_data_source(
        &self,
        source_id: String,
    ) -> BackendResult<Option<ResourceTextContent>> {
        self.db.get_resource_text_content(&source_id)
    }

    pub fn search_chat_resources(
        &mut self,
        query: String,
        model: Model,
        custom_key: Option<String>,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
    ) -> BackendResult<Vec<CompositeResource>> {
        let query = match query.strip_suffix("<p></p>") {
            Some(q) => q.to_string(),
            None => query,
        };

        // If no resource_ids provided, no filtering needed
        let mut ids = resource_ids.unwrap_or_default();

        // Only check clustering if we have resource IDs
        let mut should_cluster = false;
        if !ids.is_empty() {
            let send_cluster_query = self.should_send_cluster_query(&ids)?;

            if send_cluster_query {
                let composite_resources = self.db.list_resources_metadata_by_ids(&ids)?;
                let should_cluster_result = self.ai.should_cluster(
                    &query,
                    &model,
                    custom_key,
                    self.ai
                        .llm_metadata_messages_from_sources(&composite_resources),
                )?;
                should_cluster = should_cluster_result.embeddings_search_needed;

                // Narrow down the search space if LLM pre-determines it
                if let Some(search_space) = should_cluster_result.relevant_context_ids {
                    if !search_space.is_empty() {
                        let mut pruned_resources_ids: Vec<String> = vec![];

                        for str_index in search_space {
                            match str_index.parse::<usize>() {
                                Ok(i) => {
                                    pruned_resources_ids
                                        .push(composite_resources[i].resource.id.clone());
                                }
                                Err(_) => continue,
                            };
                        }
                        ids = pruned_resources_ids;
                    }
                }
            }
        }

        // If should_cluster is true or no resource_ids provided, do vector search
        // Otherwise, just return the resources by IDs
        if should_cluster || ids.is_empty() {
            let mut seen_keys: HashSet<String> = HashSet::new();
            let mut results: Vec<CompositeResource> = vec![];

            if !ids.is_empty() {
                let db_results = self.db.search_resources(
                    &query,
                    &Some(ids.clone()),
                    Some(number_documents as i64),
                )?;

                for result in db_results.items {
                    if result.resource.resource.resource_type.ends_with(".ignore") {
                        continue;
                    }
                    if seen_keys.contains(&result.resource.resource.id) {
                        continue;
                    }
                    seen_keys.insert(result.resource.resource.id.clone());
                    results.push(result.resource);
                }
            }

            let vector_search_results = self.ai.vector_search(
                &self.db,
                query,
                number_documents as usize,
                if ids.is_empty() {
                    None
                } else {
                    Some(ids.clone())
                },
                false,
                Some(0.5),
            )?;

            // Add vector search results
            for result in vector_search_results {
                if result.resource.resource_type.ends_with(".ignore") {
                    continue;
                }
                if seen_keys.contains(&result.resource.id) {
                    continue;
                }
                seen_keys.insert(result.resource.id.clone());
                results.push(result);
            }

            if results.is_empty() {
                return self.db.list_resources_by_ids(ids);
            }

            Ok(results)
        } else {
            // If not clustering, just return the resources by IDs
            self.db.list_resources_by_ids(ids)
        }
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_misc_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: MiscMessage,
) {
    match message {
        MiscMessage::Print(content) => {
            let result = worker.print(content);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::GetAIChatMessage(id) => {
            let result = worker.get_ai_chat_message(id);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::CreateAIChatMessage(system_prompt, title) => {
            let result = worker.create_ai_chat_message(system_prompt, title);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::UpdateAIChatMessage(id, title) => {
            let result = worker.update_ai_chat_message(id, title);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::ListAIChats(limit) => {
            let result = worker.list_ai_chats(limit);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::SearchAIChats(search, limit) => {
            let result = worker.search_ai_chats(&search, limit);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::CreateChatCompletion {
            messages,
            model,
            custom_key,
            response_format,
        } => {
            let result = worker.create_chat_completion(
                messages,
                model,
                custom_key,
                response_format.as_deref(),
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        // TODO: use chat input
        MiscMessage::ChatQuery {
            query,
            model,
            custom_key,
            search_only,
            session_id,
            number_documents,
            callback,
            resource_ids,
            inline_images,
            general,
            app_creation,
        } => {
            let input = ChatInput {
                query,
                model,
                custom_key,
                number_documents,
                resource_ids,
                inline_images,
                general: general || app_creation, // general is true for app creation
                note_resource_id: None,
                websearch: false,
                surflet: false,
            };
            let result = worker.send_chat_query(Some(session_id), callback, search_only, input);

            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::NoteQuery {
            query,
            model,
            custom_key,
            note_resource_id,
            number_documents,
            callback,
            resource_ids,
            inline_images,
            general,
            surflet,
            websearch,
        } => {
            let input = ChatInput {
                query,
                model,
                custom_key,
                number_documents,
                resource_ids,
                inline_images,
                general,
                note_resource_id: Some(note_resource_id),
                websearch,
                surflet,
            };

            let result = worker.send_chat_query(None, callback, false, input);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::CreateAppQuery {
            query,
            model,
            custom_key,
            chunk_callback,
            done_callback,
            inline_images,
        } => {
            let result = worker.create_app_query(
                chunk_callback,
                done_callback,
                query,
                &model,
                custom_key,
                inline_images,
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::QuerySFFSResources(
            prompt,
            model,
            custom_key,
            sql_query,
            embedding_query,
            embedding_distance_threshold,
        ) => {
            let result = worker.query_sffs_resources(
                prompt,
                &model,
                custom_key,
                sql_query,
                embedding_query,
                embedding_distance_threshold,
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::GetAIChatDataSource(source_hash) => {
            let result = worker.get_ai_chat_data_source(source_hash);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::DeleteAIChatMessage(session_id) => {
            let result = worker.delete_ai_chat_message(session_id);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::GetAIDocsSimilarity {
            query,
            docs,
            threshold,
        } => {
            let result = worker.get_ai_docs_similarity(query, docs, threshold);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::GetYoutubeTranscript(video_url) => {
            let result = worker.get_youtube_transcript(video_url);
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::RunMigration => {
            // TODO: implement migration handling
        }
        MiscMessage::SendEventBusMessage(message) => worker.send_event_bus_message(message),
        MiscMessage::SetSurfBackendHealth(state) => {
            worker.surf_backend_health.set_health(state);
            send_worker_response(&mut worker.channel, oneshot, Ok(()));
            tracing::debug!("surf backend health: {state:?}");
        }
        MiscMessage::SearchChatResources {
            query,
            model,
            custom_key,
            number_documents,
            resource_ids,
        } => {
            let result = worker.search_chat_resources(
                query,
                model,
                custom_key,
                number_documents,
                resource_ids,
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
    }
}
