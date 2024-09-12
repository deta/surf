use crate::{
    ai::ai::{
        DocsSimilarity, YoutubeTranscript, YoutubeTranscriptMetadata, YoutubeTranscriptPiece,
    },
    backend::{
        message::{MiscMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
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
use futures::StreamExt;
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
            messages: self.db.list_ai_session_messages(&id)?,
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

    pub fn create_app(
        &mut self,
        prompt: String,
        session_id: String,
        contexts: Option<Vec<String>>,
    ) -> BackendResult<String> {
        let user_message = AIChatSessionMessage {
            ai_session_id: session_id.clone(),
            role: "user".to_owned(),
            content: prompt.clone(),
            sources: None,
            created_at: chrono::Utc::now(),
        };
        let result = self.ai.create_app(prompt, session_id.clone(), contexts)?;
        let mut tx = self.db.begin()?;
        Database::create_ai_session_message_tx(&mut tx, &user_message)?;
        Database::create_ai_session_message_tx(
            &mut tx,
            &AIChatSessionMessage {
                ai_session_id: session_id.clone(),
                role: "assistant".to_owned(),
                content: result.clone(),
                sources: None,
                created_at: chrono::Utc::now(),
            },
        )?;
        tx.commit()?;
        Ok(result)
    }

    pub fn send_chat_query(
        &mut self,
        channel: &mut Channel,
        query: String,
        session_id: String,
        number_documents: i32,
        rag_only: bool,
        callback: Root<JsFunction>,
        resource_ids: Option<Vec<String>>,
        general: bool,
    ) -> BackendResult<()> {
        let user_message = AIChatSessionMessage {
            ai_session_id: session_id.to_owned(),
            role: "user".to_owned(),
            content: query.to_owned(),
            sources: None,
            created_at: chrono::Utc::now(),
        };

        if rag_only {
            self.handle_rag_only_query(
                channel,
                query,
                number_documents,
                resource_ids,
                callback,
                user_message,
            )
        } else {
            self.handle_full_chat_query(
                channel,
                query,
                session_id,
                number_documents,
                resource_ids,
                general,
                callback,
                user_message,
            )
        }
    }

    fn handle_rag_only_query(
        &mut self,
        channel: &mut Channel,
        query: String,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
        callback: Root<JsFunction>,
        user_message: AIChatSessionMessage,
    ) -> BackendResult<()> {
        let results = self.ai.vector_search(
            &self.db,
            query,
            number_documents as usize,
            resource_ids,
            false,
            None,
        )?;

        let (sources_str, sources) = self.process_search_results(&results)?;

        self.send_callback(channel, callback, sources_str)?;
        self.save_messages(user_message, String::new(), Some(sources))?;

        Ok(())
    }

    fn process_search_results(
        &self,
        results: &[CompositeResource],
    ) -> BackendResult<(String, Vec<AIChatSessionMessageSource>)> {
        let mut sources_str = String::from("<sources>");
        let mut sources = Vec::new();

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
            sources.push(source);
        }

        sources_str.push_str("</sources>\n<answer> </answer>");
        Ok((sources_str, sources))
    }

    fn handle_full_chat_query(
        &mut self,
        channel: &mut Channel,
        query: String,
        session_id: String,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
        general: bool,
        callback: Root<JsFunction>,
        user_message: AIChatSessionMessage,
    ) -> BackendResult<()> {
        let history = self
            .ai
            .format_chat_history(self.db.list_ai_session_messages(&session_id)?);
        let should_cluster = self.ai.should_cluster(&query)?;

        let (assistant_message, sources) = match self.async_runtime.block_on(async {
            tokio::time::timeout(
                std::time::Duration::from_secs(100),
                self.process_chat_stream(
                    channel,
                    callback,
                    query,
                    number_documents,
                    resource_ids,
                    general,
                    should_cluster,
                    history,
                ),
            )
            .await
        }) {
            Ok(Ok(result)) => result,
            Ok(Err(err)) => return Err(err),
            Err(_) => {
                return Err(BackendError::GenericError(
                    "Timeout while processing chat stream".to_string(),
                ))
            }
        };

        self.save_messages(user_message, assistant_message, Some(sources))?;

        Ok(())
    }

    async fn process_chat_stream(
        &self,
        channel: &mut Channel,
        mut callback: Root<JsFunction>,
        query: String,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
        general: bool,
        should_cluster: bool,
        history: Option<String>,
    ) -> BackendResult<(String, Vec<AIChatSessionMessageSource>)> {
        let (sources, preamble, mut stream) = self
            .ai
            .chat(
                &self.db,
                query,
                number_documents,
                resource_ids,
                general,
                should_cluster,
                history,
            )
            .await?;

        callback = self.send_callback(channel, callback, preamble)?;

        let mut assistant_message = String::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(data) => {
                    assistant_message.push_str(&data);
                    callback = self.send_callback(channel, callback, data)?;
                }
                Err(err) => return Err(err),
            }
        }

        Ok((assistant_message, sources))
    }

    fn send_callback(
        &self,
        channel: &mut Channel,
        callback: Root<JsFunction>,
        data: String,
    ) -> BackendResult<Root<JsFunction>> {
        channel
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

    fn save_messages(
        &mut self,
        user_message: AIChatSessionMessage,
        assistant_message: String,
        sources: Option<Vec<AIChatSessionMessageSource>>,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::create_ai_session_message_tx(&mut tx, &user_message)?;
        Database::create_ai_session_message_tx(
            &mut tx,
            &AIChatSessionMessage {
                ai_session_id: user_message.ai_session_id.clone(),
                role: "assistant".to_owned(),
                content: assistant_message,
                sources,
                created_at: chrono::Utc::now(),
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
        sql_query: Option<String>,
        embedding_query: Option<String>,
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
                    .get_sql_query(prompt)?
                    .replace("```json", "")
                    .replace("```", "")
                    .as_str(),
            )
            .map_err(|e| BackendError::GenericError(e.to_string()))?,
        };
        let mut resource_ids_first: HashSet<String> = HashSet::new();
        let mut resource_ids_stmt = self.db.conn.prepare(result.sql_query.as_str())?;
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
            // TODO: why 100?
            let resources = self.ai.vector_search(
                &self.db,
                query.clone(),
                100,
                Some(filter),
                true,
                Some(0.4),
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
}

#[tracing::instrument(level = "trace", skip(worker, channel, oneshot))]
pub fn handle_misc_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: MiscMessage,
) {
    match message {
        MiscMessage::Print(content) => {
            send_worker_response(channel, oneshot, worker.print(content))
        }
        MiscMessage::GetAIChatMessage(id) => {
            send_worker_response(channel, oneshot, worker.get_ai_chat_message(id))
        }
        MiscMessage::CreateAIChatMessage(system_prompot) => send_worker_response(
            channel,
            oneshot,
            worker.create_ai_chat_message(system_prompot),
        ),
        MiscMessage::ChatQuery {
            query,
            session_id,
            number_documents,
            callback,
            rag_only,
            resource_ids,
            general,
        } => {
            let result = worker.send_chat_query(
                channel,
                query,
                session_id,
                number_documents,
                rag_only,
                callback,
                resource_ids,
                general,
            );
            send_worker_response(channel, oneshot, result)
        }
        MiscMessage::CreateApp {
            prompt,
            session_id,
            contexts,
        } => send_worker_response(
            channel,
            oneshot,
            worker.create_app(prompt, session_id, contexts),
        ),
        MiscMessage::QuerySFFSResources(prompt, sql_query, embedding_query) => {
            send_worker_response(
                channel,
                oneshot,
                worker.query_sffs_resources(prompt, sql_query, embedding_query),
            )
        }
        MiscMessage::GetAIChatDataSource(source_hash) => send_worker_response(
            channel,
            oneshot,
            worker.get_ai_chat_data_source(source_hash),
        ),
        MiscMessage::DeleteAIChatMessage(session_id) => {
            send_worker_response(channel, oneshot, worker.delete_ai_chat_message(session_id))
        }
        MiscMessage::GetAIDocsSimilarity {
            query,
            docs,
            threshold,
        } => send_worker_response(
            channel,
            oneshot,
            worker.get_ai_docs_similarity(query, docs, threshold),
        ),
        MiscMessage::GetYoutubeTranscript(video_url) => {
            send_worker_response(channel, oneshot, worker.get_youtube_transcript(video_url))
        }
        MiscMessage::RunMigration => {
            let result = worker.migrate_data("sffs.sqlite");
            if result.is_err() {
                eprintln!("Failed to run migration: {:?}", result);
            }
            send_worker_response(channel, oneshot, result)
        }
    }
}
