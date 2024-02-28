use crate::store::models;

pub enum WorkerMessage {
    CreateCard(models::Card),
    CreateHorizon(String),
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
        resource_metadata: Option<models::ResourceMetadata>,
    },
    CreateUserdata(String),
    DeleteResource(String),
    GetCard(String),
    GetUserdataByUserId(String),
    ListCardsInHorizon(String),
    ListHorizons(),
    PostProcessJob(String),
    Print(String),
    ReadResource(String),
    RecoverResource(String),
    RemoveCard(String),
    RemoveHorizon(String),
    RemoveUserdata(String),
    SearchResources {
        query: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
    },
    UpdateCardData(String, Vec<u8>),
    UpdateCardDimensions(String, i64, i64, i32, i32),
    UpdateCardResourceID(String, String),
    UpdateCardStackingOrder(String, String),
    UpdateHorizonName(String, String),
}
