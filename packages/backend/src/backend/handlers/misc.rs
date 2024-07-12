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
    ) -> BackendResult<()> {
        // TODO: save this runtime somewhere and re-use when needed
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let mut stream = self
                    .ai
                    .chat(query, session_id, number_documents, model, rag_only, api_endpoint, resource_ids)
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
        let prompt = QUERY_SFFS_RESOURCES_PROMPT.replace("{{QUERY}}", &prompt);
        let session_id = random_uuid();
        let session_id_clone = session_id.clone();

        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let mut result = String::new();
                let mut stream = self
                    .ai
                    .chat(prompt, session_id_clone, 1, "".to_owned(), false, None, Some(vec![]))
                    .await?;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Err(err) => return Err(err),
                        Ok(None) => break,
                        Ok(Some(data)) => result += data.as_str(),
                    }
                }

                Ok(result)
            })?;

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
            // TODO: this is dumb, use regex or something
            result
                .replace("<sources>\n</sources>\n\n```json\n", "")
                .replace("\n```", "")
                .as_str(),
        )
        .map_err(|e| BackendError::GenericError(e.to_string()))?;

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

const QUERY_SFFS_RESOURCES_PROMPT: &str = "
You are an AI language model that generates SQL queries based on natural
language input. Additionally, if applicable, you generate special instructions
for an embedding model search to further narrow down the search space based on
filtered resource IDs from the SQL query. Below is the structure of our database
and the types of resources it stores. Use this information to create accurate
SQL queries and corresponding embedding model search instructions. The output
should be in JSON format and contain only the necessary fields.

### Database Schema:

#### Resources Table:
- `id` (TEXT, PRIMARY KEY)
- `resource_path` (TEXT, NOT NULL)
- `resource_type` (TEXT, NOT NULL)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted` (INTEGER, NOT NULL, DEFAULT 0)

#### Resource Types:
- Standard MIME types: `image/`, `video/`, etc.
- Custom types (enum):
  - POST: `application/vnd.space.post`
  - POST_REDDIT: `application/vnd.space.post.reddit`
  - POST_TWITTER: `application/vnd.space.post.twitter`
  - POST_YOUTUBE: `application/vnd.space.post.youtube`
  - CHAT_MESSAGE: `application/vnd.space.chat-message`
  - CHAT_MESSAGE_DISCORD: `application/vnd.space.chat-message.discord`
  - CHAT_MESSAGE_SLACK: `application/vnd.space.chat-message.slack`
  - CHAT_THREAD: `application/vnd.space.chat-thread`
  - CHAT_THREAD_SLACK: `application/vnd.space.chat-thread.slack`
  - DOCUMENT: `application/vnd.space.document`
  - DOCUMENT_SPACE_NOTE: `application/vnd.space.document.space-note`
  - DOCUMENT_NOTION: `application/vnd.space.document.notion`
  - DOCUMENT_GOOGLE_DOC: `application/vnd.space.document.google-doc`
  - TABLE: `application/vnd.space.table`
  - TABLE_GOOGLE_SHEET: `application/vnd.space.table.google-sheet`
  - TABLE_TYPEFORM: `application/vnd.space.table.typeform`
  - TABLE_COLUMN: `application/vnd.space.table-column`
  - TABLE_COLUMN_GOOGLE_SHEET: `application/vnd.space.table-column.google-sheet`
  - TABLE_COLUMN_TYPEFORM: `application/vnd.space.table-column.typeform`
  - ARTICLE: `application/vnd.space.article`
  - LINK: `application/vnd.space.link`

Note: To retrieve all resources of a specific category, use a wildcard match.
For example, to get all chat messages, use `resource_type LIKE 'application/vnd.space.chat-message%'`.

Note: By default, all queries should filter out deleted resources by including
`deleted = 0`. Only include deleted resources if the query explicitly mentions
it.

#### Resource Tags Table:
- `id` (TEXT, PRIMARY KEY)
- `resource_id` (TEXT, NOT NULL, REFERENCES resources(id) ON DELETE CASCADE)
- `tag_name` (TEXT, NOT NULL)
- `tag_value` (TEXT, NOT NULL)
- UNIQUE (`resource_id`, `tag_name`, `tag_value`)

#### Built-In Tags:
- `savedWithAction`: download, drag/browser, drag/local, paste, import
- `type`: string
- `deleted`: boolean
- `hostname`: string

### Examples:

1. **Query:** \"Retrieve all image resources created after 2023-01-01.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT id FROM resources WHERE resource_type LIKE 'image/%' AND created_at > '2023-01-01' AND deleted = 0;\"
   }
   ```

