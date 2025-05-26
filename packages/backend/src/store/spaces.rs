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

    pub fn get_space(&self, space_id: &str) -> BackendResult<Option<Space>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![space_id], |row| {
                Ok(Space {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .optional()?)
    }

    pub fn search_spaces(&self, keyword: &str) -> BackendResult<Vec<Space>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM spaces WHERE json_extract(name, '$.folderName') LIKE ?1 ORDER BY updated_at DESC",
        )?;
        let spaces = stmt.query_map(rusqlite::params![format!("%{}%", keyword)], |row| {
            Ok(Space {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        let mut result = Vec::new();
        for space in spaces {
            result.push(space?);
        }
        Ok(result)
    }

    pub fn list_spaces(&self) -> BackendResult<Vec<Space>> {
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
        let mut result = Vec::new();
        for space in spaces {
            result.push(space?);
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

    pub fn create_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        space_entry: &SpaceEntry,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO space_entries (id, space_id, resource_id, created_at, updated_at, manually_added) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
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

    pub fn list_space_entries(
        &self,
        space_id: &str,
        sort_by: Option<&str>,
        order_by: Option<&str>,
    ) -> BackendResult<Vec<SpaceEntryExtended>> {
        // Use specific column selection instead of table.*
        let (sort_field, join_clause) = match sort_by {
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

        // Use table aliases and specific columns
        let query = format!(
            "SELECT se.id, se.space_id, se.resource_id, se.created_at, se.updated_at, \
             se.manually_added, r.resource_type \
             FROM space_entries se \
             {} \
             WHERE se.space_id = ?1 \
             ORDER BY {} {}",
            join_clause, sort_field, order
        );

        // Prepare statement once and reuse
        let mut stmt = self.conn.prepare_cached(&query)?;

        // Use iterator directly instead of collecting into vec first
        let space_entries = stmt.query_map(rusqlite::params![space_id], |row| {
            Ok(SpaceEntryExtended {
                id: row.get(0)?,
                space_id: row.get(1)?,
                resource_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                manually_added: row.get(5)?,
                resource_type: row.get(6)?,
            })
        })?;

        // Collect results
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
    use crate::store::models::{current_time, Space};
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
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Space {
                id: "space2".to_string(),
                name: r#"{"folderName":"Personal Notes"}"#.to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Space {
                id: "space3".to_string(),
                name: r#"{"folderName":"Research Papers"}"#.to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
            },
            Space {
                id: "space4".to_string(),
                name: r#"{"folderName":"Project Ideas"}"#.to_string(),
                created_at: now.clone(),
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
        assert_eq!(results[0].id, "space2");
        assert_eq!(results[0].name, r#"{"folderName":"Personal Notes"}"#);
    }

    #[test]
    fn test_search_spaces_partial_match() {
        let mut db = setup_test_db();
        create_test_spaces(&mut db);

        let results = db.search_spaces("Project").unwrap();
        assert_eq!(results.len(), 2);

        let ids: Vec<String> = results.iter().map(|space| space.id.clone()).collect();
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
        assert_eq!(results[0].id, "space5");

        let results2 = db.search_spaces("_").unwrap();
        assert_eq!(results2.len(), 1);
        assert_eq!(results2[0].id, "space5");
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
        assert_eq!(results[0].id, "space7");

        // and original structure is preserved
        assert_eq!(
            results[0].name,
            r#"{"folderName":"Nested", "metadata": {"tags": ["important"]}}"#
        );
    }
}
