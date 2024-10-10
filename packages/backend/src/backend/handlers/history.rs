use std::collections::HashSet;

use crate::{
    backend::{
        message::{HistoryMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::models::HistoryEntry,
    BackendResult,
};
use neon::prelude::Channel;

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

    pub fn search_history_by_hostname_prefix(
        &mut self,
        prefix: String,
        since: Option<f64>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        let entries = self.db.search_history_by_hostname_prefix(&prefix, since)?;

        let mut unique_results: Vec<HistoryEntry> = Vec::new();
        let mut seen_urls: HashSet<String> = HashSet::new();
        for entry in &entries {
            if let Some(url) = entry.url.as_ref() {
                let url = match url::Url::parse(url) {
                    Ok(url) => url,
                    Err(_) => {
                        continue;
                    }
                };
                if let Some(hostname) = url.host_str() {
                    let clean_url = format!("{}://{}", url.scheme(), hostname);
                    if seen_urls.contains(&clean_url) {
                        continue;
                    }
                    seen_urls.insert(clean_url.clone());
                    unique_results.push(HistoryEntry {
                        url: Some(clean_url),
                        ..entry.clone()
                    });
                }
            }
        }
        Ok(unique_results)
    }

    pub fn search_history_by_url_and_title(
        &mut self,
        prefix: String,
        since: Option<f64>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        self.db.search_history_by_url_and_title(&prefix, since)
    }
}

#[tracing::instrument(level = "trace", skip(worker, channel, oneshot))]
pub fn handle_history_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: Option<TunnelOneshot>,
    message: HistoryMessage,
) {
    match message {
        HistoryMessage::CreateHistoryEntry(entry) => {
            send_worker_response(channel, oneshot, worker.create_history_entry(entry))
        }
        HistoryMessage::GetAllHistoryEntries => {
            send_worker_response(channel, oneshot, worker.get_all_history_entries())
        }
        HistoryMessage::GetHistoryEntry(id) => {
            send_worker_response(channel, oneshot, worker.get_history_entry(id))
        }
        HistoryMessage::RemoveHistoryEntry(id) => {
            send_worker_response(channel, oneshot, worker.remove_history_entry(id))
        }
        HistoryMessage::UpdateHistoryEntry(entry) => {
            send_worker_response(channel, oneshot, worker.update_history_entry(entry))
        }
        HistoryMessage::SearchHistoryEntriesByHostnamePrefix(prefix, since) => {
            send_worker_response(
                channel,
                oneshot,
                worker.search_history_by_hostname_prefix(prefix, since),
            )
        }
        HistoryMessage::SearchHistoryEntriesByUrlAndTitle(prefix, since) => {
            send_worker_response(
                channel,
                oneshot,
                worker.search_history_by_url_and_title(prefix, since),
            )
        }
    }
}
