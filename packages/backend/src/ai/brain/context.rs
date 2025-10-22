use crate::{
    ai::{
        brain::{
            agents::context::ContextManager,
            js_tools::{JSToolRegistry, ToolName},
        },
        llm::models::{ContextMessage, Message},
        youtube::{fetch_transcript, is_youtube_video_url},
    },
    store::{db::Database, models::CompositeResource},
    BackendError, BackendResult,
};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct ContextItem {
    message: ContextMessage,
    resource_id: Option<String>,
    resource_text_content_id: Option<String>,
}

impl ContextItem {
    pub fn to_citation(&self, cited_text: &str) -> String {
        let mut timestamp = String::new();
        let mut url = String::new();
        let mut page = String::new();
        let mut uid = String::new();
        let mut resource_id = String::new();
        if let Some(ts) = &self.message.timestamp {
            timestamp = ts.to_string();
        }
        if let Some(u) = &self.message.source_url {
            url = u.to_string();
        }
        if let Some(p) = self.message.page {
            page = p.to_string();
        }
        if let Some(id) = &self.resource_text_content_id {
            uid = id.to_string();
        }
        if let Some(rid) = &self.resource_id {
            resource_id = rid.clone();
        }

        format!("<citation data-text=\"{}\" data-uid=\"{}\" data-resource-id=\"{}\" data-timestamp=\"{}\" data-url=\"{}\" data-page=\"{}\">{}</citation>", 
            html_escape::encode_safe(cited_text),
            uid,
            resource_id,
            timestamp,
            html_escape::encode_safe(&url),
            page,
            self.message.id
        )
    }

    pub fn to_xml(&self) -> String {
        let mut timestamp = String::new();
        let mut url = String::new();
        let mut page = String::new();
        let mut uid = String::new();
        let mut resource_id = String::new();
        if let Some(ts) = &self.message.timestamp {
            timestamp = ts.to_string();
        }
        if let Some(u) = &self.message.source_url {
            url = u.to_string();
        }
        if let Some(p) = self.message.page {
            page = p.to_string();
        }
        if let Some(id) = &self.resource_text_content_id {
            uid = id.to_string();
        }
        if let Some(rid) = &self.resource_id {
            resource_id = rid.clone();
        }
        format!(
            "
<source>
    <id>{}</id>
    <uid>{}</uid>
    <resource_id>{}</resource_id>
    <metadata>
        <timestamp>{}</timestamp>
        <url>{}</url>
        <page>{}</page>
    </metadata>
</source>\n",
            self.message.id, uid, resource_id, timestamp, url, page
        )
    }
}

// TODO: need to have a cache of urls -> content
// maybe use the kv store?
pub struct LLMContext {
    note_id: String,
    context_items: HashMap<String, ContextItem>,
    inline_images: Vec<String>,
    user_lang_preference: Option<String>,
    js_tool_registry: Arc<JSToolRegistry>,
    // TODO: not have a new database connection for each context
    db: Database,
}

// TODO: should we move this to js_tools.rs?
#[derive(serde::Deserialize, Debug, Clone)]
pub struct ScrapeWebpageResult {
    pub title: String,
    pub content: Option<String>,
    pub raw_html: Option<String>,
    pub screenshot: Option<String>, // base64 encoded
}

impl LLMContext {
    pub fn new(
        db_path: &str,
        js_tool_registry: Arc<JSToolRegistry>,
        note_id: String,
        resource_ids: &[String],
        inline_images: &[String],
        user_lang_preference: Option<String>,
    ) -> BackendResult<Self> {
        let db = Database::new(db_path, false)?;
        let resources = db.list_resources_metadata_by_ids(&resource_ids)?;
        let context_items = Self::context_metadata_messages_from_resources(&resources);

        let mut llm_context = Self {
            note_id: note_id.clone(),
            js_tool_registry,
            context_items: context_items.clone(),
            inline_images: inline_images.to_vec(),
            db,
            user_lang_preference,
        };
        if context_items.len() <= 5 {
            for ci in context_items.values() {
                llm_context.add_resource_text_content(&ci.message.id)?;
            }
        }
        Ok(llm_context)
    }

