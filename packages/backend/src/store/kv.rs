use rusqlite::{params, Connection};
use serde_json::Value;
use strum::Display;

use crate::BackendResult;

use super::db::setup_connection_settings;

#[derive(thiserror::Error, Debug, Display)]
pub enum KeyValueStoreError {
    InvalidTableName,
    KeyNotFound,
    InvalidValue,
    InternalError(String),
}

fn valid_table_name(table_name: &str) -> BackendResult<()> {
    if !table_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(KeyValueStoreError::InvalidTableName.into());
    }
    Ok(())
}

pub struct KeyValueStore {
    conn: Connection,
}

impl KeyValueStore {
    pub fn new(db_path: &str) -> BackendResult<Self> {
        let conn = Connection::open(db_path)?;
        setup_connection_settings(&conn)?;
        Ok(KeyValueStore { conn })
    }

    pub fn new_table(&mut self, table: &str) -> BackendResult<()> {
        valid_table_name(table)?;
        self.conn.execute(
            &format!(
                "CREATE TABLE IF NOT EXISTS {} (
                    key TEXT PRIMARY KEY,
                    data JSON NOT NULL
                )",
                table
            ),
            [],
        )?;
        Ok(())
    }

    pub fn put(&self, table: &str, key: &str, json_data: &str) -> BackendResult<()> {
        let _: Value =
            serde_json::from_str(json_data).map_err(|_| KeyValueStoreError::InvalidValue)?;

        self.conn.execute(
            &format!("INSERT OR REPLACE INTO {} (key, data) VALUES (?, ?)", table),
            params![key, json_data],
        )?;
        Ok(())
    }

    pub fn list(&self, table: &str) -> BackendResult<Vec<String>> {
        let mut stmt = self.conn.prepare(&format!("SELECT data FROM {}", table))?;
        let rows = stmt.query_map([], |row| {
            let data: String = row.get(0)?;
            Ok(data)
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get(&self, table: &str, key: &str) -> BackendResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare(&format!("SELECT data FROM {} WHERE key = ?", table))?;

        let json_str = match stmt.query_row(params![key], |row| {
            let data: String = row.get(0)?;
            Ok(data)
        }) {
            Ok(data) => data,
            Err(e) => match e {
                rusqlite::Error::QueryReturnedNoRows => return Ok(None),
                _ => return Err(e.into()),
            },
        };

        Ok(Some(json_str))
    }

    pub fn update(&self, table: &str, key: &str, changes_json: &str) -> BackendResult<()> {
        let changes_value: Value =
            serde_json::from_str(changes_json).map_err(|_| KeyValueStoreError::InvalidValue)?;

        if let Value::Object(changes_map) = changes_value {
            let mut stmt = self
                .conn
                .prepare(&format!("SELECT data FROM {} WHERE key = ?", table))?;

            let current_data_str = match stmt.query_row(params![key], |row| {
                let data: String = row.get(0)?;
                Ok(data)
            }) {
                Ok(data) => data,
                Err(e) => match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        return Err(KeyValueStoreError::KeyNotFound.into())
                    }
                    _ => return Err(e.into()),
                },
            };

            let mut current_data: Value = serde_json::from_str(&current_data_str).map_err(|e| {
                KeyValueStoreError::InternalError(format!("failed to parse current data: {}", e))
            })?;

            if let Value::Object(current_map) = &mut current_data {
                for (field, value) in changes_map {
                    current_map.insert(field, value);
                }

                let updated_json = serde_json::to_string(&current_data).map_err(|e| {
                    KeyValueStoreError::InternalError(format!(
                        "failed to serialize updated data: {}",
                        e
                    ))
                })?;

                self.conn.execute(
                    &format!("UPDATE {} SET data = ? WHERE key = ?", table),
                    params![updated_json, key],
                )?;
            }
        } else {
            return Err(KeyValueStoreError::InvalidValue.into());
        }
        Ok(())
    }

    pub fn delete(&self, table: &str, key: &str) -> BackendResult<()> {
        self.conn.execute(
            &format!("DELETE FROM {} WHERE key = ?", table),
            params![key],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use tempfile::tempdir;

    #[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
    struct Address {
        street: String,
        city: String,
        state: String,
        postal_code: String,
        country: String,
    }

    #[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
    struct ContactInfo {
        email: String,
        phone: Option<String>,
        social_media: HashMap<String, String>,
        addresses: HashMap<String, Address>,
        preferred_address: String,
    }

    #[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
    struct TestUser {
        name: String,
        age: u32,
        email: String,
    }

    #[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
    struct ComplexUser {
        id: String,
        name: String,
        age: u32,
        active: bool,
        contact: ContactInfo,
        tags: Vec<String>,
        preferences: HashMap<String, serde_json::Value>,
        metadata: Option<HashMap<String, String>>,
        created_at: String,
        updated_at: Option<String>,
    }

    fn setup_test_db() -> (KeyValueStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_db.sqlite");
        let mut store = KeyValueStore::new(db_path.to_str().unwrap()).unwrap();
        store.new_table("users").unwrap();
        store.new_table("config").unwrap();
        (store, dir)
    }

    #[test]
    fn test_new_store() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_db.sqlite");
        let store = KeyValueStore::new(db_path.to_str().unwrap());
        assert!(store.is_ok());
    }

    #[test]
    fn test_invalid_table_name() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_db.sqlite");
        let mut store = KeyValueStore::new(db_path.to_str().unwrap()).unwrap();

        let result = store.new_table("invalid-table-name");
        assert!(result.is_err());

        let error = result.unwrap_err().to_string();
        assert!(error.contains("InvalidTableName"));
    }

    #[test]
    fn test_new_table() {
        let (mut store, _dir) = setup_test_db();
        let result = store.new_table("products");
        assert!(result.is_ok());
    }

    #[test]
    fn test_put_get() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Alice", "age": 30, "email": "alice@example.com"}"#;

        let result = store.put("users", "user1", user_json);
        assert!(result.is_ok());

        let retrieved = store.get("users", "user1").unwrap();
        assert!(retrieved.is_some());

        let retrieved_json = retrieved.unwrap();

        let original: Value = serde_json::from_str(user_json).unwrap();
        let retrieved: Value = serde_json::from_str(&retrieved_json).unwrap();
        assert_eq!(retrieved, original);

        let parsed_user: TestUser = serde_json::from_str(&retrieved_json).unwrap();
        assert_eq!(parsed_user.name, "Alice");
        assert_eq!(parsed_user.age, 30);
        assert_eq!(parsed_user.email, "alice@example.com");
    }

    #[test]
    fn test_get_nonexistent() {
        let (store, _dir) = setup_test_db();

        let retrieved = store.get("users", "nonexistent").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_update() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Bob", "age": 25, "email": "bob@example.com"}"#;

        store.put("users", "user2", user_json).unwrap();

        let partial_json = r#"{"age": 26}"#;
        store.update("users", "user2", partial_json).unwrap();

        let retrieved = store.get("users", "user2").unwrap();
        assert!(retrieved.is_some());

        let updated_json = retrieved.unwrap();
        let updated_user: TestUser = serde_json::from_str(&updated_json).unwrap();
        assert_eq!(updated_user.name, "Bob");
        assert_eq!(updated_user.age, 26); // Updated
        assert_eq!(updated_user.email, "bob@example.com");
    }

    #[test]
    fn test_update_nonexistent() {
        let (store, _dir) = setup_test_db();

        let partial_json = r#"{"age": 30}"#;
        match store.update("users", "nonexistent", partial_json) {
            Ok(_) => panic!("Expected error"),
            Err(e) => {
                assert!(e.to_string().contains("KeyNotFound"));
            }
        };
    }

    #[test]
    fn test_delete() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Charlie", "age": 40, "email": "charlie@example.com"}"#;

        store.put("users", "user3", user_json).unwrap();

        let exists = store.get("users", "user3").unwrap();
        assert!(exists.is_some());

        store.delete("users", "user3").unwrap();

        let after_delete = store.get("users", "user3").unwrap();
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_delete_nonexistent() {
        let (store, _dir) = setup_test_db();
        store.delete("users", "nonexistent").unwrap();
    }

    #[test]
    fn test_nonexistent_table() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Dave", "age": 35, "email": "dave@example.com"}"#;

        let result = store.put("nonexistent_table", "user4", user_json);
        assert!(result.is_err());

        let error = result.unwrap_err().to_string();
        assert!(error.contains("nonexistent_table"));
    }

    #[test]
    fn test_complex_data() {
        let (store, _dir) = setup_test_db();

        let complex_json = r#"{
            "name": "Complex",
            "numbers": [1, 2, 3, 4, 5],
            "metadata": {
                "created": "today",
                "author": "test"
            }
        }"#;

        store.put("config", "complex_data", complex_json).unwrap();

        let retrieved = store.get("config", "complex_data").unwrap();
        assert!(retrieved.is_some());

        let original: Value = serde_json::from_str(complex_json).unwrap();
        let retrieved: Value = serde_json::from_str(&retrieved.unwrap()).unwrap();
        assert_eq!(retrieved, original);
    }

    #[test]
    fn test_invalid_json_put() {
        let (store, _dir) = setup_test_db();

        let invalid_json = r#"{"name": "Invalid", "age": missing quotes}"#;
        let result = store.put("users", "invalid", invalid_json);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("InvalidValue"));
    }

    #[test]
    fn test_invalid_json_update() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Charlie", "age": 40, "email": "charlie@example.com"}"#;
        store.put("users", "invalid_json_test", user_json).unwrap();

        let invalid_json = r#"{"age": 41, "name": "missing quote}"#;
        let result = store.update("users", "invalid_json_test", invalid_json);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("InvalidValue"));

        let array_json = r#"[1, 2, 3]"#;
        let result = store.update("users", "invalid_json_test", array_json);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("InvalidValue"));
    }

    #[test]
    fn test_nested_complex_put_get() {
        let (store, _dir) = setup_test_db();

        let complex_user = create_complex_user();
        let complex_user_json = serde_json::to_string(&complex_user).unwrap();

        let result = store.put("users", "complex1", &complex_user_json);
        assert!(result.is_ok());

        let retrieved = store.get("users", "complex1").unwrap();
        assert!(retrieved.is_some());

        let retrieved_json = retrieved.unwrap();
        let retrieved_user: ComplexUser = serde_json::from_str(&retrieved_json).unwrap();
        assert_eq!(retrieved_user, complex_user);

        assert_eq!(retrieved_user.contact.addresses.len(), 2);
        assert_eq!(retrieved_user.contact.social_media.len(), 3);
        assert_eq!(retrieved_user.tags.len(), 4);
    }

    #[test]
    fn test_update_empty_changes() {
        let (store, _dir) = setup_test_db();

        let user_json = r#"{"name": "Empty", "age": 30, "email": "empty@example.com"}"#;
        store.put("users", "empty_update", user_json).unwrap();

        let empty_json = r#"{}"#;
        store.update("users", "empty_update", empty_json).unwrap();

        let retrieved = store.get("users", "empty_update").unwrap().unwrap();

        let original: Value = serde_json::from_str(user_json).unwrap();
        let retrieved: Value = serde_json::from_str(&retrieved).unwrap();
        assert_eq!(retrieved, original);
    }

    #[test]
    fn test_overwrite() {
        let (store, _dir) = setup_test_db();

        let user1_json = r#"{"name": "Original", "age": 50, "email": "original@example.com"}"#;
        let user2_json =
            r#"{"name": "Replacement", "age": 25, "email": "replacement@example.com"}"#;

        store.put("users", "overwrite_test", user1_json).unwrap();
        store.put("users", "overwrite_test", user2_json).unwrap();

        let retrieved = store.get("users", "overwrite_test").unwrap();
        assert!(retrieved.is_some());

        let original: Value = serde_json::from_str(user2_json).unwrap();
        let retrieved: Value = serde_json::from_str(&retrieved.unwrap()).unwrap();
        assert_eq!(retrieved, original);
    }

    fn create_complex_user() -> ComplexUser {
        let mut addresses = HashMap::new();
        addresses.insert(
            "home".to_string(),
            Address {
                street: "123 Main St".to_string(),
                city: "Anytown".to_string(),
                state: "CA".to_string(),
                postal_code: "12345".to_string(),
                country: "USA".to_string(),
            },
        );
        addresses.insert(
            "shipping".to_string(),
            Address {
                street: "456 Oak Ave".to_string(),
                city: "Other City".to_string(),
                state: "NY".to_string(),
                postal_code: "67890".to_string(),
                country: "USA".to_string(),
            },
        );

        let mut social_media = HashMap::new();
        social_media.insert("twitter".to_string(), "@testuser".to_string());
        social_media.insert("github".to_string(), "testuser123".to_string());
        social_media.insert("linkedin".to_string(), "linkedin/testuser".to_string());

        let mut preferences = HashMap::new();
        preferences.insert("theme".to_string(), serde_json::json!("dark"));
        preferences.insert("notifications".to_string(), serde_json::json!(true));
        preferences.insert("refresh_interval".to_string(), serde_json::json!(300));
        preferences.insert(
            "filters".to_string(),
            serde_json::json!(["recent", "popular"]),
        );
        preferences.insert(
            "layout".to_string(),
            serde_json::json!({
                "sidebar": "left",
                "width": 250,
                "collapsed": false
            }),
        );

        let mut metadata = HashMap::new();
        metadata.insert("created_by".to_string(), "system".to_string());
        metadata.insert("source".to_string(), "api".to_string());

        let contact = ContactInfo {
            email: "test@example.com".to_string(),
            phone: Some("555-123-4567".to_string()),
            social_media,
            addresses,
            preferred_address: "home".to_string(),
        };

        ComplexUser {
            id: "usr_123456".to_string(),
            name: "Test User".to_string(),
            age: 35,
            active: true,
            contact,
            tags: vec![
                "test".to_string(),
                "example".to_string(),
                "complex".to_string(),
                "user".to_string(),
            ],
            preferences,
            metadata: Some(metadata),
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: Some("2023-01-02T12:34:56Z".to_string()),
        }
    }
}
