use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::time::{Duration, UNIX_EPOCH};

use crate::BackendError;
use crate::BackendResult;

#[derive(Debug, Serialize, Deserialize)]
pub struct BookmarkItem {
    pub guid: String,
    pub title: String,
    pub url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BookmarkFolder {
    pub guid: String,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
    pub children: Vec<BookmarkItem>,
}

// Chrome-specific structures for parsing the bookmarks file
#[derive(Debug, Deserialize)]
struct ChromeBookmark {
    date_added: String,
    date_last_used: Option<String>,
    date_modified: Option<String>,
    id: String,
    name: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    children: Vec<ChromeBookmark>,
    #[serde(rename = "type")]
    bookmark_type: String,
}

#[derive(Debug, Deserialize)]
struct ChromeBookmarks {
    roots: ChromeBookmarkRoots,
}

#[derive(Debug, Deserialize)]
struct ChromeBookmarkRoots {
    bookmark_bar: ChromeBookmark,
    other: ChromeBookmark,
    synced: ChromeBookmark,
}

// Firefox-specific structures
#[derive(Debug)]
struct FirefoxBookmark {
    id: i64,
    title: String,
    url: Option<String>,
    guid: String,
    parent: i64,
    date_added: i64,
    last_modified: i64,
}

// Safari-specific structures
#[derive(Debug)]
struct SafariBookmark {
    id: i64,
    title: String,
    url: Option<String>,
    parent_id: i64,
    created_at: i64,
    updated_at: i64,
}

fn chrome_time_to_datetime(chrome_time: &str) -> DateTime<Utc> {
    // Chrome time is stored as microseconds since Jan 1, 1601 UTC
    let chrome_time = chrome_time.parse::<i64>().unwrap_or(0);
    let unix_time = (chrome_time / 1_000_000) - 11_644_473_600;
    let duration = Duration::from_secs(unix_time.max(0) as u64);
    let time = UNIX_EPOCH + duration;
    DateTime::from(time)
}

fn process_chrome_bookmark(
    bookmark: &ChromeBookmark,
    folders: &mut Vec<BookmarkFolder>,
) -> Option<BookmarkFolder> {
    if bookmark.bookmark_type != "folder" {
        return None;
    }

    let created_at = chrome_time_to_datetime(&bookmark.date_added);
    let updated_at = bookmark
        .date_modified
        .as_ref()
        .map(|t| chrome_time_to_datetime(t))
        .unwrap_or(created_at);
    let last_used_at = bookmark
        .date_last_used
        .as_ref()
        .map(|t| chrome_time_to_datetime(t))
        .unwrap_or(updated_at);

    let mut children = Vec::new();
    for child in &bookmark.children {
        if child.bookmark_type == "url" {
            let child_created_at = chrome_time_to_datetime(&child.date_added);
            let child_updated_at = child
                .date_modified
                .as_ref()
                .map(|t| chrome_time_to_datetime(t))
                .unwrap_or(child_created_at);
            let child_last_used_at = child
                .date_last_used
                .as_ref()
                .map(|t| chrome_time_to_datetime(t))
                .unwrap_or(child_updated_at);

            children.push(BookmarkItem {
                guid: child.id.clone(),
                title: child.name.clone(),
                url: child.url.clone(),
                created_at: child_created_at,
                updated_at: child_updated_at,
                last_used_at: child_last_used_at,
            });
        } else if child.bookmark_type == "folder" {
            // Recursively process nested folders
            if let Some(nested_folder) = process_chrome_bookmark(child, folders) {
                folders.push(nested_folder);
            }
        }
    }

    Some(BookmarkFolder {
        guid: bookmark.id.clone(),
        title: bookmark.name.clone(),
        created_at,
        updated_at,
        last_used_at,
        children,
    })
}

fn process_firefox_bookmarks(conn: &Connection) -> BackendResult<Vec<BookmarkFolder>> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.title, p.url, b.guid, b.parent, b.dateAdded, b.lastModified
         FROM moz_bookmarks b
         LEFT JOIN moz_places p ON b.fk = p.id
         WHERE b.type IN (1,2)",
    )?;

    let bookmark_iter = stmt.query_map([], |row| {
        Ok(FirefoxBookmark {
            id: row.get(0)?,
            title: row.get(1)?,
            url: row.get(2)?,
            guid: row.get(3)?,
            parent: row.get(4)?,
            date_added: row.get(5)?,
            last_modified: row.get(6)?,
        })
    })?;

    let mut bookmarks = Vec::new();
    let mut folders_map: HashMap<i64, Vec<BookmarkItem>> = HashMap::new();
    let mut folder_info: HashMap<i64, (String, String, i64, i64)> = HashMap::new(); // (title, guid, dateAdded, lastModified)

    for b in bookmark_iter.flatten() {
        if let Some(url) = b.url {
            let created_at = UNIX_EPOCH + Duration::from_micros(b.date_added.max(0) as u64);
            let updated_at = UNIX_EPOCH + Duration::from_micros(b.last_modified.max(0) as u64);

            let item = BookmarkItem {
                guid: b.guid,
                title: b.title,
                url,
                created_at: DateTime::from(created_at),
                updated_at: DateTime::from(updated_at),
                last_used_at: DateTime::from(updated_at),
            };

            folders_map.entry(b.parent).or_default().push(item);
        } else {
            // This is a folder
            folder_info.insert(b.id, (b.title, b.guid, b.date_added, b.last_modified));
        }
    }

    // Convert the folders map into BookmarkFolder structs
    for (folder_id, (title, guid, date_added, last_modified)) in folder_info {
        if let Some(children) = folders_map.remove(&folder_id) {
            let created_at = UNIX_EPOCH + Duration::from_micros(date_added.max(0) as u64);
            let updated_at = UNIX_EPOCH + Duration::from_micros(last_modified.max(0) as u64);

            bookmarks.push(BookmarkFolder {
                guid,
                title,
                created_at: DateTime::from(created_at),
                updated_at: DateTime::from(updated_at),
                last_used_at: DateTime::from(updated_at),
                children,
            });
        }
    }

    Ok(bookmarks)
}

