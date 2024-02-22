use neon::types::Deferred;

pub enum WorkerMessage {
    Print(String, Deferred),
}
