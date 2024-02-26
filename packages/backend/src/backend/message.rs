use crate::store::models;

pub enum WorkerMessage {
    Print(String),
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
        resource_metadata: Option<models::ResourceMetadata>,
    },
    ListHorizons(),
    CreateHorizon(String),
    UpdateHorizonName(String, String),
    RemoveHorizon(String),
    ListCardsInHorizon(String),
    GetCard(String),
    UpdateCardResourceID(String, String),
    UpdateCardDimensions(String, i64, i64, i32, i32),
    UpdateCardStackingOrder(String, String),
    RemoveCard(String),
    CreateUserdata(String),
    GetUserdataByUserId(String),
    RemoveUserdata(String),
    ReadResource(String),
    DeleteResource(String),
    RecoverResource(String),
    SearchResources {
        query: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
    }
}
