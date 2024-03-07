use crate::{
    backend::{
        message::HistoryMessage,
        worker::{send_worker_response, Worker},
    },
    store::models::HistoryEntry,
    BackendResult,
};
use neon::{prelude::Channel, types::Deferred};

impl Worker {
    pub fn create_history_entry(&mut self, entry: HistoryEntry) -> BackendResult<HistoryEntry> {
        self.db.create_history_entry(&entry)?;
        Ok(entry)
    }

    pub fn get_history_entry(&mut self, id: String) -> BackendResult<Option<HistoryEntry>> {
        self.db.get_history_entry(&id)
    }

    pub fn update_history_entry(&mut self, entry: HistoryEntry) -> BackendResult<()> {
        self.db.update_history_entry(&entry)
    }

    pub fn remove_history_entry(&mut self, id: String) -> BackendResult<()> {
        self.db.remove_history_entry(&id)
    }

    pub fn get_all_history_entries(&mut self) -> BackendResult<Vec<HistoryEntry>> {
        self.db.get_all_history_entries()
    }
}

pub fn handle_history_message(
    worker: &mut Worker,
    channel: &mut Channel,
    deferred: Deferred,
    message: HistoryMessage,
) {
    match message {
        HistoryMessage::CreateHistoryEntry(entry) => {
            send_worker_response(channel, deferred, worker.create_history_entry(entry))
        }
        HistoryMessage::GetAllHistoryEntries => {
            send_worker_response(channel, deferred, worker.get_all_history_entries())
        }
        HistoryMessage::GetHistoryEntry(id) => {
            send_worker_response(channel, deferred, worker.get_history_entry(id))
        }
        HistoryMessage::RemoveHistoryEntry(id) => {
            send_worker_response(channel, deferred, worker.remove_history_entry(id))
        }
        HistoryMessage::UpdateHistoryEntry(entry) => {
            send_worker_response(channel, deferred, worker.update_history_entry(entry))
        }
    }
}
