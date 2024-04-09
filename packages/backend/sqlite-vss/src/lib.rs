#[cfg(feature = "vector")]
#[link(name = "sqlite_vector0")]
extern "C" {
    pub fn sqlite3_vector_init();
}

#[cfg(feature = "vss")]
#[link(name = "sqlite_vss0")]
extern "C" {
    pub fn sqlite3_vss_init();
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{ffi::sqlite3_auto_extension, Connection};

    #[test]
    fn test_rusqlite_auto_extension() {
        unsafe {
            sqlite3_auto_extension(Some(sqlite3_vector_init));
            sqlite3_auto_extension(Some(sqlite3_vss_init));
        }

        let conn = Connection::open_in_memory().unwrap();

        let result: String = conn
            .query_row("select vss_version()", [], |row| row.get(0))
            .unwrap();

        assert_eq!(result, format!("v{}", env!("CARGO_PKG_VERSION")));

        let result: String = conn
            .query_row(
                "select vector_to_json(?)",
                [[0x00, 0x00, 0x28, 0x42]],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(result, "[42.0]");
    }
}
