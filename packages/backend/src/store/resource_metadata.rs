use super::models::*;
use crate::{store::db::Database, BackendResult};
use rusqlite::OptionalExtension;

impl Database {
    pub fn create_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_metadata (id, resource_id, name, source_uri, alt, user_context) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt, resource_metadata.user_context]
        )?;
        Ok(())
    }

    pub fn update_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_metadata SET resource_id = ?2, name = ?3, source_uri = ?4, alt = ?5, user_context=?6 WHERE id = ?1",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt, resource_metadata.user_context]
        )?;

        Self::touch_resource_tx(tx, &resource_metadata.resource_id)?;

        Ok(())
    }

    pub fn remove_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_metadata WHERE resource_id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get_resource_metadata_by_resource_id(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<ResourceMetadata>> {
        let query = "SELECT id, resource_id, name, source_uri, alt, user_context FROM resource_metadata WHERE resource_id = ?1 LIMIT 1";
        self.conn
            .query_row(query, rusqlite::params![resource_id], |row| {
                Ok(ResourceMetadata {
                    id: row.get(0)?,
                    resource_id: row.get(1)?,
                    name: row.get(2)?,
                    source_uri: row.get(3)?,
                    alt: row.get(4)?,
                    user_context: row.get(5)?,
                })
            })
            .optional()
            .map_err(|e| e.into())
    }

    pub fn list_resources_metadata_by_ids(
        &self,
        resource_ids: &[String],
    ) -> BackendResult<Vec<CompositeResource>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT M.*, R.* FROM resources R
            LEFT JOIN resource_metadata M ON M.resource_id = R.id
            WHERE R.id IN ({}) ORDER BY R.created_at DESC",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params_from_iter(resource_ids.iter()), |row| {
                Ok(CompositeResource {
                    metadata: Some(ResourceMetadata {
                        id: row.get(0)?,
                        resource_id: row.get(1)?,
                        name: row.get(2)?,
                        source_uri: row.get(3)?,
                        alt: row.get(4)?,
                        user_context: row.get(5)?,
                    }),
                    resource: Resource {
                        id: row.get(6)?,
                        resource_path: row.get(7)?,
                        resource_type: row.get(8)?,
                        created_at: row.get(9)?,
                        updated_at: row.get(10)?,
                        deleted: row.get(11)?,
                    },
                    text_content: None,
                    resource_tags: None,
                    resource_annotations: None,
                    post_processing_job: None,
                    space_ids: None,
                })
            })?;

        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }
}
