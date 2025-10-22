use crate::{store::db::Database, BackendResult};

use rusqlite::OptionalExtension;

impl Database {
    pub fn upsert_resource_hash_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        hash: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT OR REPLACE INTO resource_content_hashes (resource_id, content_hash) VALUES (?, ?)",
            [resource_id, hash],
        )?;
        Ok(())
    }

    pub fn get_resource_hash(&self, resource_id: &str) -> BackendResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT content_hash FROM resource_content_hashes WHERE resource_id = ?")?;
        let hash = stmt.query_row([resource_id], |row| row.get(0)).optional()?;
        Ok(hash)
    }

    pub fn delete_resource_hash_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_content_hashes WHERE resource_id = ?",
            [resource_id],
        )?;
        Ok(())
    }
}
