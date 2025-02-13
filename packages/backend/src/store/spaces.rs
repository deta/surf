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
            Some("created_at") => ("se.created_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
            Some("updated_at") => ("r.updated_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
            Some("source_published_at") => (
                "COALESCE(rt.tag_value, se.created_at)", 
                "LEFT JOIN resources r ON se.resource_id = r.id \
                 LEFT JOIN resource_tags rt ON r.id = rt.resource_id AND rt.tag_name = 'sourcePublishedAt'"
            ),
            _ => ("se.updated_at", "LEFT JOIN resources r ON se.resource_id = r.id"),
        };
        
        let order = if order_by == Some("asc") { "ASC" } else { "DESC" };

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
        space_entries.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn list_space_ids_by_resource_id(&self, resource_id: &str) -> BackendResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT space_id FROM space_entries WHERE resource_id = ?1 AND manually_added = 1 ORDER BY created_at ASC",
        )?;
        let space_ids = stmt.query_map(rusqlite::params![resource_id], |row| {
            Ok(row.get(0)?)
        })?;
        let mut result = Vec::new();
        for space_id in space_ids {
            result.push(space_id?);
        }
        Ok(result)
    }
}
