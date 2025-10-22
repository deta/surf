use std::collections::HashMap;

use crate::{BackendError, BackendResult};

use rusqlite::{backup, Connection};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "migrations/"]
struct Migrations;

fn get_current_db_version(conn: &Connection) -> BackendResult<u64> {
    let version: u64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    Ok(version)
}

fn update_db_version(conn: &Connection, version: u64) -> BackendResult<()> {
    conn.execute(format!("PRAGMA user_version = {}", version).as_str(), [])?;
    Ok(())
}

// format of migration filename: <version>_<description>.sql
// returns a list of migration filenames sorted by version number
fn parse_migration_filenames() -> BackendResult<Vec<String>> {
    let mut migrations = HashMap::new();
    for file in Migrations::iter() {
        let filename = file.as_ref();
        let version = filename
            .split('_')
            .next()
            .ok_or_else(|| {
                BackendError::GenericError(format!("Invalid migration filename: {}", filename))
            })?
            .parse::<u64>()
            .map_err(|e| {
                BackendError::GenericError(format!(
                    "Failed to parse migration version from filename: {}",
                    e
                ))
            })?;
        migrations.insert(version, filename.to_string());
    }
    let mut entries: Vec<_> = migrations.into_iter().collect();
    entries.sort_by_key(|a| a.0);
    Ok(entries.into_iter().map(|(_, v)| v).collect())
}

#[allow(dead_code)]
pub fn backup_db(source_conn: &mut Connection, backup_db_path: &str) -> BackendResult<()> {
    let mut backup_conn = Connection::open(backup_db_path)?;
    let bk = backup::Backup::new(source_conn, &mut backup_conn)?;
    bk.step(-1)?;
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

pub fn run_migration(tx: &mut rusqlite::Transaction, migration_file: &str) -> BackendResult<()> {
    let migration = Migrations::get(migration_file).ok_or_else(|| {
        BackendError::GenericError(format!("Migration file not found: {}", migration_file))
    })?;
    let migration = std::str::from_utf8(migration.data.as_ref())
        .map_err(|e| BackendError::GenericError(e.to_string()))?;
    execute_ignoring_duplicate_column(|| tx.execute_batch(migration))?;
    Ok(())
}

// TODO: run backup
pub fn migrate(conn: &mut Connection, _backup_db_path: &str) -> BackendResult<()> {
    let current_version = get_current_db_version(conn)?;
    let migration_files = parse_migration_filenames()?;
    if migration_files.is_empty() {
        return Ok(());
    }
    let latest_version = migration_files.len() as u64;
    if current_version < latest_version {
        //backup_db(conn, backup_db_path)?;
        let mut tx = conn.transaction()?;
        for migration_file in migration_files.iter().skip(current_version as usize) {
            run_migration(&mut tx, migration_file)?;
        }
        update_db_version(&tx, latest_version)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::tempdir;

    fn setup_test_db() -> (Connection, tempfile::TempDir) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        (conn, temp_dir)
    }

    #[test]
    fn test_get_current_db_version() {
        let (conn, _temp_dir) = setup_test_db();

        let version = get_current_db_version(&conn).unwrap();
        assert_eq!(version, 0);

        conn.execute("PRAGMA user_version = 5", []).unwrap();
        let version = get_current_db_version(&conn).unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn test_update_db_version() {
        let (conn, _temp_dir) = setup_test_db();

        update_db_version(&conn, 10).unwrap();

        let version: u64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 10);
    }

    #[test]
    fn test_parse_migration_filenames() {
        // this will depend on the actual migrations folder content
        // for proper unit testing, we need to mock the RustEmbed trait
        // or use a test-specific folder with controlled content

        // for now, we'll just verify the function doesn't error and sorts correctly
        let filenames = parse_migration_filenames().unwrap();
        if filenames.len() > 1 {
            for i in 0..filenames.len() - 1 {
                let version1 = filenames[i]
                    .split('_')
                    .next()
                    .unwrap()
                    .parse::<u64>()
                    .unwrap();
                let version2 = filenames[i + 1]
                    .split('_')
                    .next()
                    .unwrap()
                    .parse::<u64>()
                    .unwrap();
                assert!(version1 < version2);
            }
        }
    }

    #[test]
    fn test_backup_db() {
        let (mut conn, temp_dir) = setup_test_db();

        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", [])
            .unwrap();
        conn.execute("INSERT INTO test (name) VALUES (?1)", ["test_value"])
            .unwrap();

        let backup_path = temp_dir.path().join("backup.db");
        backup_db(&mut conn, backup_path.to_str().unwrap()).unwrap();

        assert!(backup_path.exists());

        let backup_conn = Connection::open(backup_path).unwrap();
        let name: String = backup_conn
            .query_row("SELECT name FROM test WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(name, "test_value");
    }
}
