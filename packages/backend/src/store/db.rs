use crate::{BackendError, BackendResult};

use rusqlite::Connection;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "migrations/"]
struct Migrations;

fn enable_wal_mode(conn: &rusqlite::Connection) -> BackendResult<()> {
    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode = WAL;", [], |row| row.get(0))
        .map_err(BackendError::DatabaseError)?;
    if journal_mode.to_lowercase() != "wal" {
        return Err(BackendError::GenericError(
            "failed to enable WAL mode".into(),
        ));
    }
    Ok(())
}

fn execute_ignoring_duplicate_column<T, E>(f: impl FnOnce() -> Result<T, E>) -> Result<Option<T>, E>
where
    E: std::fmt::Display,
{
    match f() {
        Ok(t) => Ok(Some(t)),
        Err(e) => {
            if e.to_string().contains("duplicate column name") {
                Ok(None)
            } else {
                Err(e)
            }
        }
    }
}

pub struct Database {
    pub conn: rusqlite::Connection,
    pub read_only_conn: rusqlite::Connection,
}

impl Database {
    pub fn new(db_path: &str, run_migrations: bool) -> BackendResult<Database> {
        let mut conn = Connection::open(db_path)?;
        let read_only_conn =
            Connection::open_with_flags(db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;

        conn.busy_timeout(std::time::Duration::from_secs(60))?;
        read_only_conn.busy_timeout(std::time::Duration::from_secs(60))?;

        enable_wal_mode(&conn)?;
        enable_wal_mode(&read_only_conn)?;

        if run_migrations {
            let init_schema = Migrations::get("init.sql")
                .ok_or(BackendError::GenericError("init.sql not found".into()))?;
            let init_schema = std::str::from_utf8(init_schema.data.as_ref())
                .map_err(|e| BackendError::GenericError(e.to_string()))?;
            let migrations_schema = Migrations::get("migrations.sql")
                .map(|f| std::str::from_utf8(f.data.as_ref()).map(|s| s.to_owned()))
                .transpose()
                .map_err(|e| BackendError::GenericError(e.to_string()))?;

            let tx = conn.transaction()?;

            // TODO: have proper migration schema
            // sqlite doesn't support IF NOT EXISTS on columns, so we need to ignore the error
            execute_ignoring_duplicate_column(|| tx.execute_batch(init_schema))?;
            if let Some(schema) = migrations_schema {
                execute_ignoring_duplicate_column(|| tx.execute_batch(&schema))?;
            }

            tx.commit()?;
        }
        // TODO: do we need this?
        rusqlite::vtab::array::load_module(&conn)?;
        rusqlite::vtab::array::load_module(&read_only_conn)?;

        Ok(Database {
            conn,
            read_only_conn,
        })
    }

    pub fn begin(&mut self) -> BackendResult<rusqlite::Transaction> {
        Ok(self.conn.transaction()?)
    }
}
