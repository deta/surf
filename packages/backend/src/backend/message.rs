use crate::{
    store::{db::CompositeResource, models::*},
    BackendResult,
};

pub enum TunnelOneshot {
    Javascript(neon::types::Deferred),
    Rust(std::sync::mpsc::Sender<BackendResult<String>>),
}
pub struct TunnelMessage(pub WorkerMessage, pub Option<TunnelOneshot>);

#[derive(Debug)]
pub enum ProcessorMessage {
    ProcessResource(CompositeResource),
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
    },
    UpdateResourceMetadata(ResourceMetadata),
    UpsertResourceTextContent {
        resource_id: String,
        content: String,
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
    Print(String),
}
