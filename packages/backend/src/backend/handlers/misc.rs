use crate::{
    ai::ai::ChatHistory, backend::{
        message::{MiscMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    }, store::{db::Database, models::{random_uuid, AIChatSession}}, BackendError, BackendResult
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

    pub fn send_chat_query(
        &self,
        channel: &mut Channel,
        query: String,
        session_id: String,
        number_documents: i32,
        model: String,
        api_endpoint: Option<String>,
        mut callback: Root<JsFunction>,
    ) -> BackendResult<()> {
        // TODO: save this runtime somewhere and re-use when needed
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let mut stream = self
                    .ai
                    .chat(query, session_id, number_documents, model, api_endpoint)
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
            api_endpoint,
        } => {
            let result = worker.send_chat_query(
                channel,
                query,
                session_id,
                number_documents,
                model,
                api_endpoint,
                callback,
            );
            send_worker_response(channel, oneshot, result)
        }
    }
}
