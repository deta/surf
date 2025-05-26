use super::models::*;
use crate::{store::db::Database, BackendError, BackendResult};
use rusqlite::OptionalExtension;
use std::str::FromStr;

impl Database {
    pub fn create_history_entry(&self, entry: &HistoryEntry) -> BackendResult<()> {
        let query = "
            INSERT INTO history_entries (id, entry_type, url, title, search_query, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)";
        self.conn.execute(
            query,
            rusqlite::params![
                entry.id,
                entry.entry_type.as_ref(),
                entry.url,
                entry.title,
                entry.search_query,
                entry.created_at,
                entry.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn create_history_entries_batch(&mut self, entries: &[HistoryEntry]) -> BackendResult<Vec<HistoryEntry>> {
        let tx = self.conn.transaction()?;
        
        // let mut existing_urls = {
        //     // Build a comma-separated list of URLs to check
        //     let urls_to_check: Vec<_> = entries.iter()
        //         .filter_map(|entry| entry.url.as_ref())
        //         .collect();
            
        //     if urls_to_check.is_empty() {
        //         std::collections::HashSet::new()
        //     } else {
        //         // Create a single string of placeholders for the SQL query (?1, ?2, ?3, etc.)
        //         let placeholders = (1..=urls_to_check.len())
        //             .map(|i| format!("?{}", i))
        //             .collect::<Vec<_>>()
        //             .join(",");
                
        //         let query = format!(
        //             "SELECT DISTINCT url FROM history_entries WHERE url IN ({})",
        //             placeholders
        //         );
                
        //         let mut stmt = tx.prepare(&query)?;
        //         let mut urls = std::collections::HashSet::new();
                
        //         let rows = stmt.query_map(rusqlite::params_from_iter(urls_to_check), |row| {
        //             row.get::<_, String>(0)
        //         })?;
                
        //         for url in rows {
        //             urls.insert(url?);
        //         }
                
        //         urls
        //     }
        // };
        
        let query = "
            INSERT INTO history_entries (id, entry_type, url, title, search_query, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)";
            
        let mut inserted_entries = Vec::new();
        for entry in entries {
            // // Skip if URL already exists
            // if let Some(url) = &entry.url {
            //     if existing_urls.contains(url) {
            //         continue;
            //     }
                
            //     // Add to existing_urls set to prevent duplicates within the batch
            //     existing_urls.insert(url.clone());
            // }
            
            tx.execute(
                query,
                rusqlite::params![
                    entry.id,
                    entry.entry_type.as_ref(),
                    entry.url,
                    entry.title,
                    entry.search_query,
                    entry.created_at,
                    entry.updated_at,
                ],
            )?;

            inserted_entries.push(entry.clone());
        }
        
        tx.commit()?;
        Ok(inserted_entries)
    }

    pub fn get_history_entry(&self, id: &str) -> BackendResult<Option<HistoryEntry>> {
        let query = "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at
            FROM history_entries
            WHERE id = ?1";
        self.conn
            .query_row(query, [id], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    // TODO: handle this better
                    entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                        .unwrap(),
                    url: row.get(2)?,
                    title: row.get(3)?,
                    search_query: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .optional()
            .map_err(BackendError::DatabaseError)
    }

    pub fn update_history_entry(&self, entry: &HistoryEntry) -> BackendResult<()> {
        let query = "
            UPDATE history_entries
            SET entry_type = ?1, url = ?2, title = ?3, search_query = ?4, updated_at = ?5
            WHERE id = ?6";
        self.conn.execute(
            query,
            rusqlite::params![
                entry.entry_type.as_ref(),
                entry.url,
                entry.title,
                entry.search_query,
                entry.updated_at,
                entry.id,
            ],
        )?;
        Ok(())
    }

    pub fn remove_history_entry(&self, id: &str) -> BackendResult<()> {
        let query = "DELETE FROM history_entries WHERE id = ?1";
        self.conn.execute(query, [id])?;
        Ok(())
    }

    pub fn search_history_by_hostname_prefix(
        &self,
        prefix: &str,
        since: Option<f64>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        let mut query = "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at
            FROM history_entries
            WHERE url LIKE ?1 OR url LIKE ?2 OR url LIKE ?3 OR url LIKE ?4
        "
        .to_string();

        let mut results = Vec::new();

        let https_prefix = format!("https://{}%", prefix);
        let http_prefix = format!("http://{}%", prefix);
        let www_https_prefix = format!("https://www.{}%", prefix);
        let www_http_prefix = format!("http://www.{}%", prefix);

        if let Some(mut since) = since {
            since /= 1000.0;
            query = format!(
                "{} AND created_at >= datetime(?5, 'unixepoch') ORDER BY created_at DESC",
                query
            );
            let mut stmt = self.read_only_conn.prepare(&query)?;
            let items = stmt.query_map(
                rusqlite::params![
                    https_prefix,
                    http_prefix,
                    www_https_prefix,
                    www_http_prefix,
                    since
                ],
                |row| {
                    Ok(HistoryEntry {
                        id: row.get(0)?,
                        // TODO: handle this better
                        entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                            .unwrap(),
                        url: row.get(2)?,
                        title: row.get(3)?,
                        search_query: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                },
            )?;
            for item in items {
                results.push(item?);
            }
            return Ok(results);
        }
        query = format!("{} ORDER BY created_at DESC", query);
        let mut stmt = self.read_only_conn.prepare(&query)?;
        let items = stmt.query_map(
            rusqlite::params![https_prefix, http_prefix, www_https_prefix, www_http_prefix],
            |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    // TODO: handle this better
                    entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                        .unwrap(),
                    url: row.get(2)?,
                    title: row.get(3)?,
                    search_query: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )?;
        for item in items {
            results.push(item?);
        }
        Ok(results)
    }

    pub fn search_history_by_url_and_title(
        &self,
        search_string: &str,
        since: Option<f64>,
    ) -> BackendResult<Vec<HistoryEntry>> {
        let mut query = "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at, COUNT(url) as url_count
            FROM history_entries
            WHERE (url LIKE ?1 OR title LIKE ?1)".to_string();

        if let Some(_since) = since {
            query.push_str(" AND created_at >= datetime(?2, 'unixepoch')");
        }

        query.push_str(
            "
            GROUP BY url
            ORDER BY
                CASE
                    WHEN instr(substr(url, instr(url, '://') + 3), ?1) > 0 THEN 1
                    WHEN title LIKE ?1 THEN 2
                    WHEN url LIKE ?1 THEN 3
                    ELSE 4
                END,
                url_count DESC,
                created_at DESC
            LIMIT 25",
        );

        let mut stmt = self.conn.prepare(&query)?;

        let search_pattern = format!("%{}%", search_string);

        let items: Box<dyn Iterator<Item = rusqlite::Result<HistoryEntry>>> =
            if let Some(mut since) = since {
                since /= 1000.0;
                Box::new(
                    stmt.query_map(rusqlite::params![search_pattern, since], |row| {
                        Ok(HistoryEntry {
                            id: row.get(0)?,
                            entry_type: HistoryEntryType::from_str(
                                row.get::<_, String>(1)?.as_str(),
                            )
                            .unwrap(),
                            url: row.get(2)?,
                            title: row.get(3)?,
                            search_query: row.get(4)?,
                            created_at: row.get(5)?,
                            updated_at: row.get(6)?,
                        })
                    })?,
                )
            } else {
                Box::new(stmt.query_map(rusqlite::params![search_pattern], |row| {
                    Ok(HistoryEntry {
                        id: row.get(0)?,
                        entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                            .unwrap(),
                        url: row.get(2)?,
                        title: row.get(3)?,
                        search_query: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                })?)
            };

        let mut results = Vec::new();
        for item in items {
            results.push(item?);
        }
        Ok(results)
    }

    pub fn get_all_history_entries(&self) -> BackendResult<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at
            FROM history_entries",
        )?;

        let history_entry_iter = stmt.query_map([], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                // TODO: handle this better
                entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str()).unwrap(),
                url: row.get(2)?,
                title: row.get(3)?,
                search_query: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut history_entries = Vec::new();
        for entry in history_entry_iter {
            history_entries.push(entry?);
        }

        Ok(history_entries)
    }

    pub fn search_history_by_hostname(&self, url: &str) -> BackendResult<Vec<HistoryEntry>> {
        let query = "SELECT id, entry_type, url, title, search_query, created_at, updated_at
                    FROM history_entries
                    WHERE url LIKE ?1 OR url LIKE ?2 OR url LIKE ?3 OR url LIKE ?4
                    ORDER BY created_at DESC";

        let mut stmt = self.conn.prepare(query)?;
        let https_prefix = format!("%{}%", url);
        let http_prefix = format!("http://{}%", url);
        let www_https_prefix = format!("https://www.{}%", url);
        let www_http_prefix = format!("http://www.{}%", url);

        let history_entries = stmt.query_map(
            rusqlite::params![https_prefix, http_prefix, www_https_prefix, www_http_prefix],
            |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                        .unwrap(),
                    url: row.get(2)?,
                    title: row.get(3)?,
                    search_query: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )?;

        let mut results = Vec::new();
        for entry in history_entries {
            results.push(entry?);
        }
        Ok(results)
    }
}
