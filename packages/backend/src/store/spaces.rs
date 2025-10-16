use super::models::*;
use crate::{store::db::Database, BackendResult};
use rusqlite::OptionalExtension;

impl Database {
    pub fn create_space(&mut self, space: &Space) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![space.id, space.name, space.created_at, space.updated_at],
        )?;
        Ok(())
    }

    pub fn create_space_tx(tx: &mut rusqlite::Transaction, space: &Space) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![space.id, space.name, space.created_at, space.updated_at],
        )?;
        Ok(())
    }

    pub fn update_space_name(&mut self, space_id: &str, name: &str) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE spaces SET name = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![space_id, name, current_time()],
        )?;
        Ok(())
    }

    pub fn delete_space(&self, space_id: &str) -> BackendResult<()> {
        self.conn.execute(
            "DELETE FROM spaces WHERE id = ?1",
            rusqlite::params![space_id],
        )?;
        Ok(())
    }

    pub fn get_space(&self, space_id: &str) -> BackendResult<Option<SpaceExtended>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?1")?;

        let space: Space = match stmt.query_row(rusqlite::params![space_id], |row| {
            Ok(Space {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        }) {
            Ok(s) => s,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let (parent_space_ids, child_space_ids) = self.get_parent_child_spaces(space_id)?;
        Ok(Some(SpaceExtended {
            id: space.id,
            name: space.name,
            created_at: space.created_at,
            updated_at: space.updated_at,
            parent_space_ids,
            child_space_ids,
        }))
    }

    pub fn search_spaces(&self, keyword: &str) -> BackendResult<Vec<SearchResultSpaceItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM spaces WHERE json_extract(name, '$.folderName') LIKE ?1 ORDER BY updated_at DESC",
        )?;
        let spaces = stmt.query_map(rusqlite::params![format!("%{}%", keyword)], |row| {
            let space = Space {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            };
            Ok(SearchResultSpaceItem {
                space,
                engine: SearchEngine::KeywordMetadata,
            })
        })?;
        let mut result = Vec::new();
        for space in spaces {
            result.push(space?);
        }
        Ok(result)
    }

    pub fn get_parent_child_spaces(
        &self,
        space_id: &str,
    ) -> BackendResult<(Vec<String>, Vec<String>)> {
        let mut stmt = self
            .conn
            .prepare("SELECT parent_space_id FROM sub_space_entries WHERE child_space_id = ?1")?;
        let parent_spaces = stmt.query_map(rusqlite::params![space_id], |row| row.get(0))?;
        let mut parent_space_ids = Vec::new();
        for parent_space_id in parent_spaces {
            parent_space_ids.push(parent_space_id?);
        }
        let mut stmt = self
            .conn
            .prepare("SELECT child_space_id FROM sub_space_entries WHERE parent_space_id = ?1")?;
        let child_spaces = stmt.query_map(rusqlite::params![space_id], |row| row.get(0))?;
        let mut child_space_ids = Vec::new();
        for child_space_id in child_spaces {
            child_space_ids.push(child_space_id?);
        }
        Ok((parent_space_ids, child_space_ids))
    }

    pub fn search_sub_space_entries(
        &self,
        parent_space_id: &str,
        keyword: &str,
    ) -> BackendResult<Vec<SearchResultSpaceItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM spaces WHERE id IN (SELECT child_space_id FROM sub_space_entries WHERE parent_space_id = ?1) AND json_extract(name, '$.folderName') LIKE ?2 ORDER BY updated_at DESC",
        )?;
        let spaces = stmt.query_map(
            rusqlite::params![parent_space_id, format!("%{}%", keyword)],
            |row| {
                let space = Space {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                };
                Ok(SearchResultSpaceItem {
                    space,
                    engine: SearchEngine::KeywordMetadata,
                })
            },
        )?;
        let mut result = Vec::new();
        for space in spaces {
            result.push(space?);
        }
        Ok(result)
    }

    pub fn list_spaces(&self) -> BackendResult<Vec<SpaceExtended>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM spaces ORDER BY updated_at DESC",
        )?;
        let spaces = stmt.query_map([], |row| {
            Ok(Space {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut spaces_vec = Vec::new();
        for space in spaces {
            spaces_vec.push(space?);
        }

        let mut parent_stmt = self.conn.prepare(
            "SELECT child_space_id, parent_space_id FROM sub_space_entries ORDER BY child_space_id",
        )?;
        let parent_rows = parent_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut parent_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for row in parent_rows {
            let (child_id, parent_id) = row?;
            parent_map.entry(child_id).or_default().push(parent_id);
        }

        let mut child_stmt = self.conn.prepare(
        "SELECT parent_space_id, child_space_id FROM sub_space_entries ORDER BY parent_space_id"
    )?;
        let child_rows = child_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut child_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for row in child_rows {
            let (parent_id, child_id) = row?;
            child_map.entry(parent_id).or_default().push(child_id);
        }

        let mut result = Vec::new();
        for space in spaces_vec {
            let parent_space_ids = parent_map.get(&space.id).cloned().unwrap_or_default();
            let child_space_ids = child_map.get(&space.id).cloned().unwrap_or_default();

            result.push(SpaceExtended {
                id: space.id,
                name: space.name,
                created_at: space.created_at,
                updated_at: space.updated_at,
                parent_space_ids,
                child_space_ids,
            });
        }
        Ok(result)
    }

    pub fn delete_space_entry_by_resource_id_tx(
        tx: &mut rusqlite::Transaction,
        space_id: &str,
        resource_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM space_entries WHERE space_id = ?1 AND resource_id = ?2",
            rusqlite::params![space_id, resource_id],
        )?;
        Ok(())
    }

    pub fn delete_space_entries_in_space_tx(
        tx: &mut rusqlite::Transaction,
        space_id: &str,
        resource_ids: &[String],
    ) -> BackendResult<()> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "DELETE FROM space_entries WHERE space_id = ?1 AND resource_id IN ({})",
            placeholders
        );
        let mut params = vec![space_id];
        params.extend(resource_ids.iter().map(|id| id.as_str()));
        tx.execute(&query, rusqlite::params_from_iter(params))?;
        Ok(())
    }

    pub fn create_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        space_entry: &SpaceEntry,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO space_entries (id, space_id, resource_id, created_at, updated_at, manually_added) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT DO NOTHING",
            rusqlite::params![space_entry.id, space_entry.space_id, space_entry.resource_id, space_entry.created_at, space_entry.updated_at, space_entry.manually_added]
        )?;
        Ok(())
    }

    pub fn update_space_entry(&mut self, space_entry: &SpaceEntry) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE space_entries SET space_id = ?2, resource_id = ?3, created_at = ?4, updated_at = ?5, manually_added = ?6 WHERE id = ?1",
            rusqlite::params![space_entry.id, space_entry.space_id, space_entry.resource_id, space_entry.created_at, space_entry.updated_at, space_entry.manually_added]
        )?;
        Ok(())
    }

    pub fn delete_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        space_entry_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM space_entries WHERE id = ?1",
            rusqlite::params![space_entry_id],
        )?;
        Ok(())
    }

    pub fn get_space_entry(&self, space_entry_id: &str) -> BackendResult<Option<SpaceEntry>> {
        let mut stmt = self.conn.prepare("SELECT id, space_id, resource_id, created_at, updated_at, manually_added FROM space_entries WHERE id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![space_entry_id], |row| {
                Ok(SpaceEntry {
                    id: row.get(0)?,
                    space_id: row.get(1)?,
                    resource_id: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    manually_added: row.get(5)?,
                })
            })
            .optional()?)
    }

    pub fn get_space_entries_by_resource_ids(
        &self,
        resource_ids: &[String],
    ) -> BackendResult<Vec<SpaceEntry>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT id, space_id, resource_id, created_at, updated_at, manually_added FROM space_entries WHERE resource_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let space_entries = stmt.query_map(rusqlite::params_from_iter(resource_ids), |row| {
            Ok(SpaceEntry {
                id: row.get(0)?,
                space_id: row.get(1)?,
                resource_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                manually_added: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for entry in space_entries {
            result.push(entry?);
        }
        Ok(result)
    }

    pub fn get_sub_space_entries_by_space_ids(
        &self,
        parent_space_id: &str,
        child_space_ids: &[String],
    ) -> BackendResult<Vec<SubSpaceEntry>> {
        let placeholders = vec!["?"; child_space_ids.len()].join(",");
        let query = format!(
            "SELECT id, parent_space_id, child_space_id, created_at, updated_at, manually_added FROM sub_space_entries WHERE parent_space_id = ?1 AND child_space_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let mut params = vec![parent_space_id];
        params.extend(child_space_ids.iter().map(|id| id.as_str()));
        let sub_space_entries = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            Ok(SubSpaceEntry {
                id: row.get(0)?,
                parent_space_id: row.get(1)?,
                child_space_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                manually_added: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for entry in sub_space_entries {
            result.push(entry?);
        }
        Ok(result)
    }

    pub fn create_sub_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        sub_space_entry: &SubSpaceEntry,
    ) -> BackendResult<()> {
        tx.execute("INSERT INTO sub_space_entries(id, parent_space_id, child_space_id, created_at, updated_at, manually_added) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT DO NOTHING",
            rusqlite::params![sub_space_entry.id, sub_space_entry.parent_space_id, sub_space_entry.child_space_id, sub_space_entry.created_at, sub_space_entry.updated_at, sub_space_entry.manually_added]
        )?;
        Ok(())
    }

    pub fn delete_sub_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        sub_space_entry_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM sub_space_entries WHERE id = ?1",
            rusqlite::params![sub_space_entry_id],
        )?;
        Ok(())
    }

    pub fn delete_sub_space_entries_in_space_tx(
        tx: &mut rusqlite::Transaction,
        parent_space_id: &str,
        child_space_ids: &[String],
    ) -> BackendResult<()> {
        let placeholders = vec!["?"; child_space_ids.len()].join(",");
        let query = format!(
            "DELETE FROM sub_space_entries WHERE parent_space_id = ?1 AND child_space_id IN ({})",
            placeholders
        );
        let mut params = vec![parent_space_id];
        params.extend(child_space_ids.iter().map(|id| id.as_str()));
        tx.execute(&query, rusqlite::params_from_iter(params))?;
        Ok(())
    }

    pub fn update_sub_space_entry_parent_id_tx(
        tx: &mut rusqlite::Transaction,
        sub_space_id: &str,
        new_parent_space_id: &str,
    ) -> BackendResult<()> {
        let updated_rows = tx.execute(
            "UPDATE sub_space_entries SET parent_space_id = ?2, updated_at = ?3 WHERE child_space_id = ?1",
            rusqlite::params![sub_space_id, new_parent_space_id, chrono::Utc::now()],
        )?;

        if updated_rows == 0 {
            let new_entry = SubSpaceEntry {
                id: random_uuid(),
                parent_space_id: new_parent_space_id.to_string(),
                child_space_id: sub_space_id.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                manually_added: 1,
            };
            Database::create_sub_space_entry_tx(tx, &new_entry)?;
        }

        Ok(())
    }

    pub fn list_space_entries(
        &self,
        space_id: &str,
        sort_by: Option<&str>,
        order_by: Option<&str>,
        limit: Option<usize>,
    ) -> BackendResult<Vec<SpaceEntryExtended>> {
        let (sort_field, resource_join_clause) = match sort_by {
            Some("resource_added_to_space") => ("se.created_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
            Some("resource_updated") => ("r.updated_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
            Some("resource_created") => ("r.created_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
            Some("resource_source_published") => (
                "COALESCE(rt.tag_value, se.created_at)", 
                "LEFT JOIN resources r ON se.resource_id = r.id \
                 LEFT JOIN resource_tags rt ON r.id = rt.resource_id AND rt.tag_name = 'sourcePublishedAt'"
            ),
            _ => ("se.updated_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
        };

        let order = if order_by == Some("asc") {
            "ASC"
        } else {
            "DESC"
        };

        let resource_query = format!(
            "SELECT 
            se.id, 
            se.space_id, 
            se.resource_id as entry_id, 
            'resource' as entry_type, 
            se.created_at, 
            se.updated_at, 
            se.manually_added, 
            r.resource_type,
            {} as sort_value
        FROM space_entries se 
        {} 
        WHERE se.space_id = ?1",
            sort_field, resource_join_clause
        );

        let space_query = format!(
            "SELECT 
            ss.id, 
            ss.parent_space_id as space_id, 
            ss.child_space_id as entry_id, 
            'space' as entry_type, 
            ss.created_at, 
            ss.updated_at, 
            ss.manually_added, 
            NULL as resource_type,
            ss.{} as sort_value
        FROM sub_space_entries ss
        LEFT JOIN spaces s ON ss.child_space_id = s.id
        WHERE ss.parent_space_id = ?1",
            if sort_by == Some("resource_created") || sort_by == Some("resource_updated") {
                "created_at"
            } else {
                "updated_at"
            }
        );

        let mut query = format!(
            "{} UNION ALL {} ORDER BY sort_value {}",
            resource_query, space_query, order
        );

        if let Some(limit) = limit {
            let limit_clause = format!(" LIMIT {}", limit);
            query.push_str(&limit_clause);
        }

        let mut stmt = self.conn.prepare_cached(&query)?;
        let space_entries = stmt.query_map(rusqlite::params![space_id], |row| {
            let entry_type_str: String = row.get(3)?;
            let entry_type = if entry_type_str == "space" {
                SpaceEntryType::Space
            } else {
                SpaceEntryType::Resource
            };

            Ok(SpaceEntryExtended {
                id: row.get(0)?,
                space_id: row.get(1)?,
                entry_id: row.get(2)?,
                entry_type,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                manually_added: row.get(6)?,
                resource_type: row.get(7)?,
            })
        })?;

        space_entries
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn list_space_ids_by_resource_id(&self, resource_id: &str) -> BackendResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT space_id FROM space_entries WHERE resource_id = ?1 AND manually_added = 1 ORDER BY created_at ASC",
        )?;
        let space_ids = stmt.query_map(rusqlite::params![resource_id], |row| row.get(0))?;
        let mut result = Vec::new();
        for space_id in space_ids {
            result.push(space_id?);
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use crate::store::db::Database;
    use crate::store::models::{
        current_time, Resource, Space, SpaceEntry, SpaceEntryExtended, SpaceEntryType,
        SubSpaceEntry,
    };
    use chrono::Duration;
    use tempfile::tempdir;

    fn setup_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(&db_path.to_string_lossy(), true).unwrap()
    }

    fn create_test_spaces(db: &mut Database) -> Vec<Space> {
        let now = current_time();
        let spaces = vec![
            Space {
                id: "space1".to_string(),
                name: r#"{"folderName":"Work Projects"}"#.to_string(),
                created_at: now,
                updated_at: now,
            },
            Space {
                id: "space2".to_string(),
                name: r#"{"folderName":"Personal Notes"}"#.to_string(),
                created_at: now,
                updated_at: now,
            },
            Space {
                id: "space3".to_string(),
                name: r#"{"folderName":"Research Papers"}"#.to_string(),
                created_at: now,
                updated_at: now,
            },
            Space {
                id: "space4".to_string(),
                name: r#"{"folderName":"Project Ideas"}"#.to_string(),
                created_at: now,
                updated_at: now,
            },
        ];
        for space in &spaces {
            db.create_space(space).unwrap();
        }
        spaces
    }

    #[test]
    fn test_search_spaces_exact_match() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        let results = db.search_spaces("Personal Notes").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].space.id, "space2");
        assert_eq!(results[0].space.name, r#"{"folderName":"Personal Notes"}"#);
    }

    #[test]
    fn test_search_spaces_partial_match() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        let results = db.search_spaces("Project").unwrap();
        assert_eq!(results.len(), 2);

        let ids: Vec<String> = results.iter().map(|item| item.space.id.clone()).collect();
        assert!(ids.contains(&"space4".to_string()));
        assert!(ids.contains(&"space1".to_string()));
    }

    #[test]
    fn test_search_spaces_case_insensitive() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        let results = db.search_spaces("project").unwrap();
        assert_eq!(results.len(), 2);

        let results2 = db.search_spaces("PROJECT").unwrap();
        assert_eq!(results2.len(), 2);
    }

    #[test]
    fn test_search_spaces_no_match() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        let results = db.search_spaces("Nonexistent").unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_spaces_empty_string() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        // empty string should match all spaces (like a wildcard)
        let results = db.search_spaces("").unwrap();
        assert_eq!(results.len(), 4);
    }

    #[test]
    fn test_search_spaces_special_characters() {
        let mut db = setup_test_db();

        let space = Space {
            id: "space5".to_string(),
            name: r#"{"folderName":"SQL% Test_Name"}"#.to_string(),
            created_at: current_time(),
            updated_at: current_time(),
        };
        db.create_space(&space).unwrap();

        let results = db.search_spaces("%").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].space.id, "space5");

        let results2 = db.search_spaces("_").unwrap();
        assert_eq!(results2.len(), 1);
        assert_eq!(results2[0].space.id, "space5");
    }

    #[test]
    fn test_search_spaces_json_structure() {
        let mut db = setup_test_db();

        let spaces = vec![
            Space {
                id: "space6".to_string(),
                name: r#"{"folderName":"Valid JSON"}"#.to_string(),
                created_at: current_time(),
                updated_at: current_time(),
            },
            Space {
                id: "space7".to_string(),
                name: r#"{"folderName":"Nested", "metadata": {"tags": ["important"]}}"#.to_string(),
                created_at: current_time(),
                updated_at: current_time(),
            },
        ];

        for space in &spaces {
            db.create_space(space).unwrap();
        }

        // test that json_extract still works with the nested structure
        let results = db.search_spaces("Nested").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].space.id, "space7");

        // and original structure is preserved
        assert_eq!(
            results[0].space.name,
            r#"{"folderName":"Nested", "metadata": {"tags": ["important"]}}"#
        );
    }

    #[test]
    fn test_list_space_entries_empty_space() {
        let mut db = setup_test_db();
        let space = Space {
            id: "empty_space".to_string(),
            name: r#"{"folderName":"Empty Space"}"#.to_string(),
            created_at: current_time(),
            updated_at: current_time(),
        };
        db.create_space(&space).unwrap();

        let entries = db
            .list_space_entries("empty_space", None, None, None)
            .unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_list_space_entries_with_resources() {
        let mut db = setup_test_db();
        let now = current_time();

        let space = Space {
            id: "space_with_resources".to_string(),
            name: r#"{"folderName":"Space With Resources"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };
        db.create_space(&space).unwrap();

        let resource1 = Resource {
            id: "resource1".to_string(),
            resource_path: "resource1".to_string(),
            deleted: 0,
            resource_type: "note".to_string(),
            created_at: now,
            updated_at: now,
        };
        let resource2 = Resource {
            id: "resource2".to_string(),
            resource_path: "resource2".to_string(),
            deleted: 0,
            resource_type: "document".to_string(),
            created_at: now,
            updated_at: now,
        };

        db.create_resource(&resource1).unwrap();
        db.create_resource(&resource2).unwrap();

        // Create space entries
        let entry1 = SpaceEntry {
            id: "entry1".to_string(),
            space_id: "space_with_resources".to_string(),
            resource_id: "resource1".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };
        let entry2 = SpaceEntry {
            id: "entry2".to_string(),
            space_id: "space_with_resources".to_string(),
            resource_id: "resource2".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };

        // Add entries using a transaction
        let mut tx = db.conn.transaction().unwrap();
        Database::create_space_entry_tx(&mut tx, &entry1).unwrap();
        Database::create_space_entry_tx(&mut tx, &entry2).unwrap();
        tx.commit().unwrap();

        // Fetch entries
        let entries = db
            .list_space_entries("space_with_resources", None, None, None)
            .unwrap();

        assert_eq!(entries.len(), 2);
        let resource_entries: Vec<&SpaceEntryExtended> = entries
            .iter()
            .filter(|e| e.entry_type == SpaceEntryType::Resource)
            .collect();
        assert_eq!(resource_entries.len(), 2);

        let resource_ids: Vec<String> = resource_entries
            .iter()
            .map(|e| e.entry_id.clone())
            .collect();
        assert!(resource_ids.contains(&"resource1".to_string()));
        assert!(resource_ids.contains(&"resource2".to_string()));
    }

    #[test]
    fn test_list_space_entries_with_spaces() {
        let mut db = setup_test_db();
        let now = current_time();

        let parent_space = Space {
            id: "parent_space".to_string(),
            name: r#"{"folderName":"Parent Space"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };
        let child_space = Space {
            id: "child_space".to_string(),
            name: r#"{"folderName":"Child Space"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };

        db.create_space(&parent_space).unwrap();
        db.create_space(&child_space).unwrap();

        let sub_space_entry = SubSpaceEntry {
            id: "subspace1".to_string(),
            parent_space_id: "parent_space".to_string(),
            child_space_id: "child_space".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };

        let mut tx = db.conn.transaction().unwrap();
        Database::create_sub_space_entry_tx(&mut tx, &sub_space_entry).unwrap();
        tx.commit().unwrap();

        let entries = db
            .list_space_entries("parent_space", None, None, None)
            .unwrap();

        assert_eq!(entries.len(), 1);

        let space_entries: Vec<&SpaceEntryExtended> = entries
            .iter()
            .filter(|e| e.entry_type == SpaceEntryType::Space)
            .collect();
        assert_eq!(space_entries.len(), 1);

        assert_eq!(space_entries[0].entry_id, "child_space");
        assert_eq!(space_entries[0].space_id, "parent_space");
    }

    #[test]
    fn test_list_space_entries_mixed_content() {
        let mut db = setup_test_db();
        let now = current_time();

        let parent_space = Space {
            id: "mixed_parent".to_string(),
            name: r#"{"folderName":"Mixed Parent"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };
        let child_space = Space {
            id: "mixed_child".to_string(),
            name: r#"{"folderName":"Mixed Child"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };

        db.create_space(&parent_space).unwrap();
        db.create_space(&child_space).unwrap();

        let resource = Resource {
            id: "mixed_resource".to_string(),
            resource_path: "mixed_resource".to_string(),
            deleted: 0,
            resource_type: "note".to_string(),
            created_at: now,
            updated_at: now,
        };

        db.create_resource(&resource).unwrap();

        let sub_space_entry = SubSpaceEntry {
            id: "mixed_subspace".to_string(),
            parent_space_id: "mixed_parent".to_string(),
            child_space_id: "mixed_child".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };

        let resource_entry = SpaceEntry {
            id: "mixed_entry".to_string(),
            space_id: "mixed_parent".to_string(),
            resource_id: "mixed_resource".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };

        let mut tx = db.conn.transaction().unwrap();
        Database::create_sub_space_entry_tx(&mut tx, &sub_space_entry).unwrap();
        Database::create_space_entry_tx(&mut tx, &resource_entry).unwrap();
        tx.commit().unwrap();

        let entries = db
            .list_space_entries("mixed_parent", None, None, None)
            .unwrap();

        assert_eq!(entries.len(), 2);

        let space_entries: Vec<&SpaceEntryExtended> = entries
            .iter()
            .filter(|e| e.entry_type == SpaceEntryType::Space)
            .collect();
        let resource_entries: Vec<&SpaceEntryExtended> = entries
            .iter()
            .filter(|e| e.entry_type == SpaceEntryType::Resource)
            .collect();

        assert_eq!(space_entries.len(), 1);
        assert_eq!(resource_entries.len(), 1);

        assert_eq!(space_entries[0].entry_id, "mixed_child");
        assert_eq!(resource_entries[0].entry_id, "mixed_resource");
    }

    #[test]
    fn test_list_space_entries_sorting_by_resource_updated() {
        let mut db = setup_test_db();
        let now = current_time();
        let later = now + Duration::hours(2);

        let space = Space {
            id: "sort_space".to_string(),
            name: r#"{"folderName":"Sort Space"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };
        db.create_space(&space).unwrap();

        let resource1 = Resource {
            id: "sort_resource1".to_string(),
            resource_path: "sort_resource1".to_string(),
            deleted: 0,
            resource_type: "note".to_string(),
            created_at: now,
            updated_at: now, // earlier update
        };
        let resource2 = Resource {
            id: "sort_resource2".to_string(),
            resource_path: "sort_resource2".to_string(),
            deleted: 0,
            resource_type: "document".to_string(),
            created_at: now,
            updated_at: later, // later update
        };

        db.create_resource(&resource1).unwrap();
        db.create_resource(&resource2).unwrap();

        let entry1 = SpaceEntry {
            id: "sort_entry1".to_string(),
            space_id: "sort_space".to_string(),
            resource_id: "sort_resource1".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };
        let entry2 = SpaceEntry {
            id: "sort_entry2".to_string(),
            space_id: "sort_space".to_string(),
            resource_id: "sort_resource2".to_string(),
            created_at: now,
            updated_at: now,
            manually_added: 1,
        };

        let mut tx = db.conn.transaction().unwrap();
        Database::create_space_entry_tx(&mut tx, &entry1).unwrap();
        Database::create_space_entry_tx(&mut tx, &entry2).unwrap();
        tx.commit().unwrap();

        // fetch entries - default order (DESC)
        let entries_desc = db
            .list_space_entries("sort_space", Some("resource_updated"), None, None)
            .unwrap();

        // first entry should be resource2 (updated later)
        assert_eq!(entries_desc[0].entry_id, "sort_resource2");

        // fetch entries with ASC order
        let entries_asc = db
            .list_space_entries("sort_space", Some("resource_updated"), Some("asc"), None)
            .unwrap();

        // first entry should be resource1 (updated earlier)
        assert_eq!(entries_asc[0].entry_id, "sort_resource1");
    }

    #[test]
    fn test_list_space_entries_sorting_by_resource_added() {
        let mut db = setup_test_db();
        let now = current_time();
        let later = now + Duration::hours(2);

        let space = Space {
            id: "add_space".to_string(),
            name: r#"{"folderName":"Add Space"}"#.to_string(),
            created_at: now,
            updated_at: now,
        };
        db.create_space(&space).unwrap();

        let resource1 = Resource {
            id: "add_resource1".to_string(),
            resource_path: "add_resource1".to_string(),
            deleted: 0,
            resource_type: "note".to_string(),
            created_at: now,
            updated_at: now,
        };
        let resource2 = Resource {
            id: "add_resource2".to_string(),
            resource_path: "add_resource2".to_string(),
            deleted: 0,
            resource_type: "document".to_string(),
            created_at: now,
            updated_at: now,
        };

        db.create_resource(&resource1).unwrap();
        db.create_resource(&resource2).unwrap();

        let entry1 = SpaceEntry {
            id: "add_entry1".to_string(),
            space_id: "add_space".to_string(),
            resource_id: "add_resource1".to_string(),
            created_at: now, // Added earlier
            updated_at: now,
            manually_added: 1,
        };
        let entry2 = SpaceEntry {
            id: "add_entry2".to_string(),
            space_id: "add_space".to_string(),
            resource_id: "add_resource2".to_string(),
            created_at: later, // Added later
            updated_at: later,
            manually_added: 1,
        };

        let mut tx = db.conn.transaction().unwrap();
        Database::create_space_entry_tx(&mut tx, &entry1).unwrap();
        Database::create_space_entry_tx(&mut tx, &entry2).unwrap();
        tx.commit().unwrap();

        // Fetch entries sorted by when they were added to space
        let entries = db
            .list_space_entries("add_space", Some("resource_added_to_space"), None, None)
            .unwrap();

        // First entry should be resource2 (added later) when using DESC ordering
        assert_eq!(entries[0].entry_id, "add_resource2");

        // With ASC ordering
        let entries_asc = db
            .list_space_entries(
                "add_space",
                Some("resource_added_to_space"),
                Some("asc"),
                None,
            )
            .unwrap();

        // First entry should be resource1 (added earlier)
        assert_eq!(entries_asc[0].entry_id, "add_resource1");
    }

    #[test]
    fn test_list_space_entries_nonexistent_space() {
        let db = setup_test_db();

        // Should return an empty list for a space that doesn't exist
        let entries = db
            .list_space_entries("nonexistent_space", None, None, None)
            .unwrap();
        assert_eq!(entries.len(), 0);
    }
}