    fn check_note_id(&self, key: &str) -> BackendResult<()> {
        if self.note_id == key {
            Ok(())
        } else {
            Err(BackendError::GenericError("Note ID mismatch".to_string()))
        }
    }

    fn context_metadata_messages_from_resources(
        resources: &[CompositeResource],
    ) -> HashMap<String, ContextItem> {
        let mut messages = HashMap::new();
        for (i, resource) in resources.iter().enumerate() {
            let id = i.to_string();
            let mut msg = ContextMessage {
                // we don't use the actual resource id as it's a uuid
                // which is too long, use simple index instead
                id: id.clone(),
                content_type: format!(
                    "Context({})",
                    resource.resource.get_human_readable_type().clone()
                ),
                created_at: Some(resource.resource.created_at.to_string()),
                page: None,
                content: None,
                title: None,
                source_url: None,
                author: None,
                description: None,
                timestamp: None,
            };
            if let Some(metadata) = &resource.metadata {
                if !metadata.name.is_empty() {
                    msg.title = Some(metadata.name.clone());
                }
                if !metadata.source_uri.is_empty() {
                    msg.source_url = Some(metadata.source_uri.clone());
                }
                if !metadata.alt.is_empty() {
                    msg.description = Some(metadata.alt.clone());
                }
            }
            messages.insert(
                id,
                ContextItem {
                    message: msg,
                    resource_id: Some(resource.resource.id.clone()),
                    resource_text_content_id: None,
                },
            );
        }
        messages
    }

    // this fetches resource text content from the db & adds each piece as separate context items
    fn add_resource_text_content(&mut self, context_id: &str) -> BackendResult<()> {
        let mut insert_at = self.context_items.len();
        if let Some(context_item) = self.context_items.get_mut(context_id) {
            if context_item.resource_id.is_none() {
                // TODO: is this a non-error?
                return Ok(());
            }
            let resource_id = context_item.resource_id.as_ref().unwrap();
            let text_contents = self
                .db
                .list_resource_text_content_by_resource_id(resource_id)?;

            if text_contents.is_empty() {
                return Ok(());
            }

            if let Some(first_text_content) = text_contents.first() {
                context_item.message.content = Some(first_text_content.content.clone());
                context_item.resource_text_content_id = Some(first_text_content.id.clone());
                if let Some(timestamp) = &first_text_content.metadata.timestamp {
                    context_item.message.timestamp = Some(timestamp.clone().to_string());
                }
                if let Some(url) = &first_text_content.metadata.url {
                    context_item.message.source_url = Some(url.clone());
                }
                if let Some(page) = &first_text_content.metadata.page {
                    context_item.message.page = Some(*page);
                }
            }

            let mut insertions = HashMap::<String, ContextItem>::new();
            for (i, text_content) in text_contents.iter().skip(1).enumerate() {
                let new_context_id = format!("{}", insert_at);
                insert_at += 1;

                let mut new_message = context_item.message.clone();
                new_message.id = new_context_id.clone();
                new_message.content = Some(text_content.content.clone());
                new_message.content_type = format!("{} (Part {})", new_message.content_type, i + 2);
                if let Some(timestamp) = text_content.metadata.timestamp {
                    new_message.timestamp = Some(timestamp.clone().to_string());
                }
                if let Some(url) = &text_content.metadata.url {
                    new_message.source_url = Some(url.clone());
                }
                if let Some(page) = text_content.metadata.page {
                    new_message.page = Some(page);
                }

                let new_context_item = ContextItem {
                    message: new_message,
                    resource_id: Some(resource_id.clone()),
                    resource_text_content_id: Some(text_content.id.clone()),
                };
                insertions.insert(new_context_id, new_context_item);
            }
            self.context_items.extend(insertions);
        }
        Ok(())
    }
}

