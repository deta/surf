use crate::store::models;
use neon::types::Deferred;

pub enum WorkerMessage {
    Print(String, Deferred),
    GetResource(String, Deferred),
    // CreateResource(models::Resource, Deferred),
    CreateResource {
        resource_type: String,
        resource_tags: Option<Vec<models::ResourceTag>>,
        resource_metadata: Option<models::ResourceMetadata>,
        deferred: Deferred,
    },
}
