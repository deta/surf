use crate::{
    ai::llm::{client::Model, models::Message},
    store::models::*,
    BackendResult,
};
use neon::prelude::{JsFunction, Root};

pub enum TunnelOneshot {
    Javascript(neon::types::Deferred),
    Rust(crossbeam_channel::Sender<BackendResult<String>>),
}
pub struct TunnelMessage(
    pub WorkerMessage,
    pub Option<TunnelOneshot>,
    // pub tracing::Span,
);

#[derive(Debug)]
pub enum ProcessorMessage {
    // Box to avoid large enum size due to CompositeResource
    ProcessResource(PostProcessingJob, Box<CompositeResource>),
}

#[derive(Debug)]
pub enum AIMessage {
    DescribeImage(CompositeResource),
}

#[derive(Debug)]
pub enum WorkerMessage {
    HistoryMessage(HistoryMessage),
    MiscMessage(MiscMessage),
    ResourceMessage(ResourceMessage),
    ResourceTagMessage(ResourceTagMessage),
    SpaceMessage(SpaceMessage),
    AppMessage(AppMessage),
    KVStoreMessage(KVStoreMessage),
}

#[derive(Debug)]
pub enum HistoryMessage {
    CreateHistoryEntry(HistoryEntry),
    GetAllHistoryEntries(Option<usize>),
    GetHistoryEntry(String),
    RemoveHistoryEntry(String),
    UpdateHistoryEntry(HistoryEntry),
    SearchHistoryEntriesByHostnamePrefix(String, Option<f64>),
    SearchHistoryEntriesByHostname(String),
    SearchHistoryEntriesByUrlAndTitle(String, Option<f64>),
    ImportBrowserHistory(String),
    ImportBrowserBookmarks(String),
    RemoveAllHistoryEntries,
}

#[derive(Debug)]
pub struct SpaceEntryInput {
    pub entry_type: SpaceEntryType,
    pub entry_id: String,
    pub manually_added: i32,
}

#[derive(Debug)]
pub struct DeleteSpaceEntryInput {
    pub id: String,
    pub entry_type: SpaceEntryType,
}

#[derive(Debug)]
pub enum SpaceMessage {
    CreateSpace {
        name: String,
    },
    GetSpace(String),
    ListSpaces,
    SearchSpace {
        query: String,
    },
    UpdateSpace {
        space_id: String,
        name: String,
    },
    DeleteSpace(String),
    // here the string is `resource_id`, bool is `manually_added`
    CreateSpaceEntries {
        space_id: String,
        entries: Vec<SpaceEntryInput>,
    },
    GetSpaceEntries {
        space_id: String,
        sort_by: Option<String>,
        order_by: Option<String>,
        limit: Option<usize>,
    },
    DeleteSpaceEntries(Vec<DeleteSpaceEntryInput>),
    MoveSpace {
        space_id: String,
        new_parent_space_id: String,
    },
    DeleteEntriesInSpaceByEntryIds {
        space_id: String,
        entry_ids: Vec<String>,
        entry_type: SpaceEntryType,
    },
}

#[derive(Debug)]
pub enum ResourceMessage {
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<ResourceTag>>,
        resource_metadata: Option<ResourceMetadata>,
    },
    GetResource(String, bool),
    RemoveResources(Vec<String>),
    RemoveResourcesByTags(Vec<ResourceTagFilter>),
    RecoverResource(String),
    // Last Param is space filter where
    // None = no space filter, Some("") = no space, Some(id) = specific space
    ListResourcesByTags(Vec<ResourceTagFilter>, PaginationParams, Option<String>),
    ListAllResourcesAndSpaces(Vec<ResourceTagFilter>),
    SearchResources(SearchResourcesParams),
    UpdateResource(Resource),
    UpdateResourceMetadata(ResourceMetadata),
    BatchUpsertResourceTextContent {
        resource_id: String,
        content_type: ResourceTextContentType,
        content: Vec<String>,
        metadata: Vec<ResourceTextContentMetadata>,
    },
    UpsertResourceHash {
        resource_id: String,
        hash: String,
    },
    GetResourceHash(String),
    DeleteResourceHash(String),
    // ---
    PostProcessJob(String),
    SetPostProcessingState {
        id: String,
        state: ResourceProcessingState,
    },
    FailActivePostProcessingJobs,
}

#[derive(Debug)]
pub enum ResourceTagMessage {
    CreateResourceTag(ResourceTag),
    RemoveResourceTag(String),
    RemoveResourceTagByName {
        resource_id: String,
        tag_name: String,
    },
    UpdateResourceTag(ResourceTag),
}

// TODO: ChatQuery & NoteQuery consolidation
#[derive(Debug)]
pub enum MiscMessage {
    CreateChatCompletion {
        messages: Vec<Message>,
        model: Model,
        custom_key: Option<String>,
        response_format: Option<String>,
    },
    ChatQuery {
        callback: Root<JsFunction>,
        number_documents: i32,
        query: String,
        model: Model,
        custom_key: Option<String>,
        session_id: String,
        search_only: bool,
        resource_ids: Vec<String>,
        inline_images: Option<Vec<String>>,
        general: bool,
        app_creation: bool,
    },
    NoteQuery {
        callback: Root<JsFunction>,
        number_documents: i32,
        query: String,
        model: Model,
        custom_key: Option<String>,
        note_resource_id: String,
        resource_ids: Vec<String>,
        inline_images: Option<Vec<String>>,
        general: bool,
        websearch: bool,
        surflet: bool,
    },
    CreateAppQuery {
        chunk_callback: Root<JsFunction>,
        done_callback: Root<JsFunction>,
        query: String,
        model: Model,
        custom_key: Option<String>,
        inline_images: Option<Vec<String>>,
    },
    Print(String),
    CreateAIChatMessage(String, String),
    UpdateAIChatMessage(String, String),
    ListAIChats(Option<i64>),
    SearchAIChats(String, Option<i64>),
    GetAIChatMessage(String),
    DeleteAIChatMessage(String),
    QuerySFFSResources(
        String,
        Model,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<f32>,
    ),
    GetAIChatDataSource(String),
    GetAIDocsSimilarity {
        query: String,
        docs: Vec<String>,
        threshold: Option<f32>,
    },
    GetYoutubeTranscript(String),
    RunMigration,
    SendEventBusMessage(EventBusMessage),
    SetSurfBackendHealth(bool),
    SearchChatResources {
        query: String,
        model: Model,
        custom_key: Option<String>,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
    },
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
pub enum EventBusMessage {
    ResourceProcessingMessage {
        resource_id: String,
        status: ResourceProcessingState,
    },
}

#[derive(Debug, serde::Serialize)]
pub enum AppMessage {
    StoreAppMessage {
        app_type: String,
        content: String,
        name: Option<String>,
        icon: Option<String>,
        meta: Option<String>,
    },
    DeleteAppMessage(String),
    ListAppsMessage,
    UpdateAppContentMessage(String, String),
}

#[derive(Debug, serde::Serialize)]
pub enum KVStoreMessage {
    CreateTable(String),
    List(String),
    Get(String, String),
    Delete(String, String),
    Put(String, String, String),
    Update(String, String, String),
}
