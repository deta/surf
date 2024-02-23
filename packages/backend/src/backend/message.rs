use crate::store::models;
use neon::types::Deferred;

pub enum WorkerMessage {
    Print(String, Deferred),
    GetResource(String, Deferred),
    CreateResource(models::Resource, Deferred),
}
