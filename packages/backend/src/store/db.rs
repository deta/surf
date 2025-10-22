use crate::{BackendError, BackendResult};

use rusqlite::Connection;

use super::migrations::migrate;

pub fn setup_connection_settings(conn: &rusqlite::Connection) -> BackendResult<()> {
    let exec_pragma = |pragma: &str| -> BackendResult<()> {
        match conn.query_row(pragma, [], |_| Ok(())) {
            Ok(_) => Ok(()),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(()), // Ignore no rows
            Err(e) => Err(BackendError::DatabaseError(e)),
        }
    };

    // this is persistent and only needs to be set once
    exec_pragma("PRAGMA journal_mode = WAL;")?;

    // performance settings for allowing multi-thread architecture
    // needs to be set on every connection

    // synchronous mode - NORMAL is safe in WAL mode and much faster than FULL
    exec_pragma("PRAGMA synchronous = NORMAL;")?;

    // store temporary tables and indices in memory for better performance
    exec_pragma("PRAGMA temp_store = MEMORY;")?;

    // conservative memory settings for multi-process browser (32MB cache per connection)
    exec_pragma("PRAGMA cache_size = -32000;")?;

    // memory-mapped I/O - 512MB per process (conservative for many tabs)
    // OS manages actual memory usage, this just sets virtual memory limit
    exec_pragma("PRAGMA mmap_size = 536870912;")?;

    // critical for multi-tab contention - 60 second timeout for database locks
    // with many tabs writing concurrently, some will need to wait
    exec_pragma("PRAGMA busy_timeout = 60000;")?;

    // more frequent WAL checkpoints to prevent WAL file growth with many processes
    // default is 1000, but with many concurrent processes, 100 is better
    exec_pragma("PRAGMA wal_autocheckpoint = 100;")?;

    // optimize page size for mixed read/write workloads (4KB is good default)
    exec_pragma("PRAGMA page_size = 4096;")?;

    // auto-analyze for better query planning (run periodically)
    exec_pragma("PRAGMA optimize;")?;

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

        setup_connection_settings(&conn)?;
        setup_connection_settings(&read_only_conn)?;

        if run_migrations {
            let backup_db_path = format!("{}.backup", db_path);
            migrate(&mut conn, &backup_db_path)?
        }
        rusqlite::vtab::array::load_module(&conn)?;
        rusqlite::vtab::array::load_module(&read_only_conn)?;

        Ok(Database {
            conn,
            read_only_conn,
        })
    }

    pub fn begin(&mut self) -> BackendResult<rusqlite::Transaction<'_>> {
        Ok(self.conn.transaction()?)
    }
}
