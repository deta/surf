use rusqlite::types::FromSql;
use rusqlite::ToSql;
use serde::{Deserialize, Serialize};
use url::Url;

use std::fmt::Display;
use std::str::FromStr;
use std::string::ToString;
use strum_macros::EnumString;

use crate::{BackendError, BackendResult};

pub fn default_horizon_tint() -> String {
    "hsl(275, 40%, 80%)".to_owned()
}

pub fn current_time() -> chrono::DateTime<chrono::Utc> {
    chrono::Utc::now()
}

pub fn random_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn parse_datetime_from_str(
    datetime: &str,
) -> Result<chrono::DateTime<chrono::Utc>, chrono::ParseError> {
    let format = "%Y-%m-%d %H:%M:%S";
    let ut = chrono::DateTime::parse_from_str(datetime, format)?;
    Ok(ut.with_timezone(&chrono::Utc))
}

fn get_hostname_from_uri(uri: &str) -> Option<String> {
    Url::parse(uri)
        .ok()
        .and_then(|url| url.host_str().map(|host| host.to_owned()))
}

pub trait EmbeddableContent {
    fn get_resource_id(&self) -> String;
    fn get_embeddable_content(&self) -> Vec<String>;
    fn get_embedding_type(&self) -> EmbeddingType;
}

#[derive(Debug, PartialEq, EnumString, Clone)]
#[strum(serialize_all = "snake_case")]
pub enum EmbeddingType {
    Metadata,
    TextContent,
}

impl Display for EmbeddingType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EmbeddingType::Metadata => write!(f, "metadata"),
            EmbeddingType::TextContent => write!(f, "text_content"),
        }
    }
}

impl ToSql for EmbeddingType {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(rusqlite::types::ToSqlOutput::from(self.to_string()))
    }
}

impl FromSql for EmbeddingType {
    fn column_result(value: rusqlite::types::ValueRef) -> rusqlite::types::FromSqlResult<Self> {
        let s = String::column_result(value)?;
        EmbeddingType::from_str(&s).map_err(|_| rusqlite::types::FromSqlError::InvalidType)
    }
}

#[derive(Debug, PartialEq, Serialize, Deserialize, EnumString, Clone)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "lowercase")]
pub enum SpaceEntryType {
    Resource,
    Space,
}

#[derive(
    strum_macros::Display, Debug, Eq, PartialEq, EnumString, Serialize, Deserialize, Clone, Hash,
)]
#[strum(serialize_all = "snake_case")]
pub enum ResourceTextContentType {
    Annotation,
    Article,
    ChatMessage,
    ChatThread,
    Document,
    Image,
    ImageCaptions,
    ImageTags,
    Link,
    Note,
    PDF,
    Post,
    YoutubeTranscript,
    GenericText,
}

impl ResourceTextContentType {
    pub fn from_resource_type(resource_type: &str) -> Option<ResourceTextContentType> {
        let content_type = resource_type.to_lowercase();
        match content_type {
            content_type
                if content_type.starts_with("application/vnd.space.document.space-note") =>
            {
                Some(ResourceTextContentType::Note)
            }
            content_type if content_type.starts_with("application/pdf") => {
                Some(ResourceTextContentType::PDF)
            }
            content_type if content_type.starts_with("image/") => {
                Some(ResourceTextContentType::Image)
            }
            content_type if content_type.starts_with("application/vnd.space.post") => {
                Some(ResourceTextContentType::Post)
            }
            content_type if content_type.starts_with("application/vnd.space.chat-message") => {
                Some(ResourceTextContentType::ChatMessage)
            }
            content_type if content_type.starts_with("application/vnd.space.document") => {
                Some(ResourceTextContentType::Document)
            }
            content_type if content_type.starts_with("application/vnd.space.article") => {
                Some(ResourceTextContentType::Article)
            }
            content_type if content_type.starts_with("application/vnd.space.link") => {
                Some(ResourceTextContentType::Link)
            }
            content_type if content_type.starts_with("application/vnd.space.chat-thread") => {
                Some(ResourceTextContentType::ChatThread)
            }
            content_type if content_type.starts_with("application/vnd.space.annotation") => {
                Some(ResourceTextContentType::Annotation)
            }
            content_type if content_type.starts_with("text/") => {
                Some(ResourceTextContentType::GenericText)
            }
            _ => None,
        }
    }

