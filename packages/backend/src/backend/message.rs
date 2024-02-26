use crate::store::models;

pub enum WorkerMessage {
    Print(String),
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
        resource_metadata: Option<models::ResourceMetadata>,
    },
    ReadResource(String),
    DeleteResource(String),
    RecoverResource(String),
    SearchResources {
        query: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
    }
}
