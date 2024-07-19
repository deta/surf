use crate::{
    ai::ai::{ChatHistory, DataSourceChunk, DocsSimilarity, YoutubeTranscript},
    backend::{
        message::{MiscMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::{
        db::Database,
        models::{random_uuid, AIChatSession},
    },
    BackendError, BackendResult,
};
use futures::StreamExt;
use neon::prelude::*;

impl Worker {
    pub fn print(&mut self, content: String) -> BackendResult<String> {
        println!("print: {}", content);
        Ok("ok".to_owned())
    }

    pub fn get_ai_chat_message(&mut self, id: String, api_endpoint: Option<String>) -> BackendResult<ChatHistory> {
        Ok(self.ai.get_chat_history(id, api_endpoint)?)
    }

    pub fn create_ai_chat_message(&mut self, system_prompt: String) -> BackendResult<String> {
        let new_chat = AIChatSession {
            id: random_uuid(),
            system_prompt,
        };
        let mut tx = self.db.begin()?;
        Database::create_ai_chat_session_tx(&mut tx, &new_chat)?;
        tx.commit()?;
        Ok(new_chat.id)
    }

    pub fn delete_ai_chat_message(&mut self, session_id: String) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::delete_ai_chat_session_tx(&mut tx, &session_id)?;
        self.ai.delete_chat_history(session_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn get_ai_docs_similarity(&mut self, query: String, docs: Vec<String>, threshold: Option<f32>) -> BackendResult<Vec<DocsSimilarity>> {
        Ok(self.ai.get_docs_similarity(query, docs, threshold)?)
    }

    pub fn create_app(
        &mut self,
        prompt: String,
        session_id: String,
        contexts: Option<Vec<String>>,
    ) -> BackendResult<String> {
        Ok(self.ai.create_app(prompt, session_id, contexts)?)
    }

    pub fn send_chat_query(
        &self,
        channel: &mut Channel,
        query: String,
        session_id: String,
        number_documents: i32,
        model: String,
        rag_only: bool,
        api_endpoint: Option<String>,
        mut callback: Root<JsFunction>,
        resource_ids: Option<Vec<String>>,
        general: bool,
    ) -> BackendResult<()> {
        // TODO: save this runtime somewhere and re-use when needed
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let mut stream = self
                    .ai
                    .chat(query, session_id, number_documents, model, rag_only, api_endpoint, resource_ids, general)
                    .await?;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Err(err) => return Err(err),
                        Ok(None) => break,
                        Ok(Some(data)) => {
                            callback = channel
                                .send(|mut cx| {
                                    let f = callback.into_inner(&mut cx);
                                    let this = cx.undefined();
                                    let args = vec![cx.string(data).upcast::<JsValue>()];
                                    f.call(&mut cx, this, args).unwrap();
                                    Ok(f.root(&mut cx))
                                })
                                .join()
                                .map_err(|err| BackendError::GenericError(err.to_string()))?;
                        }
                    }
                }

                Ok(())
            })
    }

    pub fn get_youtube_transcript(&self, video_url: String) -> BackendResult<YoutubeTranscript> {
        Ok(self.ai.get_youtube_transcript(&video_url)?)
    }

    pub fn query_sffs_resources(&self, prompt: String) -> BackendResult<String> {
        let result = self.ai.get_sql_query(prompt)?;
        #[derive(serde::Deserialize)]
        struct JsonResult {
            sql_query: String,
            embedding_search_query: Option<String>,
        }
        #[derive(serde::Serialize)]
        struct FunctionResult {
            sql_query: String,
            embedding_search_query: Option<String>,
            sql_query_results: Vec<String>,
            embedding_search_results: Option<Vec<String>>,
        }

        let result = serde_json::from_str::<JsonResult>(
            result
                .replace("```json", "")
                .replace("```", "")
                .as_str()
            ).map_err(|e| BackendError::GenericError(e.to_string()))?;

        let mut resource_ids_first = Vec::new();
        let mut resource_ids_stmt = self.db.conn.prepare(result.sql_query.as_str())?;
        let mut resource_ids_rows = resource_ids_stmt.query([])?;
        let mut resource_ids_second = None;

        while let Some(row) = resource_ids_rows.next()? {
            resource_ids_first.push(row.get(0)?);
        }

        if let Some(ref query) = result.embedding_search_query {
            resource_ids_second = Some(
                self.ai
                    .get_resources(query.clone(), resource_ids_first.clone())?,
            );
        }

        serde_json::to_string(&FunctionResult {
            sql_query: result.sql_query.clone(),
            embedding_search_query: result.embedding_search_query.clone(),
            sql_query_results: resource_ids_first,
            embedding_search_results: resource_ids_second,
        })
        .map_err(|e| BackendError::GenericError(e.to_string()))
    }

    pub fn get_ai_chat_data_source(&self, source_hash: String) -> BackendResult<DataSourceChunk> {
        Ok(self.ai.get_data_source(&source_hash.to_owned())?)
    }
}

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
        MiscMessage::GetAIChatMessage(id, api_endpoint) => send_worker_response(
            channel,
            oneshot,
            worker.get_ai_chat_message(id, api_endpoint),
        ),
        MiscMessage::CreateAIChatMessage(system_prompot) => send_worker_response(
            channel,
            oneshot,
            worker.create_ai_chat_message(system_prompot),
        ),
        MiscMessage::ChatQuery {
            query,
            session_id,
            number_documents,
            model,
            callback,
            rag_only,
            api_endpoint,
            resource_ids,
            general,
        } => {
            let result = worker.send_chat_query(
                channel,
                query,
                session_id,
                number_documents,
                model,
                rag_only,
                api_endpoint,
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
        } => {
            send_worker_response(channel, oneshot, worker.create_app(prompt, session_id, contexts))
        }
        MiscMessage::QuerySFFSResources(prompt) => {
            send_worker_response(channel, oneshot, worker.query_sffs_resources(prompt))
        }
        MiscMessage::GetAIChatDataSource(source_hash) => {
            send_worker_response(channel, oneshot, worker.get_ai_chat_data_source(source_hash))
        }
        MiscMessage::DeleteAIChatMessage(session_id) => {
            send_worker_response(channel, oneshot, worker.delete_ai_chat_message(session_id))
        }
        MiscMessage::GetAIDocsSimilarity{
            query,
            docs,
            threshold,
        } => {
            send_worker_response(channel, oneshot, worker.get_ai_docs_similarity(query, docs, threshold))
        }
        MiscMessage::GetYoutubeTranscript(video_url) => {
            send_worker_response(channel, oneshot, worker.get_youtube_transcript(video_url))
        }
    }
}