impl ContextManager for LLMContext {
    fn get_context(&self, key: &str) -> BackendResult<Vec<Message>> {
        self.check_note_id(key)?;

        let mut messages: Vec<Message> = vec![];
        self.context_items.values().for_each(|ci| {
            // TODO: should we skip errors or not?
            if let Ok(msg) = Message::new_context(&ci.message) {
                messages.push(msg);
            }
        });
        // TODO: should images be separate?
        self.inline_images.iter().for_each(|i| {
            messages.push(Message::new_image(i));
        });
        Ok(messages)
    }

    fn remove_context_messages(&mut self, key: &str, context_ids: &[String]) -> BackendResult<()> {
        self.check_note_id(key)?;
        for id in context_ids {
            self.context_items.remove(id);
        }
        Ok(())
    }

    // TODO: text content can be multiple for single resource, we need to find the right way
    fn populate_context_content(&mut self, key: &str, message_ids: &[String]) -> BackendResult<()> {
        self.check_note_id(key)?;
        for msg_id in message_ids {
            self.add_resource_text_content(msg_id)?;
        }
        Ok(())
    }

    fn add_resources(&mut self, key: &str, resource_ids: &[String]) -> BackendResult<()> {
        self.check_note_id(key)?;
        let resources = self.db.list_resources_metadata_by_ids(
            &resource_ids
                .iter()
                .map(|s| s.to_string())
                .collect::<Vec<String>>(),
        )?;
        let new_items = Self::context_metadata_messages_from_resources(&resources);
        for (id, context_item) in new_items {
            self.context_items.insert(id, context_item);
        }
        Ok(())
    }

    // TODO: can't really ignore the key in check in the trait impl but it's fine for now
    fn add_url(&mut self, _key: &str, url: &str) -> BackendResult<()> {
        let (content_type, title, content, _screenshot) = if is_youtube_video_url(url) {
            let yt_transcript = fetch_transcript(url, self.user_lang_preference.as_deref())?;
            (
                "Context(YouTube Transcript)",
                None,
                Some(yt_transcript.transcript),
                None,
            )
        } else {
            let result: ScrapeWebpageResult = self
                .js_tool_registry
                .execute_tool(&ToolName::ScrapeURL, Some(vec![url.to_string()]))?;
            (
                "Context(Webpage)",
                Some(result.title),
                result.content,
                result.screenshot,
            )
        };

        let msg = ContextMessage {
            id: format!("{}", self.context_items.len()),
            content_type: content_type.to_string(),
            title,
            content,
            source_url: Some(url.to_string()),
            page: None,
            author: None,
            description: None,
            created_at: None,
            timestamp: None,
        };

        self.context_items.insert(
            msg.id.clone(),
            ContextItem {
                message: msg,
                resource_id: None,
                resource_text_content_id: None,
            },
        );
        Ok(())
    }

    fn add_urls(&mut self, key: &str, urls: &[String]) -> BackendResult<Vec<BackendResult<()>>> {
        self.check_note_id(key)?;
        let mut results = Vec::new();
        for url in urls {
            let result = self.add_url(key, url);
            results.push(result);
        }
        Ok(results)
    }

    fn get_sources_xml(&self, key: &str) -> BackendResult<String> {
        self.check_note_id(key)?;
        let mut xml = "<sources>\n".to_string();
        for ci in self.context_items.values() {
            xml.push_str(&ci.to_xml());
        }
        xml.push_str("</sources>\n");
        Ok(xml)
    }

    fn get_citation(&self, key: &str, message_id: &str, cited_text: &str) -> BackendResult<String> {
        self.check_note_id(key)?;
        if let Some(ci) = self.context_items.get(message_id) {
            Ok(ci.to_citation(cited_text))
        } else {
            Err(BackendError::GenericError(
                "Message ID not found".to_string(),
            ))
        }
    }
}
