use rusqlite::{Connection, OpenFlags};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::{
    api::message::{HistoryMessage, TunnelOneshot},
    store::models::{HistoryEntry, HistoryEntryType},
    worker::{send_worker_response, Worker},
    BackendError, BackendResult,
};

mod browser_bookmarks;
mod browser_config;
use browser_bookmarks::BookmarkFolder;
use browser_config::{
    get_bookmarks_file_path, get_browser_config, get_history_file_path, BrowserFamily,
};

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

    pub fn get_all_history_entries(
        &mut self,
        limit: Option<usize>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        self.db.get_all_history_entries(limit)
    }

    pub fn remove_all_history_entries(&mut self) -> BackendResult<()> {
        self.db.remove_all_history_entries()
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

    pub fn search_history_by_hostname(&mut self, url: String) -> BackendResult<Vec<HistoryEntry>> {
        self.db.search_history_by_hostname(&url)
    }

    pub fn search_history_by_url_and_title(
        &mut self,
        prefix: String,
        since: Option<f64>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        self.db.search_history_by_url_and_title(&prefix, since)
    }

    pub fn import_browser_history(
        &mut self,
        browser_type: &str,
        limit: usize,
    ) -> BackendResult<Vec<HistoryEntry>> {
        const BATCH_SIZE: usize = 1000;

        let browser_config = get_browser_config(browser_type).ok_or_else(|| {
            BackendError::GenericError(format!("Unsupported browser type: {}", browser_type))
        })?;

        // Get the history file path for the specified browser
        let history_path = get_history_file_path(browser_type)?;

        // Check access permissions for Safari before attempting to copy
        if browser_config.family == BrowserFamily::Safari {
            if !history_path.exists() {
                return Err(BackendError::GenericError(
                    format!("Safari history database not found at expected location: {:?}\nThis could mean Safari has never been used on this system.", history_path)
                ));
            }

            match fs::metadata(&history_path) {
                Ok(metadata) => {
                    if metadata.permissions().readonly() {
                        return Err(BackendError::GenericError(
                            format!("Safari history database exists but is not readable.\n\
                            Please check these things:\n\
                            1. Safari is completely closed (check Activity Monitor)\n\
                            2. In System Settings > Privacy & Security > Full Disk Access, make sure your app has access\n\
                            3. Try running: chmod 644 '{}'", history_path.display())
                        ));
                    }
                }
                Err(e) => {
                    return Err(BackendError::GenericError(
                        format!("Could not check Safari history database permissions: {}\n\
                        This usually means the file exists but your application doesn't have permission to access it.\n\
                        Please grant Full Disk Access permission in System Settings > Privacy & Security.", e)
                    ));
                }
            }

            // Check if Safari is running
            let output = std::process::Command::new("pgrep")
                .arg("-x")
                .arg("Safari")
                .output()
                .ok();

            if let Some(output) = output {
                if !output.stdout.is_empty() {
                    return Err(BackendError::GenericError(
                        "Safari is still running. Please quit Safari completely (Safari > Quit Safari) and try again.".to_string()
                    ));
                }
            }
        }

        // Copy history file and read entries
        let temp_dir = env::temp_dir();
        let temp_history_path = temp_dir.join(format!("{}_history_temp", browser_type));

        if let Err(e) = fs::copy(&history_path, &temp_history_path) {
            return Err(BackendError::GenericError(format!(
                "Error copying {} history file. Browser may be running: {}",
                browser_type, e
            )));
        }

        let entries = match browser_config.family {
            BrowserFamily::Chromium => {
                self.read_chromium_history_from_file(&temp_history_path, limit)?
            }
            BrowserFamily::Firefox => {
                self.read_firefox_history_from_file(&temp_history_path, limit)?
            }
            BrowserFamily::Safari => {
                self.read_safari_history_from_file(&temp_history_path, limit)?
            }
        };

        // Clean up the temporary file
        if let Err(e) = fs::remove_file(&temp_history_path) {
            eprintln!("Failed to remove temporary history file: {}", e);
        }

        let mut history_entries = entries;

        // Update the entry type for all entries
        let entry_type = match browser_type {
            "chrome" => HistoryEntryType::ImportChrome,
            "brave" => HistoryEntryType::ImportBrave,
            "edge" => HistoryEntryType::ImportEdge,
            "opera" => HistoryEntryType::ImportOpera,
            "vivaldi" => HistoryEntryType::ImportVivaldi,
            "arc" => HistoryEntryType::ImportArc,
            "dia" => HistoryEntryType::ImportDia,
            "firefox" => HistoryEntryType::ImportFirefox,
            "tor" => HistoryEntryType::ImportTor,
            "waterfox" => HistoryEntryType::ImportWaterfox,
            "safari" => HistoryEntryType::ImportSafari,
            "zen" => HistoryEntryType::ImportZen,
            _ => {
                return Err(BackendError::GenericError(format!(
                    "Unsupported browser type: {}",
                    browser_type
                )))
            }
        };

        for entry in &mut history_entries {
            entry.entry_type = entry_type.clone();
        }

        let mut successful_entries = Vec::new();

        // Process entries in batches
        for chunk in history_entries.chunks(BATCH_SIZE) {
            match self.db.create_history_entries_batch(chunk) {
                Ok(inserted) => successful_entries.extend(inserted),
                Err(e) => {
                    eprintln!("Failed to store history batch: {}", e);
                    continue;
                }
            }
        }

        Ok(successful_entries)
    }

    fn read_safari_history_from_file(
        &mut self,
        history_path: &Path,
        limit: usize,
    ) -> BackendResult<Vec<HistoryEntry>> {
        // Try to connect to Safari's History.db file directly
        let conn = match Connection::open_with_flags(
            history_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
        ) {
            Ok(conn) => conn,
            Err(e) => {
                let error_msg = e.to_string();
                if error_msg.contains("unable to open database file") {
                    return Err(BackendError::GenericError(
                        "Could not access Safari history database. To fix this:\n\
                        1. Quit Safari completely (Safari > Quit Safari)\n\
                        2. Open System Settings\n\
                        3. Go to Privacy & Security\n\
                        4. Select Full Disk Access\n\
                        5. Click the + button\n\
                        6. Select and add Surf\n\
                        7. Try importing again\n\
                        \n\
                        Note: Safari must be completely closed during the import."
                            .to_string(),
                    ));
                } else {
                    return Err(BackendError::GenericError(format!(
                        "Could not access Safari history database: {}",
                        e
                    )));
                }
            }
        };

        let mut stmt = conn.prepare(
            "SELECT 
                history_items.url,
                history_visits.title,
                history_items.visit_count,
                MAX(history_visits.visit_time + 978307200) as last_visit_time
            FROM history_items 
            LEFT JOIN history_visits ON history_items.id = history_visits.history_item
            GROUP BY history_items.id
            ORDER BY last_visit_time DESC
            LIMIT ?",
        )?;

        let mut history_entries = Vec::new();
        let current_time = SystemTime::now();

        let safari_history = stmt.query_map([limit as i64], |row| {
            let url: String = row.get(0)?;
            let title: Option<String> = row.get(1)?;
            let _visit_count: i32 = row.get(2)?;
            let visit_time: i64 = row.get(3)?;

            Ok((url, title, visit_time))
        })?;

        for entry_result in safari_history {
            let (url, title, visit_time) = entry_result?;
            let created_at = UNIX_EPOCH + Duration::from_secs(visit_time.max(0) as u64);

            let entry = HistoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                entry_type: HistoryEntryType::ImportSafari,
                url: Some(url),
                title,
                search_query: None,
                created_at: created_at.into(),
                updated_at: current_time.into(),
            };

            history_entries.push(entry);
        }

        Ok(history_entries)
    }

    fn read_chromium_history_from_file(
        &mut self,
        history_path: &Path,
        limit: usize,
    ) -> BackendResult<Vec<HistoryEntry>> {
        let conn = Connection::open_with_flags(history_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;

        let mut stmt = conn.prepare(
            "SELECT 
                urls.url, 
                urls.title, 
                urls.visit_count, 
                urls.last_visit_time,
                COALESCE(MAX(visits.visit_time), urls.last_visit_time) as visit_time
            FROM urls
            LEFT JOIN visits ON urls.id = visits.url
            GROUP BY urls.id
            ORDER BY visit_time DESC
            LIMIT ?",
        )?;

        let mut history_entries = Vec::new();
        let current_time = SystemTime::now();

        let chrome_history = stmt.query_map([limit as i64], |row| {
            let url: String = row.get(0)?;
            let title: String = row.get(1)?;
            let _visit_count: i32 = row.get(2)?;
            let visit_time: i64 = row.get(4)?;

            // Chrome stores time as microseconds since Jan 1, 1601 UTC
            // Convert to milliseconds since epoch (Jan 1, 1970)
            let chrome_epoch = 11644473600000; // Difference in milliseconds between 1601 and 1970
            let visit_time_ms = (visit_time / 1000) - chrome_epoch;

            Ok((url, title, visit_time_ms))
        })?;

        for entry_result in chrome_history {
            let (url, title, visit_time_ms) = entry_result?;
            let created_at = UNIX_EPOCH + Duration::from_millis(visit_time_ms.max(0) as u64);

            let entry = HistoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                entry_type: HistoryEntryType::ImportChrome, // This will be overwritten in import_browser_history
                url: Some(url),
                title: Some(title),
                search_query: None,
                created_at: created_at.into(),
                updated_at: current_time.into(),
            };

            history_entries.push(entry);
        }

        Ok(history_entries)
    }

    fn read_firefox_history_from_file(
        &mut self,
        history_path: &Path,
        limit: usize,
    ) -> BackendResult<Vec<HistoryEntry>> {
        let conn = Connection::open_with_flags(history_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;

        let mut stmt = conn.prepare(
            "SELECT 
                moz_places.url,
                moz_places.title,
                moz_places.visit_count,
                COALESCE(MAX(moz_historyvisits.visit_date), 0) as last_visit_date
            FROM moz_places
            LEFT JOIN moz_historyvisits ON moz_places.id = moz_historyvisits.place_id
            WHERE moz_places.url NOT LIKE 'place:%'
            GROUP BY moz_places.id
            ORDER BY last_visit_date DESC
            LIMIT ?",
        )?;

        let mut history_entries = Vec::new();
        let current_time = SystemTime::now();

        let firefox_history = stmt.query_map([limit as i64], |row| {
            let url: String = row.get(0)?;
            let title: Option<String> = row.get(1)?;
            let _visit_count: i32 = row.get(2)?;
            let visit_time: i64 = row.get(3)?;

            // Firefox stores time as microseconds since Unix epoch (1970)
            let visit_time_ms = visit_time / 1000;

            Ok((url, title, visit_time_ms))
        })?;

        for entry_result in firefox_history {
            let (url, title, visit_time_ms) = entry_result?;
            let created_at = UNIX_EPOCH + Duration::from_millis(visit_time_ms.max(0) as u64);

            let entry = HistoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                entry_type: HistoryEntryType::ImportFirefox, // This will be overwritten in import_browser_history
                url: Some(url),
                title,
                search_query: None,
                created_at: created_at.into(),
                updated_at: current_time.into(),
            };

            history_entries.push(entry);
        }

        Ok(history_entries)
    }

    pub fn import_browser_bookmarks(
        &mut self,
        browser_type: &str,
        _limit: usize,
    ) -> BackendResult<Vec<BookmarkFolder>> {
        let browser_config = get_browser_config(browser_type).ok_or_else(|| {
            BackendError::GenericError(format!("Unsupported browser type: {}", browser_type))
        })?;

        // Get the bookmarks file path for the specified browser
        let bookmarks_path = get_bookmarks_file_path(browser_type)?;

        match browser_config.family {
            BrowserFamily::Chromium => browser_bookmarks::parse_chrome_bookmarks(&bookmarks_path),
            BrowserFamily::Firefox => {
                browser_bookmarks::parse_firefox_bookmarks(&bookmarks_path, browser_type)
            }
            BrowserFamily::Safari => browser_bookmarks::parse_safari_bookmarks(&bookmarks_path),
        }
    }
}

