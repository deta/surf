use crate::{BackendError, BackendResult};

use rusqlite::Connection;

use super::migrations::migrate;

pub fn enable_wal_mode(conn: &rusqlite::Connection) -> BackendResult<()> {
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
            let backup_db_path = format!("{}.backup", db_path);
            migrate(&mut conn, &backup_db_path)?
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