    pub fn should_store_embeddings(&self) -> bool {
        match self {
            ResourceTextContentType::Note => true,
            ResourceTextContentType::PDF => true,
            ResourceTextContentType::Post => true,
            ResourceTextContentType::ChatMessage => true,
            ResourceTextContentType::Document => true,
            ResourceTextContentType::Article => true,
            ResourceTextContentType::Link => true,
            ResourceTextContentType::ChatThread => true,
            ResourceTextContentType::Annotation => true,
            ResourceTextContentType::Image => true,
            ResourceTextContentType::ImageTags => true,
            ResourceTextContentType::ImageCaptions => true,
            ResourceTextContentType::YoutubeTranscript => true,
            ResourceTextContentType::GenericText => false,
        }
    }
}

impl ToSql for ResourceTextContentType {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(rusqlite::types::ToSqlOutput::from(self.to_string()))
    }
}

impl FromSql for ResourceTextContentType {
    fn column_result(value: rusqlite::types::ValueRef) -> rusqlite::types::FromSqlResult<Self> {
        let s = String::column_result(value)?;
        ResourceTextContentType::from_str(&s)
            .map_err(|_| rusqlite::types::FromSqlError::InvalidType)
    }
}

// TODO: use strum
pub enum InternalResourceTagNames {
    Type,
    Deleted,
    Hostname,
    HorizonId,
    GenerateLazyEmbeddings,
}

impl InternalResourceTagNames {
    pub fn as_str(&self) -> &str {
        match self {
            InternalResourceTagNames::Type => "type",
            InternalResourceTagNames::Deleted => "deleted",
            InternalResourceTagNames::Hostname => "hostname",
            InternalResourceTagNames::HorizonId => "horizonId",
            InternalResourceTagNames::GenerateLazyEmbeddings => "generateLazyEmbeddings",
        }
    }
}

impl FromStr for InternalResourceTagNames {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "type" => Ok(InternalResourceTagNames::Type),
            "deleted" => Ok(InternalResourceTagNames::Deleted),
            "hostname" => Ok(InternalResourceTagNames::Hostname),
            "horizonId" => Ok(InternalResourceTagNames::HorizonId),
            "generateLazyEmbeddings" => Ok(InternalResourceTagNames::GenerateLazyEmbeddings),
            _ => Err(()),
        }
    }
}