#[tracing::instrument(level = "trace", skip(worker, oneshot))]
pub fn handle_history_message(
    worker: &mut Worker,
    oneshot: Option<TunnelOneshot>,
    message: HistoryMessage,
) {
    match message {
        HistoryMessage::CreateHistoryEntry(entry) => {
            let result = worker.create_history_entry(entry);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::GetAllHistoryEntries(limit) => {
            let result = worker.get_all_history_entries(limit);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::GetHistoryEntry(id) => {
            let result = worker.get_history_entry(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::RemoveHistoryEntry(id) => {
            let result = worker.remove_history_entry(id);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::UpdateHistoryEntry(entry) => {
            let result = worker.update_history_entry(entry);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::SearchHistoryEntriesByHostnamePrefix(prefix, since) => {
            let result = worker.search_history_by_hostname_prefix(prefix, since);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::SearchHistoryEntriesByHostname(url) => {
            let result = worker.search_history_by_hostname(url);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::SearchHistoryEntriesByUrlAndTitle(prefix, since) => {
            let result = worker.search_history_by_url_and_title(prefix, since);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::ImportBrowserHistory(browser_type) => {
            let limit = 1_000_000; // Import up to 1m entries
            let result = worker.import_browser_history(&browser_type, limit);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::ImportBrowserBookmarks(browser_type) => {
            let limit = 1_000_000; // Import up to 1m entries
            let result = worker.import_browser_bookmarks(&browser_type, limit);
            send_worker_response(&mut worker.channel, oneshot, result);
        }
        HistoryMessage::RemoveAllHistoryEntries => {
            let result = worker.remove_all_history_entries();
            send_worker_response(&mut worker.channel, oneshot, result);
        }
    }
}
