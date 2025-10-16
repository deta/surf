use super::models::*;
use crate::{store::db::Database, BackendResult};
use rusqlite::OptionalExtension;

impl Database {
    pub fn create_resource_text_content(
        &mut self,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content,
                resource_text_content.content_type,
                resource_text_content.metadata,
            ],
        )?;
        Ok(())
    }

    pub fn legacy_get_resource_text_content_by_resource_id(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<LegacyResourceTextContent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, resource_id, content FROM resource_text_content WHERE resource_id = ?1",
        )?;
        stmt.query_row(rusqlite::params![resource_id], |row| {
            Ok(LegacyResourceTextContent {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                content: row.get(2)?,
            })
        })
        .optional()
        .map_err(|e| e.into())
    }

    pub fn get_resource_text_content(
        &self,
        id: &str,
    ) -> BackendResult<Option<ResourceTextContent>> {
        let mut stmt = self.conn.prepare("SELECT id, resource_id, content, content_type, metadata FROM resource_text_content WHERE id = ?1")?;
        stmt.query_row(rusqlite::params![id], |row| {
            Ok(ResourceTextContent {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                content: row.get(2)?,
                content_type: row.get(3)?,
                metadata: row.get(4)?,
            })
        })
        .optional()
        .map_err(|e| e.into())
    }

    pub fn list_resource_text_content_by_resource_id(
        &self,
        id: &str,
    ) -> BackendResult<Vec<ResourceTextContent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, resource_id, content, content_type, metadata FROM resource_text_content WHERE resource_id = ?1",
        )?;
        let rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok(ResourceTextContent {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                content: row.get(2)?,
                content_type: row.get(3)?,
                metadata: row.get(4)?,
            })
        })?;
        let mut contents = Vec::new();
        for content in rows {
            contents.push(content?);
        }
        Ok(contents)
    }

    pub fn list_resource_text_content_rowids_and_content_by_resource_id(
        &self,
        id: &str,
    ) -> BackendResult<(Vec<i64>, Vec<String>)> {
        let mut stmt = self
            .conn
            .prepare("SELECT rowid, content FROM resource_text_content WHERE resource_id = ?1")?;
        let rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut rowids = Vec::new();
        let mut contents = Vec::new();

        for row_result in rows {
            let (rowid, content) = row_result?;
            rowids.push(rowid);
            contents.push(content);
        }

        Ok((rowids, contents))
    }

    pub fn create_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content,
                resource_text_content.content_type,
                resource_text_content.metadata,
            ],
        )?;
        Ok(())
    }

    pub fn update_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_text_content SET resource_id = ?2, content = ?3 WHERE id = ?1",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content
            ],
        )?;
        Ok(())
    }

    pub fn remove_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_text_content WHERE resource_id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn upsert_resource_text_content(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        content_type: &ResourceTextContentType,
        contents: &[String],
        metadatas: &[ResourceTextContentMetadata],
    ) -> BackendResult<Vec<i64>> {
        tx.execute(
            "DELETE FROM resource_text_content WHERE resource_id = ?1 AND content_type = ?2",
            rusqlite::params![resource_id, content_type],
        )?;
        let mut rowids = Vec::new();
        for (content, metadata) in contents.iter().zip(metadatas.iter()) {
            tx.execute(
                "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![random_uuid(), resource_id, content, content_type, metadata],
            )?;
            rowids.push(tx.last_insert_rowid());
        }
        Ok(rowids)
    }

    pub fn count_resource_text_content_by_ids(
        &self,
        resource_ids: &[String],
    ) -> BackendResult<i64> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT COUNT(*) FROM resource_text_content WHERE resource_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let count: i64 = stmt
            .query_row(rusqlite::params_from_iter(resource_ids.iter()), |row| {
                row.get(0)
            })?;
        Ok(count)
    }
}