2. **Query:** \"Find all resources tagged with 'hostname: wikipedia.com' and not deleted.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT resource_id FROM resource_tags WHERE tag_name = 'hostname' AND tag_value = 'wikipedia.com' AND resource_id IN (SELECT id FROM resources WHERE deleted = 0);\"
   }
   ```

3. **Query:** \"Get all chat messages saved with the action 'paste'.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT resource_id FROM resource_tags WHERE tag_name = 'savedWithAction' AND tag_value = 'paste' AND resource_id IN (SELECT id FROM resources WHERE resource_type LIKE 'application/vnd.space.chat-message%' AND deleted = 0);\"
   }
   ```

4. **Query:** \"Retrieve all Slack chat messages that were created before 2023-01-01.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.chat-message.slack' AND created_at < '2023-01-01' AND deleted = 0;\"
   }
   ```

5. **Query:** \"Get all Google Docs that were imported and are deleted.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT resource_id FROM resource_tags WHERE tag_name = 'savedWithAction' AND tag_value = 'import' AND resource_id IN (SELECT id FROM resources WHERE resource_type = 'application/vnd.space.document.google-doc' AND deleted = 1);\"
   }
   ```

6. **Query:** \"Retrieve all resources created in the year 2023 and tagged with 'hostname: deta.space'.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT resource_id FROM resource_tags WHERE tag_name = 'hostname' AND tag_value = 'deta.space' AND resource_id IN (SELECT id FROM resources WHERE created_at BETWEEN '2023-01-01' AND '2023-12-31' AND deleted = 0);\"
   }
   ```

7. **Query:** \"Retrieve all PDFs mentioning/containing dogs.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/pdf' AND deleted = 0;\",
       \"embedding_search_query\": \"dogs\"
   }
   ```

8. **Query:** \"Find all documents that mention 'machine learning'.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT id FROM resources WHERE resource_type LIKE 'application/vnd.space.document%' AND deleted = 0;\",
       \"embedding_search_query\": \"machine learning\"
   }
   ```

9. **Query:** \"Retrieve all YouTube posts discussing 'climate change'.\"
   **Output:** 
   ```json
   {
       \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.post.youtube' AND deleted = 0;\",
       \"embedding_search_query\": \"climate change\"
   }
   ```

10. **Query:** \"Get all Slack chat messages about 'project X'.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.chat-message.slack' AND deleted = 0;\",
        \"embedding_search_query\": \"project X\"
    }
    ```

11. **Query:** \"Find all articles related to 'quantum computing'.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.article' AND deleted = 0;\",
        \"embedding_search_query\": \"quantum computing\"
    }
    ```

12. **Query:** \"Retrieve all Discord chat messages that discuss 'release schedules'.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.chat-message.discord' AND deleted = 0;\",
        \"embedding_search_query\": \"release schedules\"
    }
    ```

13. **Query:** \"Get all Google Sheets containing data on 'sales figures'.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.table.google-sheet' AND deleted = 0;\",
        \"embedding_search_query\": \"sales figures\"
    }
    ```

14. **Query:** \"Find all PDF documents mentioning 'artificial intelligence' created before 2022.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/pdf' AND created_at < '2022-01-01' AND deleted = 0;\",
        \"embedding_search_query\": \"artificial intelligence\"
    }
    ```

15. **Query:** \"Retrieve all Slack threads related to 'customer feedback'.\"
    **Output:** 
    ```json
    {
        \"sql_query\": \"SELECT id FROM resources WHERE resource_type = 'application/vnd.space.chat-thread.slack' AND deleted = 0;\",
        \"embedding_search_query\": \"customer feedback\"
    }
    ```
 
### Your Query:
{{QUERY}}

### Generated Output:
";
