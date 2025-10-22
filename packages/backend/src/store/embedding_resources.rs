use super::models::*;
use crate::{store::db::Database, BackendResult};

fn get_order_by_clause_for_embedding_row_ids(column_name: &str, row_ids: &[i64]) -> String {
    let mut order_by_clause = format!("CASE {} ", column_name);
    for (i, row_id) in row_ids.iter().enumerate() {
        order_by_clause.push_str(&format!("WHEN {} THEN {} ", row_id, i));
    }
    order_by_clause.push_str(" END");
    order_by_clause
}

impl Database {
    pub fn delete_all_embedding_resources(
        &self,
        resource_id: &str,
        embedding_type: EmbeddingType,
    ) -> BackendResult<()> {
        self.conn.execute(
            "DELETE FROM embedding_resources WHERE resource_id = ?1 AND embedding_type = ?2",
            rusqlite::params![resource_id, embedding_type],
        )?;
        Ok(())
    }

    pub fn create_embedding_resource_tx(
        tx: &mut rusqlite::Transaction,
        embedding_resource: &EmbeddingResource,
    ) -> BackendResult<i64> {
        tx.execute(
            "INSERT INTO embedding_resources (resource_id, content_id, embedding_type ) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                embedding_resource.resource_id,
                embedding_resource.content_id,
                embedding_resource.embedding_type
            ],
        )?;
        Ok(tx.last_insert_rowid())
    }

    pub fn delete_embedding_resource_by_rowid_tx(
        tx: &mut rusqlite::Transaction,
        rowid: i64,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM embedding_resources WHERE rowid = ?1",
            rusqlite::params![rowid],
        )?;
        Ok(())
    }

    pub fn get_embedding_resource_ids_by_type(
        &self,
        resource_id: &str,
        embedding_type: &str,
    ) -> BackendResult<Vec<i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT rowid FROM embedding_resources WHERE resource_id = ?1 AND embedding_type = ?2",
        )?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params![resource_id, embedding_type], |row| {
                let rowid: i64 = row.get(0)?;
                Ok(rowid)
            })?;
        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_embedding_ids_by_resource_ids(
        &self,
        resource_ids: Vec<String>,
    ) -> BackendResult<Vec<i64>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT rowid FROM embedding_resources WHERE resource_id IN ({})",
            placeholders
        );
        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params_from_iter(resource_ids.iter()), |row| {
                let content_id: i64 = row.get(0)?;
                Ok(content_id)
            })?;
        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_non_deleted_embedding_ids(&self) -> BackendResult<Vec<i64>> {
        let query = "SELECT E.rowid FROM embedding_resources E LEFT JOIN resources R ON E.resource_id = R.id WHERE R.deleted = 0";
        let mut stmt = self.conn.prepare(query)?;
        let mut results = vec![];
        let results_iter = stmt.query_map([], |row| {
            let content_id: i64 = row.get(0)?;
            Ok(content_id)
        })?;
        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_embedding_ids_by_type_resource_id(
        &self,
        embedding_type: EmbeddingType,
        resource_id: &str,
    ) -> BackendResult<Vec<i64>> {
        let query =
            "SELECT rowid FROM embedding_resources WHERE embedding_type = ?1 AND resource_id = ?2";
        let mut stmt = self.conn.prepare(query)?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params![embedding_type, resource_id], |row| {
                let content_id: i64 = row.get(0)?;
                Ok(content_id)
            })?;
        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_embedding_ids_by_type_resource_ids(
        &self,
        embedding_type: EmbeddingType,
        resource_ids: Vec<String>,
    ) -> BackendResult<Vec<i64>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = match embedding_type {
            EmbeddingType::TextContent =>
                format!(
                    "SELECT rowid FROM embedding_resources WHERE embedding_type = 'text_content' AND resource_id IN ({})",
                    placeholders
                ),
            EmbeddingType::Metadata =>
                format!(
                    "SELECT rowid FROM embedding_resources WHERE embedding_type = 'metadata' AND resource_id IN ({})",
                    placeholders
                ),
            };
        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter =
            stmt.query_map(rusqlite::params_from_iter(resource_ids.iter()), |row| {
                let content_id: i64 = row.get(0)?;
                Ok(content_id)
            })?;
        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_unique_resources_only_by_embedding_row_ids(
        &self,
        row_ids: Vec<i64>,
    ) -> BackendResult<Vec<CompositeResource>> {
        if row_ids.is_empty() {
            return Ok(vec![]);
        }

        let placeholders = vec!["?"; row_ids.len()].join(",");
        let query = format!(
            "SELECT M.*, R.* FROM resources R
            LEFT JOIN resource_metadata M on M.resource_id = R.id
            LEFT JOIN embedding_resources E ON E.resource_id = R.id
            WHERE E.rowid IN ({}) GROUP BY R.id ORDER BY {}",
            placeholders,
            get_order_by_clause_for_embedding_row_ids("E.rowid", &row_ids)
        );
        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter = stmt.query_map(rusqlite::params_from_iter(row_ids.iter()), |row| {
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

    pub fn list_resources_by_embedding_row_ids(
        &self,
        row_ids: Vec<i64>,
    ) -> BackendResult<Vec<CompositeResource>> {
        if row_ids.is_empty() {
            return Ok(vec![]);
        }

        let placeholders = vec!["?"; row_ids.len()].join(",");
        let query = format!(
            "SELECT
            M.*, R.*, C.*, P.*
            FROM embedding_resources E
            LEFT JOIN resource_text_content C ON E.content_id = C.rowid
            LEFT JOIN resources R ON E.resource_id = R.id
            LEFT JOIN resource_metadata M ON E.resource_id = M.resource_id
            LEFT JOIN resource_content_hashes H ON R.id = H.resource_id
            LEFT JOIN post_processing_jobs P ON H.content_hash = P.content_hash
            WHERE E.rowid IN ({})
            AND (P.created_at IS NULL OR
                 P.created_at = (
                     SELECT MAX(P2.created_at)
                     FROM post_processing_jobs P2
                     JOIN resource_content_hashes H2 ON H2.content_hash = P2.content_hash
                     WHERE H2.resource_id = R.id
                 ))
            ORDER BY {}",
            placeholders,
            get_order_by_clause_for_embedding_row_ids("E.rowid", &row_ids)
        );

        let mut stmt = self.conn.prepare(&query)?;
        let mut results = vec![];
        let results_iter = stmt.query_map(rusqlite::params_from_iter(row_ids.iter()), |row| {
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
                text_content: Some(ResourceTextContent {
                    id: row.get(12)?,
                    resource_id: row.get(13)?,
                    content: row.get(14)?,
                    content_type: row.get(15)?,
                    metadata: row.get(16)?,
                }),
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

    pub fn remove_embedding_resource_by_row_id_tx(
        tx: &mut rusqlite::Transaction,
        row_id: &i64,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM embedding_resources WHERE rowid = ?1",
            rusqlite::params![row_id],
        )?;
        Ok(())
    }

    pub fn remove_embedding_resource_by_type_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        embedding_type: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM embeddings WHERE rowid IN (SELECT rowid FROM embedding_resources WHERE resource_id = ?1 AND embedding_type = ?2)",
            rusqlite::params![resource_id, embedding_type],
        )?;
        tx.execute(
            "DELETE FROM embedding_resources WHERE resource_id = ?1 AND embedding_type = ?2",
            rusqlite::params![resource_id, embedding_type],
        )?;
        Ok(())
    }
}