impl Display for InternalResourceTagNames {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            InternalResourceTagNames::Type => "type",
            InternalResourceTagNames::Deleted => "deleted",
            InternalResourceTagNames::Hostname => "hostname",
            InternalResourceTagNames::HorizonId => "horizonId",
            InternalResourceTagNames::GenerateLazyEmbeddings => "generateLazyEmbeddings",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Userdata {
    #[serde(default = "random_uuid")]
    pub id: String,

    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Horizon {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub horizon_name: String,
    #[serde(default)]
    pub tint: String,
    #[serde(default = "default_horizon_tint")]
    pub icon_uri: String,
    #[serde(default)]
    pub view_offset_x: i64,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Card {
    #[serde(default = "random_uuid")]
    pub id: String,

    pub horizon_id: String,
    pub card_type: String,

    #[serde(default)]
    pub resource_id: String,

    pub position_x: i64,
    pub position_y: i64,
    pub width: i32,
    pub height: i32,

    #[serde(default = "current_time")]
    pub stacking_order: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,

    #[serde(default)]
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Resource {
    #[serde(default = "random_uuid")]
    pub id: String,

    #[serde(default)]
    pub resource_path: String,

    // TODO: should use enum
    pub resource_type: String,

    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,

    #[serde(default)]
    pub deleted: i32,
}

impl Resource {
    pub fn get_human_readable_type(&self) -> String {
        match self.resource_type.as_str() {
            t if t.starts_with("image") => "Image".to_string(),
            "application/pdf" => "PDF".to_string(),
            // posts
            "application/vnd.space.post" => "Post".to_string(),
            "application/vnd.space.post.reddit" => "Reddit Post".to_string(),
            "application/vnd.space.post.youtube" => "Youtube Video".to_string(),
            "application/vnd.space.post.twitter" => "Twitter Post".to_string(),
            // chat messages and threads
            "application/vnd.space.chat-message" => "Chat Message".to_string(),
            "application/vnd.space.chat-message.discord" => "Discord Message".to_string(),
            "application/vnd.space.chat-message.slack" => "Slack Message".to_string(),
            "application/vnd.space.chat-thread" => "Chat Thread".to_string(),
            "application/vnd.space.chat-thread.slack" => "Slack Chat Thread".to_string(),
            // documents
            "application/vnd.space.document" => "Document".to_string(),
            "application/vnd.space.document.space-note" => "Note".to_string(),
            "application/vnd.space.document.notion" => "Notion Document".to_string(),
            "application/vnd.space.document.google-doc" => "Google Doc".to_string(),
            // tables
            "application/vnd.space.table" => "Table".to_string(),
            "application/vnd.space.table.google-sheet" => "Google sheet".to_string(),
            "application/vnd.space.table.typeform" => "Typeform table".to_string(),
            // articles, link & annotation
            "application/vnd.space.article" => "Article".to_string(),
            "application/vnd.space.link" => "Link".to_string(),
            "application/vnd.space.annotation" => "Annotation".to_string(),
            t => t.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceTag {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub tag_name: String,
    pub tag_value: String,
}

// TODO: also implement embeddable content for resouce tags?
impl ResourceTag {
    pub fn new_deleted(resource_id: &str, deleted: bool) -> ResourceTag {
        ResourceTag {
            id: random_uuid(),
            resource_id: resource_id.to_string(),
            tag_name: InternalResourceTagNames::Deleted.to_string(),
            tag_value: deleted.to_string(),
        }
    }

    pub fn new_type(resource_id: &str, resource_type: &str) -> ResourceTag {
        ResourceTag {
            id: random_uuid(),
            resource_id: resource_id.to_string(),
            tag_name: InternalResourceTagNames::Type.to_string(),
            tag_value: resource_type.to_string(),
        }
    }

    pub fn new_generate_lazy_embeddings(resource_id: &str) -> ResourceTag {
        ResourceTag {
            id: random_uuid(),
            resource_id: resource_id.to_string(),
            tag_name: InternalResourceTagNames::GenerateLazyEmbeddings.to_string(),
            tag_value: "true".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, strum::EnumString, strum::AsRefStr, Clone)]
#[strum(ascii_case_insensitive)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum ResourceTagFilterOp {
    #[default]
    Eq,
    Ne,
    Prefix,
    Suffix,
    NotExists,
    NePrefix,
    NeSuffix,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceTagFilter {
    pub tag_name: String,
    pub tag_value: String,
    #[serde(default)]
    pub op: ResourceTagFilterOp,
}

impl ResourceTagFilter {
    pub fn get_sql_filter_with_value(&self, indexes: (usize, usize)) -> (String, String) {
        let (i1, i2) = indexes;
        match self.op {
            ResourceTagFilterOp::Eq => (
                format!("tag_name = ?{} AND tag_value = ?{}", i1, i2),
                self.tag_value.clone(),
            ),
            ResourceTagFilterOp::Ne => (
                format!("tag_name = ?{} AND tag_value != ?{}", i1, i2),
                self.tag_value.clone(),
            ),
            ResourceTagFilterOp::Prefix => (
                format!("tag_name = ?{} AND tag_value LIKE ?{}", i1, i2),
                format!("{}%", self.tag_value),
            ),
            ResourceTagFilterOp::Suffix => (
                format!("tag_name = ?{} AND tag_value LIKE ?{}", i1, i2),
                format!("%{}", self.tag_value),
            ),
            ResourceTagFilterOp::NotExists => (
                // TODO: better support for not exists
                // currently doing this as indices are supposed to be incremented in pairs
                format!("resource_id NOT IN (SELECT resource_id FROM resource_tags WHERE tag_name = ?{} AND tag_name = ?{})", i1, i2),
                self.tag_name.clone(),
            ),
            ResourceTagFilterOp::NePrefix => (
                format!("tag_name = ?{} AND tag_value NOT LIKE ?{}", i1, i2),
                format!("{}%", self.tag_value),
            ),
            ResourceTagFilterOp::NeSuffix => (
                format!("tag_name = ?{} AND tag_value NOT LIKE ?{}", i1, i2),
                format!("%{}", self.tag_value),
            ),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceMetadata {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub name: String,

    #[serde(default)]
    pub source_uri: String,

    #[serde(default)]
    pub alt: String,

    #[serde(default)]
    pub user_context: String,
}

// TODO: what is good for semantic search?
impl EmbeddableContent for ResourceMetadata {
    // for now we are just using the alt and user context
    // as embeddable content
    // source uri and name produce too much noise
    fn get_embeddable_content(&self) -> Vec<String> {
        let mut content = vec![];
        let alt = self.alt.trim();
        if !alt.is_empty() {
            content.push(alt.to_string());
        }
        let user_context = self.user_context.trim();
        if !user_context.is_empty() {
            content.push(user_context.to_string());
        }
        content
    }

    // TODO: use an enum for this
    fn get_embedding_type(&self) -> EmbeddingType {
        EmbeddingType::Metadata
    }

    fn get_resource_id(&self) -> String {
        self.resource_id.clone()
    }
}

impl ResourceMetadata {
    pub fn get_tags(&self) -> Vec<ResourceTag> {
        let mut tags: Vec<ResourceTag> = Vec::new();
        if !self.source_uri.is_empty() {
            if let Some(hostname) = get_hostname_from_uri(&self.source_uri) {
                tags.push(ResourceTag {
                    id: random_uuid(),
                    resource_id: self.resource_id.clone(),
                    tag_name: InternalResourceTagNames::Hostname.to_string(),
                    tag_value: hostname,
                });
            }
        }
        tags
    }
}

#[derive(Default, Debug, Serialize, Deserialize, Clone)]
pub struct ResourceTextContentMetadata {
    pub timestamp: Option<f32>,
    pub url: Option<String>,
    pub page: Option<u32>,
}

impl ToSql for ResourceTextContentMetadata {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        let json = serde_json::to_string(self).unwrap();
        Ok(rusqlite::types::ToSqlOutput::from(json))
    }
}

impl FromSql for ResourceTextContentMetadata {
    fn column_result(value: rusqlite::types::ValueRef) -> rusqlite::types::FromSqlResult<Self> {
        let json = String::column_result(value)?;
        serde_json::from_str(&json).map_err(|_| rusqlite::types::FromSqlError::InvalidType)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostProcessingJob {
    #[serde(default = "random_uuid")]
    pub id: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub resource_id: String,
    pub content_hash: String,
    #[serde(default)]
    pub state: ResourceProcessingState,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[serde(tag = "type")]
#[derive(Default)]
pub enum ResourceProcessingState {
    #[default]
    Pending,
    Started,
    Failed { message: String },
    Finished,
}

impl ToSql for ResourceProcessingState {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        let json = serde_json::to_string(self)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        Ok(rusqlite::types::ToSqlOutput::from(json))
    }
}

impl FromSql for ResourceProcessingState {
    fn column_result(value: rusqlite::types::ValueRef) -> rusqlite::types::FromSqlResult<Self> {
        let str_value = String::column_result(value)?;
        serde_json::from_str(&str_value)
            .map_err(|e| rusqlite::types::FromSqlError::Other(Box::new(e)))
    }
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LegacyResourceTextContent {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceTextContent {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub content: String,
    pub content_type: ResourceTextContentType,
    pub metadata: ResourceTextContentMetadata,
}

impl EmbeddableContent for ResourceTextContent {
    fn get_embeddable_content(&self) -> Vec<String> {
        vec![self.content.clone()]
    }

    fn get_embedding_type(&self) -> EmbeddingType {
        EmbeddingType::TextContent
    }

    fn get_resource_id(&self) -> String {
        self.resource_id.clone()
    }
}

#[derive(Debug)]
pub struct CardPosition {
    pub rowid: Option<i64>,
    pub position: String,
}

impl CardPosition {
    pub fn new(position_array: &[i64; 2]) -> CardPosition {
        let pos_str = format!("[{:?}.0, {:?}.0]", position_array[0], position_array[1]);
        CardPosition {
            rowid: None,
            position: pos_str,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, strum::EnumString, strum::AsRefStr)]
#[strum(ascii_case_insensitive)]
#[serde(rename_all = "snake_case")]
pub enum HistoryEntryType {
    Search,
    Navigation,
    // Chrome-based browsers
    ImportChrome,
    ImportBrave,
    ImportEdge,
    ImportOpera,
    ImportVivaldi,
    ImportArc,
    ImportDia,
    // Firefox-based browsers
    ImportFirefox,
    ImportTor,
    ImportWaterfox,
    ImportSafari,
    ImportZen,
    Unknown,
}

impl FromSql for HistoryEntryType {
    fn column_result(value: rusqlite::types::ValueRef) -> rusqlite::types::FromSqlResult<Self> {
        let s = String::column_result(value)?;
        match HistoryEntryType::from_str(&s) {
            Ok(entry_type) => Ok(entry_type),
            Err(_) => Ok(HistoryEntryType::Unknown), // default to Unknown if parsing fails
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub entry_type: HistoryEntryType,
    pub url: Option<String>,
    pub title: Option<String>,
    pub search_query: Option<String>,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// this is needed because one resource can have multiple embeddings
#[derive(Debug)]
pub struct EmbeddingResource {
    pub rowid: Option<i64>, // the rowid will be the same as the embedding rowid
    pub content_id: i64,
    pub resource_id: String,
    pub embedding_type: EmbeddingType,
}

#[derive(Debug)]
pub struct Embedding {
    pub rowid: Option<i64>,
    pub embedding: String,
}

impl Embedding {
    fn format_embedding(embedding: &[f32]) -> String {
        let embedding_str = embedding
            .iter()
            .map(|x| format!("{}", x))
            .collect::<Vec<String>>()
            .join(", ");
        format!("[{}]", embedding_str)
    }

    pub fn new(embedding: &[f32]) -> Embedding {
        Embedding {
            rowid: None,
            embedding: Self::format_embedding(embedding),
        }
    }

    pub fn new_with_rowid(rowid: i64, embedding: &[f32]) -> Embedding {
        Embedding {
            rowid: Some(rowid),
            embedding: Self::format_embedding(embedding),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIChatSession {
    pub id: String,
    pub system_prompt: String,
    pub title: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIChatSessionHistory {
    pub id: String,
    pub system_prompt: String,
    pub title: String,
    pub messages: Vec<AIChatSessionMessage>,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIChatSessionMessageSourceMetadata {
    pub timestamp: Option<f32>,
    pub url: Option<String>,
    pub page: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIChatSessionMessageSource {
    pub id: String,
    pub uid: String,
    pub resource_id: String,
    pub metadata: Option<AIChatSessionMessageSourceMetadata>,
}

impl AIChatSessionMessageSource {
    pub fn from_resource_index(
        resource: &CompositeResource,
        index: usize,
    ) -> Option<AIChatSessionMessageSource> {
        if resource.text_content.is_none() || resource.metadata.is_none() {
            return None;
        }
        let metadata = resource.metadata.as_ref().unwrap();
        let text_content = resource.text_content.as_ref().unwrap();

        Some(AIChatSessionMessageSource {
            id: index.to_string(),
            uid: text_content.id.clone(),
            resource_id: resource.resource.id.clone(),
            metadata: Some(AIChatSessionMessageSourceMetadata {
                timestamp: text_content.metadata.timestamp,
                url: Some(metadata.source_uri.clone()),
                page: text_content.metadata.page,
            }),
        })
    }

    pub fn to_xml(&self) -> String {
        let mut timestamp = String::new();
        let mut url = String::new();
        let mut page = String::new();
        if let Some(metadata) = &self.metadata {
            if let Some(ts) = metadata.timestamp {
                timestamp = ts.to_string();
            }
            if let Some(u) = &metadata.url {
                url = u.to_string();
            }
            if let Some(p) = &metadata.page {
                page = p.to_string();
            }
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
            self.id, self.uid, self.resource_id, timestamp, url, page
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIChatSessionMessage {
    pub ai_session_id: String,
    pub role: String,
    pub content: String,
    pub truncatable: bool,
    pub is_context: bool,
    pub msg_type: String,
    // TODO: get rid of this, needs frontend changes
    pub sources: Option<Vec<AIChatSessionMessageSource>>,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Space {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub name: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpaceExtended {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub name: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub parent_space_ids: Vec<String>,
    pub child_space_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpaceEntry {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub space_id: String,
    pub resource_id: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub manually_added: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubSpaceEntry {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub parent_space_id: String,
    pub child_space_id: String,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub manually_added: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpaceEntryExtended {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub space_id: String,
    pub entry_id: String,
    pub entry_type: SpaceEntryType,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub manually_added: i32,
    pub resource_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompositeSpace {
    pub space: Space,
    pub space_entries: Vec<SpaceEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hostname_from_uri() {
        let uri = "https://www.google.com";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("www.google.com".to_string()));

        let uri = "https://deta.space";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("deta.space".to_string()));

        let uri = "non valid uri";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, None);

        let uri = "https://google.com/search?q=hello";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("google.com".to_string()));
    }

    #[test]
    fn test_get_tags_from_resource_metadata() {
        let metadata = ResourceMetadata {
            id: random_uuid(),
            resource_id: random_uuid(),
            name: "test".to_string(),
            source_uri: "https://www.google.com".to_string(),
            alt: "".to_string(),
            user_context: "".to_string(),
        };
        let tags = metadata.get_tags();
        assert_eq!(tags.len(), 1);
        assert_eq!(
            tags[0].tag_name,
            InternalResourceTagNames::Hostname.to_string()
        );
        assert_eq!(tags[0].tag_value, "www.google.com".to_string());
    }
}

pub struct PaginatedResources {
    pub resources: Vec<Resource>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompositeResource {
    pub resource: Resource,
    pub metadata: Option<ResourceMetadata>,
    pub text_content: Option<ResourceTextContent>,
    pub resource_tags: Option<Vec<ResourceTag>>,
    pub resource_annotations: Option<Vec<Resource>>,
    pub post_processing_job: Option<PostProcessingJob>,
    pub space_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SearchEngine {
    KeywordContent,
    KeywordMetadata,
    Proximity,
    Embeddings,
}

#[derive(Debug, Clone)]
pub struct SearchResourcesParams {
    pub query: String,
    pub resource_tag_filters: Option<Vec<ResourceTagFilter>>,
    pub semantic_search_enabled: Option<bool>,
    pub embeddings_distance_threshold: Option<f32>,
    pub embeddings_limit: Option<i64>,
    pub space_id: Option<String>,
    pub keyword_limit: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResultItem {
    pub resource: CompositeResource,
    pub engine: SearchEngine,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResultSpaceItem {
    pub space: Space,
    pub engine: SearchEngine,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub items: Vec<SearchResultItem>,
    pub spaces: Vec<SearchResultSpaceItem>,
    pub total: i64,
    pub space_entries: Option<Vec<SpaceEntryExtended>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResultSimple {
    pub items: Vec<String>,
    pub total: i64,
}

// TODO: is there a better way to do this?
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceOrSpace {
    pub id: String,
    pub item_type: SpaceEntryType,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct App {
    pub id: String,
    pub app_type: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub meta: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationParams {
    pub limit: usize,
    pub cursor: Option<String>,
}

pub struct PaginationCursor {}

// TODO: allowing different cursor formats?
impl PaginationCursor {
    pub fn encode_date_id(datetime: &str, id: &str) -> String {
        format!("{}|{}", datetime, id)
    }

    pub fn decode_date_id(cursor: &str) -> BackendResult<(String, String)> {
        let parts: Vec<&str> = cursor.split('|').collect();
        if parts.len() != 2 {
            return Err(BackendError::GenericError(
                "Invalid cursor format".to_string(),
            ));
        }
        Ok((parts[0].to_string(), parts[1].to_string()))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}
