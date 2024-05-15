use crate::{
    store::{db::CompositeResource, models::*},
    BackendResult,
};
use neon::prelude::{JsFunction, Root};

pub enum TunnelOneshot {
    Javascript(neon::types::Deferred),
    Rust(std::sync::mpsc::Sender<BackendResult<String>>),
}
pub struct TunnelMessage(pub WorkerMessage, pub Option<TunnelOneshot>);

#[derive(Debug)]
pub enum ProcessorMessage {
    ProcessResource(CompositeResource),
}

pub enum AIMessage {
    GenerateMetadataEmbeddings(ResourceMetadata),
    GenerateTextContentEmbeddings(ResourceTextContent),
    DescribeImage(CompositeResource),
    GenerateWebpageEmbeddings(ResourceMetadata),
    GenerateYoutubeVideoEmbeddings(ResourceMetadata),
}

pub enum WorkerMessage {
    CardMessage(CardMessage),
    HistoryMessage(HistoryMessage),
    HorizonMessage(HorizonMessage),
    ResourceMessage(ResourceMessage),
    ResourceTagMessage(ResourceTagMessage),
    UserdataMessage(UserdataMessage),
    MiscMessage(MiscMessage),
}

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

pub enum HistoryMessage {
    CreateHistoryEntry(HistoryEntry),
    GetAllHistoryEntries,
    GetHistoryEntry(String),
    RemoveHistoryEntry(String),
    UpdateHistoryEntry(HistoryEntry),
}

pub enum HorizonMessage {
    CreateHorizon(String),
    ListHorizons,
    UpdateHorizon(Horizon),
    RemoveHorizon(String),
}

pub enum ResourceMessage {
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<ResourceTag>>,
        resource_metadata: Option<ResourceMetadata>,
    },
    CreateResourceTextContent {
        resource_id: String,
        content: String,
    },
    GetResource(String),
    RemoveResource(String),
    RecoverResource(String),
    ProximitySearchResources {
        resource_id: String,
        proximity_distance_threshold: Option<f32>,
        proximity_limit: Option<i64>,
    },
    SearchResources {
        query: String,
        resource_tag_filters: Option<Vec<ResourceTagFilter>>,
        proximity_distance_threshold: Option<f32>,
        proximity_limit: Option<i64>,
        semantic_search_enabled: Option<bool>,
        embeddings_distance_threshold: Option<f32>,
        embeddings_limit: Option<i64>,
    },
    UpdateResourceMetadata(ResourceMetadata),
    UpsertResourceTextContent {
        resource_id: String,
        content: String,
    },
    InsertEmbeddings {
        resource_id: String,
        embedding_type: String,
        embeddings: Vec<Vec<f32>>,
    },
    UpsertEmbeddings {
        resource_id: String,
        embedding_type: String,
        embeddings: Vec<Vec<f32>>,
    },
    // ---
    PostProcessJob(String),
}

pub enum ResourceTagMessage {
    CreateResourceTag(ResourceTag),
    RemoveResourceTag(String),
}

pub enum UserdataMessage {
    CreateUserdata(String),
    GetUserdataByUserId(String),
    RemoveUserdata(String),
}

pub enum MiscMessage {
    ChatQuery {
        callback: Root<JsFunction>,
        model: String,
        number_documents: i32,
        query: String,
        session_id: String,
    },
    Print(String),
    CreateAIChatMessage(String),
    GetAIChatMessage(String),
}
