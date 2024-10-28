use crate::{
    store::{db::CompositeResource, models::*},
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
    ProcessResource(CompositeResource),
}

#[derive(Debug)]
pub enum AIMessage {
    DescribeImage(CompositeResource),
}

#[derive(Debug)]
pub enum WorkerMessage {
    CardMessage(CardMessage),
    HistoryMessage(HistoryMessage),
    HorizonMessage(HorizonMessage),
    MiscMessage(MiscMessage),
    ResourceMessage(ResourceMessage),
    ResourceTagMessage(ResourceTagMessage),
    SpaceMessage(SpaceMessage),
    UserdataMessage(UserdataMessage),
}

#[derive(Debug)]
pub enum CardMessage {
    CreateCard(Card),
    GetCard(String),
    RemoveCard(String),
    UpdateCardData(String, Vec<u8>),
    UpdateCardDimensions(String, i64, i64, i32, i32),
    UpdateCardResourceID(String, String),
    UpdateCardStackingOrder(String),
    ListCardsInHorizon(String),
    ListCardsbyResourceID(String),
}

#[derive(Debug)]
pub enum HistoryMessage {
    CreateHistoryEntry(HistoryEntry),
    GetAllHistoryEntries,
    GetHistoryEntry(String),
    RemoveHistoryEntry(String),
    UpdateHistoryEntry(HistoryEntry),
    SearchHistoryEntriesByHostnamePrefix(String, Option<f64>),
    SearchHistoryEntriesByUrlAndTitle(String, Option<f64>),
}

#[derive(Debug)]
pub enum HorizonMessage {
    CreateHorizon(String),
    ListHorizons,
    UpdateHorizon(Horizon),
    RemoveHorizon(String),
}

#[derive(Debug)]
pub struct CreateSpaceEntryInput {
    pub resource_id: String,
    pub manually_added: i32,
}

#[derive(Debug)]
pub enum SpaceMessage {
    CreateSpace {
        name: String,
    },
    GetSpace(String),
    ListSpaces,
    UpdateSpace {
        space_id: String,
        name: String,
    },
    DeleteSpace(String),
    // here the string is `resource_id`, bool is `manually_added`
    CreateSpaceEntries {
        space_id: String,
        entries: Vec<CreateSpaceEntryInput>,
    },
    GetSpaceEntries {
        space_id: String,
    },
    DeleteSpaceEntries(Vec<String>),
}

#[derive(Debug)]
pub enum ResourceMessage {
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<ResourceTag>>,
        resource_metadata: Option<ResourceMetadata>,
    },
    GetResource(String, bool),
    RemoveResource(String),
    RecoverResource(String),
    ProximitySearchResources {
        resource_id: String,
        proximity_distance_threshold: Option<f32>,
        proximity_limit: Option<i64>,
    },
    ListResourcesByTags(Vec<ResourceTagFilter>),
    SearchResources {
        query: String,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        semantic_search_enabled: Option<bool>,
        embeddings_distance_threshold: Option<f32>,
        embeddings_limit: Option<i64>,
        include_annotations: Option<bool>,
        space_id: Option<String>,
    },
    UpdateResource(Resource),
    UpdateResourceMetadata(ResourceMetadata),
    UpsertResourceTextContent {
        resource_id: String,
        content: String,
        content_type: ResourceTextContentType,
        metadata: ResourceTextContentMetadata,
    },
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

#[derive(Debug)]
pub enum UserdataMessage {
    CreateUserdata(String),
    GetUserdataByUserId(String),
    RemoveUserdata(String),
}

#[derive(Debug)]
pub enum MiscMessage {
    ChatQuery {
        callback: Root<JsFunction>,
        number_documents: i32,
        query: String,
        session_id: String,
        rag_only: bool,
        resource_ids: Option<Vec<String>>,
        inline_images: Option<Vec<String>>,
        general: bool,
    },
    CreateApp {
        prompt: String,
        session_id: String,
        contexts: Option<Vec<String>>,
    },
    Print(String),
    CreateAIChatMessage(String),
    GetAIChatMessage(String),
    DeleteAIChatMessage(String),
    QuerySFFSResources(String, Option<String>, Option<String>, Option<f32>),
    GetAIChatDataSource(String),
    GetAIDocsSimilarity {
        query: String,
        docs: Vec<String>,
        threshold: Option<f32>,
    },
    GetYoutubeTranscript(String),
    RunMigration,
    SendEventBusMessage(EventBusMessage),
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
pub enum EventBusMessage {
    ResourceProcessingMessage {
        resource_id: String,
        status: ResourceProcessingStatus,
    },
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "type")]
pub enum ResourceProcessingStatus {
    Started,
    Failed { message: String },
    Finished,
}
