use super::models::*;
use crate::{store::db::Database, BackendResult};
use rusqlite::OptionalExtension;

impl Database {
    pub fn create_resource_tx(
        tx: &mut rusqlite::Transaction,
        resource: &Resource,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resources (id, resource_path, resource_type, created_at, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![resource.id, resource.resource_path, resource.resource_type, resource.created_at, resource.updated_at, resource.deleted]
        )?;
        Ok(())
    }

    pub fn create_resource(&mut self, resource: &Resource) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO resources (id, resource_path, resource_type, created_at, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![resource.id, resource.resource_path, resource.resource_type, resource.created_at, resource.updated_at, resource.deleted]
        )?;
        Ok(())
    }

    pub fn update_resource_tx(
        tx: &mut rusqlite::Transaction,
        resource: &Resource,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resources SET resource_path = ?2, resource_type = ?3, created_at = ?4, updated_at = ?5, deleted = ?6 WHERE id = ?1",
            rusqlite::params![resource.id, resource.resource_path, resource.resource_type, resource.created_at, resource.updated_at, resource.deleted]
        )?;
        Ok(())
    }

    pub fn touch_resource(&self, resource_id: &str) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE resources SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![resource_id],
        )?;
        Ok(())
    }

    pub fn touch_resource_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resources SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![resource_id],
        )?;
        Ok(())
    }

    pub fn update_resource_deleted(&self, resource_id: &str, deleted: i32) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE resources SET deleted = ?2 WHERE id = ?1",
            rusqlite::params![resource_id, deleted],
        )?;
        Ok(())
    }

    pub fn update_resource_deleted_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        deleted: i32,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resources SET deleted = ?2 WHERE id = ?1",
            rusqlite::params![resource_id, deleted],
        )?;
        Ok(())
    }

    pub fn get_resource(&self, id: &str) -> BackendResult<Option<Resource>> {
        let mut stmt = self.conn.prepare("SELECT id, resource_path, resource_type, created_at, updated_at, deleted FROM resources WHERE id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![id], |row| {
                Ok(Resource {
                    id: row.get(0)?,
                    resource_path: row.get(1)?,
                    resource_type: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    deleted: row.get(5)?,
                })
            })
            .optional()?)
    }

    pub fn remove_resources_tx(
        tx: &mut rusqlite::Transaction,
        ids: &[String],
    ) -> BackendResult<()> {
        let placeholders = std::iter::repeat_n("?", ids.len())
            .collect::<Vec<_>>()
            .join(",");

        let id_params: Vec<&dyn rusqlite::ToSql> =
            ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

        tx.execute(
            &format!("DELETE FROM resources WHERE id IN ({})", placeholders),
            &id_params[..],
        )?;
        tx.execute(
            &format!(
                "DELETE FROM resource_metadata WHERE resource_id IN ({})",
                placeholders
            ),
            &id_params[..],
        )?;
        tx.execute(
            &format!(
                "DELETE FROM resource_text_content WHERE resource_id IN ({})",
                placeholders
            ),
            &id_params[..],
        )?;

        Ok(())
    }

    pub fn remove_deleted_resources_tx(tx: &mut rusqlite::Transaction) -> BackendResult<()> {
        tx.execute("DELETE FROM resource_metadata WHERE resource_id IN (SELECT id FROM resources WHERE deleted=1)", ())?;
        tx.execute("DELETE FROM resource_text_content WHERE resource_id IN (SELECT id FROM resources WHERE deleted=1)", ())?;
        tx.execute("DELETE FROM resources WHERE deleted=1", ())?;
        Ok(())
    }

    pub fn list_all_resources(&self, deleted: i32) -> BackendResult<Vec<Resource>> {
        let mut stmt = self.conn.prepare("SELECT id, resource_path, resource_type, created_at, updated_at, deleted FROM resources WHERE deleted = ?1 ORDER BY updated_at DESC")?;
        let resources = stmt.query_map(rusqlite::params![deleted], |row| {
            Ok(Resource {
                id: row.get(0)?,
                resource_path: row.get(1)?,
                resource_type: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                deleted: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for resource in resources {
            result.push(resource?);
        }
        Ok(result)
    }

    pub fn list_resource_ids_by_space_id(&self, space_id: &str) -> BackendResult<Vec<String>> {
        let mut result = Vec::new();
        let mut stmt = self
            .conn
            .prepare("SELECT resource_id FROM space_entries WHERE space_id = ?1")?;
        // TODO: document this behavior better
        if space_id.is_empty() {
            stmt = self.
                conn.
                prepare("SELECT id from resources WHERE id NOT IN (SELECT resource_id FROM space_entries WHERE manually_added = 1)")?;
        }

        let resource_ids = stmt.query_map(rusqlite::params![space_id], |row| row.get(0))?;
        for resource_id in resource_ids {
            result.push(resource_id?);
        }
        Ok(result)
    }

    pub fn list_resources(
        &self,
        deleted: i32,
        limit: i64,
        offset: i64,
    ) -> BackendResult<PaginatedResources> {
        let mut stmt = self.conn.prepare("SELECT id, resource_path, resource_type, created_at, updated_at, deleted FROM resources WHERE deleted = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3")?;
        let resources = stmt.query_map(rusqlite::params![deleted, limit, offset], |row| {
            Ok(Resource {
                id: row.get(0)?,
                resource_path: row.get(1)?,
                resource_type: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                deleted: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for resource in resources {
            result.push(resource?);
        }
        let total = self.conn.query_row(
            "SELECT COUNT(*) FROM resources WHERE deleted = ?1",
            rusqlite::params![deleted],
            |row| row.get(0),
        )?;
        Ok(PaginatedResources {
            resources: result,
            total,
            limit,
            offset,
        })
    }

    pub fn list_resources_by_ids(
        &self,
        resource_ids: Vec<String>,
    ) -> BackendResult<Vec<CompositeResource>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT DISTINCT M.*, R.*, C.*, P.*
            FROM resources R
            LEFT JOIN resource_metadata M ON M.resource_id = R.id
            LEFT JOIN resource_text_content C ON M.resource_id = C.resource_id
            LEFT JOIN resource_content_hashes H ON R.id = H.resource_id
            LEFT JOIN post_processing_jobs P ON H.content_hash = P.content_hash
            WHERE R.id IN ({})
            AND (P.created_at IS NULL OR
                 P.created_at = (
                     SELECT MAX(P2.created_at)
                     FROM post_processing_jobs P2
                     JOIN resource_content_hashes H2 ON H2.content_hash = P2.content_hash
                     WHERE H2.resource_id = R.id
                 ))
            GROUP BY C.content
            ORDER BY R.created_at DESC",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params_from_iter(resource_ids.iter()), |row| {
                let text_content_id: Option<String> = row.get(12)?;
                let text_content = match text_content_id {
                    Some(id) => Some(ResourceTextContent {
                        id,
                        resource_id: row.get(13)?,
                        content: row.get(14)?,
                        content_type: row.get(15)?,
                        metadata: row.get(16)?,
                    }),
                    None => None,
                };

                let job_id: Option<String> = row.get(17)?;

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
                    text_content,
                    resource_tags: None,
                    resource_annotations: None,
                    space_ids: None,
                    post_processing_job: if let Some(job_id) = job_id {
                        Some(PostProcessingJob {
                            id: job_id,
                            created_at: row.get(18)?,
                            updated_at: row.get(19)?,
                            resource_id: row.get(20)?,
                            content_hash: row.get(21)?,
                            state: row.get(22)?,
                        })
                    } else {
                        None
                    },
                })
            })?;

        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }
}