fn process_safari_bookmarks(conn: &Connection) -> BackendResult<Vec<BookmarkFolder>> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.title, b.url, b.parent_id, b.created_at, b.updated_at 
         FROM bookmarks b 
         ORDER BY b.parent_id",
    )?;

    let bookmark_iter = stmt.query_map([], |row| {
        Ok(SafariBookmark {
            id: row.get(0)?,
            title: row.get(1)?,
            url: row.get(2)?,
            parent_id: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    let mut bookmarks = Vec::new();
    let mut folders_map: HashMap<i64, Vec<BookmarkItem>> = HashMap::new();
    let mut folder_info: HashMap<i64, (String, i64, i64)> = HashMap::new(); // (title, created_at, updated_at)

    for b in bookmark_iter.flatten() {
        if let Some(url) = b.url {
            let created_at = UNIX_EPOCH + Duration::from_secs(b.created_at.max(0) as u64);
            let updated_at = UNIX_EPOCH + Duration::from_secs(b.updated_at.max(0) as u64);

            let item = BookmarkItem {
                guid: b.id.to_string(),
                title: b.title,
                url,
                created_at: DateTime::from(created_at),
                updated_at: DateTime::from(updated_at),
                last_used_at: DateTime::from(updated_at),
            };

            folders_map.entry(b.parent_id).or_default().push(item);
        } else {
            // This is a folder
            folder_info.insert(b.id, (b.title, b.created_at, b.updated_at));
        }
    }

    // Convert the folders map into BookmarkFolder structs
    for (folder_id, (title, created_at_secs, updated_at_secs)) in folder_info {
        if let Some(children) = folders_map.remove(&folder_id) {
            let created_at = UNIX_EPOCH + Duration::from_secs(created_at_secs.max(0) as u64);
            let updated_at = UNIX_EPOCH + Duration::from_secs(updated_at_secs.max(0) as u64);

            bookmarks.push(BookmarkFolder {
                guid: folder_id.to_string(),
                title,
                created_at: DateTime::from(created_at),
                updated_at: DateTime::from(updated_at),
                last_used_at: DateTime::from(updated_at),
                children,
            });
        }
    }

    Ok(bookmarks)
}

pub fn parse_chrome_bookmarks(
    bookmarks_path: &std::path::Path,
) -> BackendResult<Vec<BookmarkFolder>> {
    let content = fs::read_to_string(bookmarks_path)?;
    let chrome_bookmarks: ChromeBookmarks = serde_json::from_str(&content)?;

    let mut folders = Vec::new();

    // Process main bookmark folders
    if let Some(folder) =
        process_chrome_bookmark(&chrome_bookmarks.roots.bookmark_bar, &mut folders)
    {
        folders.push(folder);
    }
    if let Some(folder) = process_chrome_bookmark(&chrome_bookmarks.roots.other, &mut folders) {
        folders.push(folder);
    }
    if let Some(folder) = process_chrome_bookmark(&chrome_bookmarks.roots.synced, &mut folders) {
        folders.push(folder);
    }

    Ok(folders)
}

pub fn parse_firefox_bookmarks(
    bookmarks_path: &std::path::Path,
    browser_type: &str,
) -> BackendResult<Vec<BookmarkFolder>> {
    let temp_dir = env::temp_dir();
    let temp_bookmarks_path = temp_dir.join(format!("{}_bookmarks_temp", browser_type));

    if let Err(e) = fs::copy(bookmarks_path, &temp_bookmarks_path) {
        return Err(BackendError::GenericError(format!(
            "Error copying {} bookmarks file. Browser may be running: {}",
            browser_type, e
        )));
    }
    let conn = Connection::open_with_flags(
        temp_bookmarks_path.clone(),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )?;

    let result = process_firefox_bookmarks(&conn)?;

    // Clean up the temporary file
    if let Err(e) = fs::remove_file(&temp_bookmarks_path) {
        eprintln!("Failed to remove temporary bookmarks file: {}", e);
    }

    Ok(result)
}

pub fn parse_safari_bookmarks(
    bookmarks_path: &std::path::Path,
) -> BackendResult<Vec<BookmarkFolder>> {
    let conn =
        Connection::open_with_flags(bookmarks_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;

    process_safari_bookmarks(&conn)
}
