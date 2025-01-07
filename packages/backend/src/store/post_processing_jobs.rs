use super::models::*;
use crate::{store::db::Database, BackendResult};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;

impl Database {
    pub fn get_resource_processing_state(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<PostProcessingJob>> {
        let query = "
        SELECT P.*
        FROM resources R
        LEFT JOIN resource_content_hashes H ON R.id = H.resource_id
        LEFT JOIN post_processing_jobs P ON H.content_hash = P.content_hash
        WHERE R.id = ?1
        ORDER BY P.created_at DESC
        LIMIT 1";

        self.conn
            .query_row(query, rusqlite::params![resource_id], |row| {
                let id: Option<String> = row.get(0)?;
                match id {
                    Some(id) => Ok(PostProcessingJob {
                        id,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        resource_id: row.get(3)?,
                        content_hash: row.get(4)?,
                        state: row.get(5)?,
                    }),
                    None => Err(rusqlite::Error::QueryReturnedNoRows),
                }
            })
            .optional()
            .map_err(|e| e.into())
    }

    pub fn remove_processing_job_entry(&mut self, id: String) -> BackendResult<()> {
        self.conn.execute(
            "DELETE FROM post_processing_jobs WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn create_processing_job_entry(&mut self, job: &PostProcessingJob) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO post_processing_jobs (id, created_at, updated_at, resource_id, content_hash, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                job.id,
                job.created_at,
                job.updated_at,
                job.resource_id,
                job.content_hash,
                job.state
            ]
        )?;
        Ok(())
    }

    pub fn set_post_processing_job_state(
        &mut self,
        job_id: String,
        state: ResourceProcessingState,
    ) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE post_processing_jobs SET state = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![job_id, state, current_time()],
        )?;
        Ok(())
    }

    pub fn fail_active_post_processing_jobs(
        &self,
        created_at: &DateTime<Utc>,
    ) -> BackendResult<()> {
        let failed = ResourceProcessingState::Failed {
            message: "job terminated without completion".to_owned(),
        };

        let update_query = r#"
            UPDATE post_processing_jobs
            SET state = ?1,
                updated_at = datetime('now')
            WHERE created_at < ?2
            AND created_at = (
                SELECT MAX(created_at)
                FROM post_processing_jobs P2
                WHERE P2.resource_id = post_processing_jobs.resource_id
            )
            AND (state LIKE '%pending%' OR state LIKE '%started%')
            AND EXISTS (
                SELECT 1
                FROM resource_content_hashes
                WHERE resource_id = post_processing_jobs.resource_id
                AND content_hash = post_processing_jobs.content_hash
            )"#;

        self.conn
            .execute(update_query, rusqlite::params![failed, created_at])?;
        Ok(())
    }
}
