use crate::{
    ai::ai::{
        ChatResult, DocsSimilarity, YoutubeTranscript, YoutubeTranscriptMetadata,
        YoutubeTranscriptPiece,
    },
    backend::{
        message::{MiscMessage, ProcessorMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    llm::{
        client::client::Model,
        models::{Message, MessageContent, Quota},
    },
    store::{
        db::{CompositeResource, Database},
        models::{
            random_uuid, AIChatHistory, AIChatSession, AIChatSessionMessage,
            AIChatSessionMessageSource, ResourceTextContent,
        },
    },
    BackendError, BackendResult,
};
use neon::prelude::*;
use std::collections::HashSet;

impl Worker {
    pub fn print(&mut self, content: String) -> BackendResult<String> {
        println!("print: {}", content);
        Ok("ok".to_owned())
    }

    pub fn get_ai_chat_message(&mut self, id: String) -> BackendResult<AIChatHistory> {
        Ok(AIChatHistory {
            id: id.clone(),
            messages: self.db.list_non_context_ai_session_messages(&id)?,
        })
    }

    pub fn create_ai_chat_message(&mut self, system_prompt: String) -> BackendResult<String> {
        let new_chat = AIChatSession {
            id: random_uuid(),
            system_prompt,
        };
        let mut tx = self.db.begin()?;
        Database::create_ai_session_tx(&mut tx, &new_chat)?;
        tx.commit()?;
        Ok(new_chat.id)
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
        Ok(self.ai.get_docs_similarity(query, docs, threshold)?)
    }

    // TODO: store history
    pub fn create_app(
        &mut self,
        prompt: String,
        model: &Model,
        custom_key: Option<&str>,
        session_id: String,
        contexts: Option<Vec<String>>,
    ) -> BackendResult<String> {
        let user_message = AIChatSessionMessage {
            ai_session_id: session_id.clone(),
            role: "user".to_owned(),
            content: prompt.clone(),
            truncatable: false,
            created_at: chrono::Utc::now(),
            msg_type: "text".to_owned(),
            is_context: false,
            sources: None,
        };
        let result = self
            .ai
            .create_app(prompt, model, custom_key, session_id.clone(), contexts)?;
        let mut tx = self.db.begin()?;
        Database::create_ai_session_message_tx(&mut tx, &user_message)?;
        Database::create_ai_session_message_tx(
            &mut tx,
            &AIChatSessionMessage {
                ai_session_id: session_id.clone(),
                role: "assistant".to_owned(),
                truncatable: false,
                is_context: false,
                msg_type: "text".to_owned(),
                content: result.clone(),
                created_at: chrono::Utc::now(),
                sources: None,
            },
        )?;
        tx.commit()?;
        Ok(result)
    }

    pub fn create_chat_completion(
        &mut self,
        messages: Vec<Message>,
        model: Model,
        custom_key: Option<&str>,
        _response_format: Option<&str>,
    ) -> BackendResult<String> {
        self.ai
            .client
            .create_chat_completion(messages, &model, custom_key, None)
    }

    pub fn send_chat_query(
        &mut self,
        query: String,
        model: Model,
        custom_key: Option<&str>,
        session_id: String,
        number_documents: i32,
        rag_only: bool,
        callback: Root<JsFunction>,
        resource_ids: Option<Vec<String>>,
        inline_images: Option<Vec<String>>,
        general: bool,
    ) -> BackendResult<()> {
        // frontend sends a query with a trailing <p></p> for some reason
        let query = match query.strip_suffix("<p></p>") {
            Some(q) => q.to_string(),
            None => query,
        };
        if rag_only {
            return self.handle_rag_only_query(query, number_documents, resource_ids, callback);
        }

        if !general && resource_ids.is_none() {
            return Err(BackendError::GenericError(
                "Resource ids must be provided for non-general queries".to_string(),
            ));
        }

        self.handle_full_chat_query(
            query,
            &model,
            custom_key,
            session_id,
            number_documents,
            resource_ids.unwrap_or(vec![]),
            inline_images,
            general,
            callback,
        )
    }

    // TODO: store history
    fn handle_rag_only_query(
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
        if ids.len() > 0 {
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
        query: String,
        model: &Model,
        custom_key: Option<&str>,
        session_id: String,
        number_documents: i32,
        mut resource_ids: Vec<String>,
        inline_images: Option<Vec<String>>,
        general: bool,
        callback: Root<JsFunction>,
    ) -> BackendResult<()> {
        let history = self
            .ai
            .parse_chat_history(self.db.list_ai_session_messages_skip_sources(&session_id)?)?;

        let mut should_cluster = false;
        let send_cluster_query = !general && self.should_send_cluster_query(&resource_ids)?;

        if send_cluster_query {
            let composite_resources = self.db.list_resources_metadata_by_ids(&resource_ids)?;
            let should_cluster_result = self.ai.should_cluster(
                &query,
                model,
                custom_key,
                self.ai
                    .llm_metadata_messages_from_sources(&composite_resources),
            )?;
            should_cluster = should_cluster_result.embeddings_search_needed;
            // we are already narrowing down the search space
            // if the llm pre-determines the search space
            if let Some(search_space) = should_cluster_result.relevant_context_ids {
                if search_space.len() > 0 {
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
                    resource_ids = pruned_resources_ids;
                }
            }
        }

        let (assistant_message, chat_result) = self.process_chat_stream(
            callback,
            query,
            model,
            custom_key,
            number_documents,
            resource_ids,
            inline_images,
            general,
            should_cluster,
            history,
        )?;
        self.save_messages(session_id, assistant_message, chat_result)?;

        Ok(())
    }

    fn process_chat_stream(
        &self,
        mut callback: Root<JsFunction>,
        query: String,
        model: &Model,
        custom_key: Option<&str>,
        number_documents: i32,
        resource_ids: Vec<String>,
        inline_images: Option<Vec<String>>,
        general: bool,
        should_cluster: bool,
        history: Vec<Message>,
    ) -> BackendResult<(String, ChatResult)> {
        let mut chat_result = self.ai.chat(
            &self.db,
            query,
            model,
            custom_key,
            number_documents,
            resource_ids,
            inline_images,
            general,
            should_cluster,
            history,
        )?;

        callback = self.send_callback(callback, chat_result.sources_xml.clone())?;

        let mut assistant_message = String::new();
        while let Some(chunk) = chat_result.stream.next() {
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
                f.call(&mut cx, this, args).unwrap();
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
        let transcript_config = match self.language_setting.as_str() {
            "en" => Some(ytranscript::TranscriptConfig {
                lang: Some("en".to_string()),
            }),
            _ => None,
        };

        let transcripts = self
            .async_runtime
            .block_on(ytranscript::YoutubeTranscript::fetch_transcript(
                &video_url,
                transcript_config,
            ))
            .map_err(|e| BackendError::GenericError(e.to_string()))?;
        let mut all = String::new();
        let mut transcript_pieces: Vec<YoutubeTranscriptPiece> = vec![];
        for transcript in transcripts {
            all.push_str(transcript.text.as_str());
            transcript_pieces.push(YoutubeTranscriptPiece {
                text: transcript.text,
                start: transcript.offset as f32,
                duration: transcript.duration as f32,
            });
        }
        Ok(YoutubeTranscript {
            transcript: all,
            metadata: YoutubeTranscriptMetadata {
                source: video_url,
                transcript_pieces,
            },
        })
    }

    pub fn query_sffs_resources(
        &self,
        prompt: String,
        model: &Model,
        custom_key: Option<&str>,
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
                std::iter::repeat("?")
                    .take(resource_ids_first.len())
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
        Ok(self.db.get_resource_text_content(&source_id)?)
    }

    pub fn get_quotas(&self) -> BackendResult<Vec<Quota>> {
        self.ai.get_quotas()
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
        MiscMessage::CreateAIChatMessage(system_prompot) => {
            let result = worker.create_ai_chat_message(system_prompot);
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
                custom_key.as_deref(),
                response_format.as_deref(),
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::ChatQuery {
            query,
            model,
            custom_key,
            session_id,
            number_documents,
            callback,
            rag_only,
            resource_ids,
            inline_images,
            general,
        } => {
            let result = worker.send_chat_query(
                query,
                model,
                custom_key.as_deref(),
                session_id,
                number_documents,
                rag_only,
                callback,
                resource_ids,
                inline_images,
                general,
            );
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::CreateApp {
            prompt,
            model,
            custom_key,
            session_id,
            contexts,
        } => {
            let result =
                worker.create_app(prompt, &model, custom_key.as_deref(), session_id, contexts);
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
                custom_key.as_deref(),
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
            let result = worker.migrate_data("sffs.sqlite");
            if result.is_err() {
                eprintln!("Failed to run migration: {:?}", result);
            }
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::SendEventBusMessage(message) => worker.send_event_bus_message(message),
        MiscMessage::GetQuotas => {
            let result = worker.get_quotas();
            send_worker_response(&mut worker.channel, oneshot, result)
        }
        MiscMessage::SetVisionTaggingFlag(bool) => {
            let result = worker
                .tqueue_tx
                .try_send(ProcessorMessage::SetVisionTaggingFlag(bool))
                .map_err(|err| BackendError::GenericError(format!("{err}")));
            send_worker_response(&mut worker.channel, oneshot, result)
        }
    }
}
