use crate::{
    ai::ai::ChatHistory,
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

    pub fn send_chat_query(
        &self,
        channel: &mut Channel,
        query: String,
        session_id: String,
        number_documents: i32,
        model: String,
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
                    .chat(query, session_id, number_documents, model, api_endpoint,resource_ids)
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

    pub fn generate_space_query_sql(&self, prompt: String) -> BackendResult<String> {
        let prompt = GENERATE_SPACE_QUERY_SQL_PROMPT.replace("{{QUERY}}", &prompt);
        let session_id = random_uuid();
        let session_id_clone = session_id.clone();

        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async move {
                let mut result = String::new();
                let mut stream = self
                    .ai
                    .chat(prompt, session_id_clone, 1, "".to_owned(), Some(vec![]))
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

        // TODO: this is a lil dumb, would make more sense to have
        // a dedicated API endpoint on the embedchain api side
        Ok(result
            .replace("<sources>\n</sources>\n\n<answer>\n", "")
            .replace("</answer>", "")
            .replace("```sql\n", "")
            .replace("```\n", ""))
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
            resource_ids,
        } => {
            let result = worker.send_chat_query(
                channel,
                query,
                session_id,
                number_documents,
                model,
                api_endpoint,
                callback,
                resource_ids,
            );
            send_worker_response(channel, oneshot, result)
        }
        MiscMessage::GenerateSpaceQuerySql(prompt) => {
            send_worker_response(channel, oneshot, worker.generate_space_query_sql(prompt))
        }
    }
}

const GENERATE_SPACE_QUERY_SQL_PROMPT: &str = "
You are an AI language model that generates SQL queries based on natural
language input. Below is the structure of our database and the types of
resources it stores. Use this information to create accurate SQL queries that
retrieve resource IDs. The output should only contain SQL code.

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
For example, to get all chat messages, use `resource_type LIKE
'application/vnd.space.chat-message%'`.

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
   **SQL:** `SELECT id FROM resources WHERE resource_type LIKE 'image/%' AND created_at > '2023-01-01' AND deleted = 0;`

2. **Query:** \"Find all resources tagged with 'hostname: wikipedia.com' and not deleted.\"
   **SQL:** `SELECT resource_id FROM resource_tags WHERE tag_name = 'hostname' AND tag_value = 'example.com' AND resource_id IN (SELECT id FROM resources WHERE deleted = 0);`

3. **Query:** \"Get all chat messages saved with the action 'paste'.\"
   **SQL:** `SELECT resource_id FROM resource_tags WHERE tag_name = 'savedWithAction' AND tag_value = 'paste' AND resource_id IN (SELECT id FROM resources WHERE resource_type LIKE 'application/vnd.space.chat-message%' AND deleted = 0);`

4. **Query:** \"Retrieve all Slack chat messages that were created before 2023-01-01.\"
   **SQL:** `SELECT id FROM resources WHERE resource_type = 'application/vnd.space.chat-message.slack' AND created_at < '2023-01-01' AND deleted = 0;`

5. **Query:** \"Get all Google Docs that were imported and are deleted.\"
   **SQL:** `SELECT resource_id FROM resource_tags WHERE tag_name = 'savedWithAction' AND tag_value = 'import' AND resource_id IN (SELECT id FROM resources WHERE resource_type = 'application/vnd.space.document.google-doc' AND deleted = 1);`

6. **Query:** \"Retrieve all resources created in the year 2023 and tagged with 'hostname: deta.space'.\"
   **SQL:** `SELECT resource_id FROM resource_tags WHERE tag_name = 'hostname' AND tag_value = 'example.com' AND resource_id IN (SELECT id FROM resources WHERE created_at BETWEEN '2023-01-01' AND '2023-12-31' AND deleted = 0);`

### Your Query:
{{QUERY}}

Generate SQL queries based on these guidelines and examples. The output should only contain SQL code.
";
