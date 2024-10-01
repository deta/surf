use std::collections::HashMap;
use std::rc::Rc;
use std::str::FromStr;

use super::models::*;
use crate::{BackendError, BackendResult};

use rusqlite::{Connection, OptionalExtension};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};

#[derive(RustEmbed)]
#[folder = "migrations/"]
struct Migrations;

pub struct Database {
    pub conn: rusqlite::Connection,
    pub read_only_conn: rusqlite::Connection,
}

pub struct PaginatedResources {
    pub resources: Vec<Resource>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub struct PaginatedCards {
    pub cards: Vec<Card>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub struct PaginatedHorizons {
    pub horizons: Vec<Horizon>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompositeResource {
    pub resource: Resource,
    pub metadata: Option<ResourceMetadata>,
    pub text_content: Option<ResourceTextContent>,
    pub resource_tags: Option<Vec<ResourceTag>>,
    pub resource_annotations: Option<Vec<Resource>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SearchEngine {
    Keyword,
    Proximity,
    Embeddings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResultItem {
    pub resource: CompositeResource,
    pub card_ids: Vec<String>,
    pub ref_resource_id: Option<String>,
    pub distance: Option<f32>,
    pub engine: SearchEngine,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub items: Vec<SearchResultItem>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResultSimple {
    pub items: Vec<String>,
    pub total: i64,
}

#[derive(Debug)]
pub struct VectorSearchResult {
    pub rowid: i64,
    pub distance: f32,
}

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

fn escape_fts_query(keyword: &str) -> String {
    let escaped_quotes = keyword.replace(r#"""#, r#"""""#);
    let tokens: Vec<&str> = escaped_quotes.split_whitespace().collect();

    tokens
        .into_iter()
        .map(|token| format!(r#""{}""#, token))
        .collect::<Vec<String>>()
        .join(" ")
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
            tx.execute_batch(init_schema)?;
            if let Some(schema) = migrations_schema {
                tx.execute_batch(&schema)?;
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

    pub fn create_space(&mut self, space: &Space) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![space.id, space.name, space.created_at, space.updated_at],
        )?;
        Ok(())
    }

    pub fn create_space_tx(tx: &mut rusqlite::Transaction, space: &Space) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![space.id, space.name, space.created_at, space.updated_at],
        )?;
        Ok(())
    }

    pub fn update_space_name(&mut self, space_id: &str, name: &str) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE spaces SET name = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![space_id, name, current_time()],
        )?;
        Ok(())
    }

    pub fn delete_space(&self, space_id: &str) -> BackendResult<()> {
        self.conn.execute(
            "DELETE FROM spaces WHERE id = ?1",
            rusqlite::params![space_id],
        )?;
        Ok(())
    }

    pub fn get_space(&self, space_id: &str) -> BackendResult<Option<Space>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, created_at, updated_at FROM spaces WHERE id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![space_id], |row| {
                Ok(Space {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .optional()?)
    }

    pub fn list_spaces(&self) -> BackendResult<Vec<Space>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at, updated_at FROM spaces ORDER BY updated_at DESC",
        )?;
        let spaces = stmt.query_map([], |row| {
            Ok(Space {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        let mut result = Vec::new();
        for space in spaces {
            result.push(space?);
        }
        Ok(result)
    }

    pub fn create_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        space_entry: &SpaceEntry,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO space_entries (id, space_id, resource_id, created_at, updated_at, manually_added) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![space_entry.id, space_entry.space_id, space_entry.resource_id, space_entry.created_at, space_entry.updated_at, space_entry.manually_added]
        )?;
        Ok(())
    }

    pub fn update_space_entry(&mut self, space_entry: &SpaceEntry) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE space_entries SET space_id = ?2, resource_id = ?3, created_at = ?4, updated_at = ?5, manually_added = ?6 WHERE id = ?1",
            rusqlite::params![space_entry.id, space_entry.space_id, space_entry.resource_id, space_entry.created_at, space_entry.updated_at, space_entry.manually_added]
        )?;
        Ok(())
    }

    pub fn delete_space_entry_tx(
        tx: &mut rusqlite::Transaction,
        space_entry_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM space_entries WHERE id = ?1",
            rusqlite::params![space_entry_id],
        )?;
        Ok(())
    }

    pub fn get_space_entry(&self, space_entry_id: &str) -> BackendResult<Option<SpaceEntry>> {
        let mut stmt = self.conn.prepare("SELECT id, space_id, resource_id, created_at, updated_at, manually_added FROM space_entries WHERE id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![space_entry_id], |row| {
                Ok(SpaceEntry {
                    id: row.get(0)?,
                    space_id: row.get(1)?,
                    resource_id: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    manually_added: row.get(5)?,
                })
            })
            .optional()?)
    }

    pub fn list_space_entries(&self, space_id: &str) -> BackendResult<Vec<SpaceEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, space_id, resource_id, created_at, updated_at, manually_added FROM space_entries WHERE space_id = ?1 ORDER BY updated_at DESC")?;
        let space_entries = stmt.query_map(rusqlite::params![space_id], |row| {
            Ok(SpaceEntry {
                id: row.get(0)?,
                space_id: row.get(1)?,
                resource_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                manually_added: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for space_entry in space_entries {
            result.push(space_entry?);
        }
        Ok(result)
    }

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

    pub fn list_resource_annotations(
        &self,
        resource_ids: &[&str],
    ) -> BackendResult<HashMap<String, Vec<Resource>>> {
        if resource_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders = vec!["?"; resource_ids.len()].join(", ");
        let query = format!("
            SELECT r.id, r.resource_path, r.resource_type, r.created_at, r.updated_at, r.deleted, rt.tag_value
            FROM resources r
            JOIN resource_tags rt ON r.id = rt.resource_id
            WHERE r.deleted = 0 AND r.resource_type = 'application/vnd.space.annotation' AND rt.tag_name = 'annotates' AND rt.tag_value IN ({})",
            placeholders
        );

        let mut stmt = self.conn.prepare(&query)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(resource_ids.iter()), |row| {
            Ok((
                row.get::<_, String>(6)?, // tag_value (resource_id being annotated)
                Resource {
                    id: row.get(0)?,
                    resource_path: row.get(1)?,
                    resource_type: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    deleted: row.get(5)?,
                },
            ))
        })?;

        let mut result: HashMap<String, Vec<Resource>> = HashMap::new();
        for row in rows {
            let (tag_value, resource) = row.map_err(BackendError::DatabaseError)?;
            result
                .entry(tag_value)
                .or_insert_with(Vec::new)
                .push(resource);
        }

        Ok(result)
    }

    pub fn remove_resource_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute("DELETE FROM resources WHERE id = ?1", rusqlite::params![id])?;
        Self::remove_resource_metadata_tx(tx, id)?;
        Self::remove_resource_text_content_tx(tx, id)?;
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
            |row| Ok(row.get(0)?),
        )?;
        Ok(PaginatedResources {
            resources: result,
            total,
            limit,
            offset,
        })
    }

    pub fn list_resource_tags(&self, resource_id: &str) -> BackendResult<Vec<ResourceTag>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, resource_id, tag_name, tag_value FROM resource_tags WHERE resource_id = ?1",
        )?;
        let resource_tags = stmt.query_map(rusqlite::params![resource_id], |row| {
            Ok(ResourceTag {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                tag_name: row.get(2)?,
                tag_value: row.get(3)?,
            })
        })?;
        let mut result = Vec::new();
        for resource_tag in resource_tags {
            result.push(resource_tag?);
        }
        Ok(result)
    }

    pub fn count_resource_refs_in_cards_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        horizon_id: &str,
    ) -> BackendResult<i64> {
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM cards WHERE resource_id = ?1 AND horizon_id = ?2",
            rusqlite::params![resource_id, horizon_id],
            |row| Ok(row.get(0)?),
        )?;
        Ok(count)
    }

    pub fn create_resource_tag_tx(
        tx: &mut rusqlite::Transaction,
        resource_tag: &ResourceTag,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_tags (id, resource_id, tag_name, tag_value) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(resource_id, tag_name, tag_value) DO NOTHING",
            rusqlite::params![resource_tag.id, resource_tag.resource_id, resource_tag.tag_name, resource_tag.tag_value]
        )?;

        Self::touch_resource_tx(tx, &resource_tag.resource_id)?;

        Ok(())
    }

    pub fn update_resource_tag_by_name_tx(
        tx: &mut rusqlite::Transaction,
        resource_tag: &ResourceTag,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_tags SET tag_value = ?3 WHERE resource_id = ?1 AND tag_name = ?2",
            rusqlite::params![
                resource_tag.resource_id,
                resource_tag.tag_name,
                resource_tag.tag_value
            ],
        )?;

        Self::touch_resource_tx(tx, &resource_tag.resource_id)?;

        Ok(())
    }

    pub fn update_resource_tag_tx(
        tx: &mut rusqlite::Transaction,
        resource_tag: &ResourceTag,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_tags SET resource_id = ?2, tag_name = ?3, tag_value = ?4 WHERE id = ?1",
            rusqlite::params![resource_tag.id, resource_tag.resource_id, resource_tag.tag_name, resource_tag.tag_value]
        )?;

        Self::touch_resource_tx(tx, &resource_tag.resource_id)?;

        Ok(())
    }

    pub fn remove_resource_tag_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        let resource_id: String = tx.query_row(
            "SELECT resource_id FROM resource_tags WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok(row.get(0)?),
        )?;

        tx.execute(
            "DELETE FROM resource_tags WHERE id = ?1",
            rusqlite::params![id],
        )?;

        Self::touch_resource_tx(tx, &resource_id)?;

        Ok(())
    }

    pub fn remove_resource_tag_by_tag_name_tx(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        tag_name: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_tags WHERE resource_id = ?1 AND tag_name = ?2",
            rusqlite::params![resource_id, tag_name],
        )?;

        Self::touch_resource_tx(tx, resource_id)?;

        Ok(())
    }

    pub fn create_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_metadata (id, resource_id, name, source_uri, alt, user_context) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt, resource_metadata.user_context]
        )?;
        Ok(())
    }

    pub fn update_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_metadata SET resource_id = ?2, name = ?3, source_uri = ?4, alt = ?5, user_context=?6 WHERE id = ?1",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt, resource_metadata.user_context]
        )?;

        Self::touch_resource_tx(tx, &resource_metadata.resource_id)?;

        Ok(())
    }

    pub fn remove_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_metadata WHERE resource_id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get_resource_metadata_by_resource_id(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<ResourceMetadata>> {
        let query = "SELECT id, resource_id, name, source_uri, alt, user_context FROM resource_metadata WHERE resource_id = ?1 LIMIT 1";
        self.conn
            .query_row(query, rusqlite::params![resource_id], |row| {
                Ok(ResourceMetadata {
                    id: row.get(0)?,
                    resource_id: row.get(1)?,
                    name: row.get(2)?,
                    source_uri: row.get(3)?,
                    alt: row.get(4)?,
                    user_context: row.get(5)?,
                })
            })
            .optional()
            .map_err(|e| e.into())
    }

    pub fn create_resource_text_content(
        &mut self,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        self.conn.execute(
            "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content,
                resource_text_content.content_type,
                resource_text_content.metadata,
            ],
        )?;
        Ok(())
    }

    pub fn legacy_get_resource_text_content_by_resource_id(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<LegacyResourceTextContent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, resource_id, content FROM resource_text_content WHERE resource_id = ?1",
        )?;
        stmt.query_row(rusqlite::params![resource_id], |row| {
            Ok(LegacyResourceTextContent {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                content: row.get(2)?,
            })
        })
        .optional()
        .map_err(|e| e.into())
    }

    pub fn get_resource_text_content(
        &self,
        id: &str,
    ) -> BackendResult<Option<ResourceTextContent>> {
        let mut stmt = self.conn.prepare("SELECT id, resource_id, content, content_type, metadata FROM resource_text_content WHERE id = ?1")?;
        stmt.query_row(rusqlite::params![id], |row| {
            Ok(ResourceTextContent {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                content: row.get(2)?,
                content_type: row.get(3)?,
                metadata: row.get(4)?,
            })
        })
        .optional()
        .map_err(|e| e.into())
    }

    pub fn create_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content,
                resource_text_content.content_type,
                resource_text_content.metadata,
            ],
        )?;
        Ok(())
    }

    pub fn update_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        resource_text_content: &ResourceTextContent,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE resource_text_content SET resource_id = ?2, content = ?3 WHERE id = ?1",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content
            ],
        )?;
        Ok(())
    }

    pub fn remove_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_text_content WHERE resource_id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn upsert_resource_text_content(
        tx: &mut rusqlite::Transaction,
        resource_id: &str,
        content_type: &ResourceTextContentType,
        contents: &Vec<String>,
        metadatas: &Vec<ResourceTextContentMetadata>,
    ) -> BackendResult<Vec<i64>> {
        tx.execute(
            "DELETE FROM resource_text_content WHERE resource_id = ?1 AND content_type = ?2",
            rusqlite::params![resource_id, content_type],
        )?;
        let mut rowids = Vec::new();
        for (content, metadata) in contents.iter().zip(metadatas.iter()) {
            tx.execute(
                "INSERT INTO resource_text_content (id, resource_id, content, content_type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![random_uuid(), resource_id, content, content_type, metadata],
            )?;
            rowids.push(tx.last_insert_rowid());
        }
        Ok(rowids)
    }

    pub fn create_card_position_tx(
        tx: &mut rusqlite::Transaction,
        card_position: &CardPosition,
    ) -> BackendResult<()> {
        let rowid = match card_position.rowid {
            Some(rowid) => rowid,
            None => Err(BackendError::GenericError(
                "rowid must be specified for card_position".to_string(),
            ))?,
        };
        let mut stmt =
            tx.prepare("INSERT INTO card_positions (rowid, position) VALUES (?1, ?2)")?;
        stmt.insert(rusqlite::params![rowid, card_position.position])?;
        Ok(())
    }

    pub fn remove_card_position_tx(
        tx: &mut rusqlite::Transaction,
        rowid: &i64,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM card_positions WHERE rowid = ?1",
            rusqlite::params![rowid],
        )?;
        Ok(())
    }

    pub fn update_card_position_by_card_id_tx(
        tx: &mut rusqlite::Transaction,
        card_id: &str,
        position: &str,
    ) -> BackendResult<()> {
        let row_id: i64;
        let mut stmt = tx.prepare("SELECT rowid FROM cards WHERE id = ?1")?;
        row_id = stmt.query_row(rusqlite::params![card_id], |row| row.get(0))?;
        tx.execute(
            "DELETE FROM card_positions WHERE rowid = ?1",
            rusqlite::params![row_id],
        )?;
        tx.execute(
            "INSERT INTO card_positions (rowid, position) VALUES(?1, ?2)",
            rusqlite::params![row_id, position],
        )?;
        Ok(())
    }

    pub fn create_card_tx(tx: &mut rusqlite::Transaction, card: &mut Card) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO cards (id, horizon_id, card_type, resource_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![card.id, card.horizon_id, card.card_type, card.resource_id, card.position_x, card.position_y, card.width, card.height, card.stacking_order, card.created_at, card.updated_at, card.data]
        )?;
        let rowid = tx.last_insert_rowid();
        Self::create_card_position_tx(
            tx,
            &CardPosition {
                rowid: Some(rowid),
                position: format!("[{}, {}]", card.position_x, card.position_y),
            },
        )?;
        Ok(())
    }

    pub fn get_card(&self, id: &str) -> BackendResult<Option<Card>> {
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE id = ?1")?;
        let card = stmt
            .query_row(rusqlite::params![id], |row| {
                Ok(Card {
                    id: row.get(0)?,
                    horizon_id: row.get(1)?,
                    card_type: row.get(2)?,
                    resource_id: row.get(3)?,
                    position_x: row.get(4)?,
                    position_y: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                    stacking_order: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    data: row.get(11)?,
                })
            })
            .optional()?;
        Ok(card)
    }

    pub fn update_card_tx(tx: &mut rusqlite::Transaction, card: &mut Card) -> BackendResult<()> {
        let cp = CardPosition::new(&[card.position_x, card.position_y]);
        Self::update_card_position_by_card_id_tx(tx, &card.id, &cp.position)?;
        tx.execute(
            "UPDATE cards SET
            horizon_id = ?2, card_type = ?3, resource_id = ?4, position_x = ?5, position_y = ?6,
            width = ?7, height = ?9, stacking_order = ?10, updated_at = datetime('now'), data = ?11 WHERE id = ?1",
            rusqlite::params![card.id, card.horizon_id, card.card_type, card.resource_id, card.position_x, card.position_y, card.width, card.height, card.stacking_order, card.data]
        )?;
        Ok(())
    }

    pub fn update_card_data_tx(
        tx: &mut rusqlite::Transaction,
        card_id: &str,
        data: Vec<u8>,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE cards SET data = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id, data],
        )?;
        Ok(())
    }

    pub fn update_card_resource_id_tx(
        tx: &mut rusqlite::Transaction,
        card_id: &str,
        resource_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE cards SET resource_id = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id, resource_id],
        )?;
        Ok(())
    }

    pub fn update_card_dimensions_tx(
        tx: &mut rusqlite::Transaction,
        card_id: &str,
        position_x: i64,
        position_y: i64,
        width: i32,
        height: i32,
    ) -> BackendResult<()> {
        let cp = CardPosition::new(&[position_x, position_y]);
        Self::update_card_position_by_card_id_tx(tx, card_id, &cp.position)?;
        tx.execute(
            "UPDATE cards SET position_x = ?2, position_y = ?3, width = ?4, height = ?5, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id, position_x, position_y, width, height]
        )?;

        Ok(())
    }

    pub fn update_card_stacking_order_tx(
        tx: &mut rusqlite::Transaction,
        card_id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "UPDATE cards SET stacking_order = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id],
        )?;
        Ok(())
    }

    pub fn remove_card_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM card_positions WHERE rowid = (SELECT rowid FROM cards WHERE id = ?1)",
            rusqlite::params![id],
        )?;
        tx.execute("DELETE FROM cards WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn list_all_cards(&self, horizon_id: &str) -> BackendResult<Vec<Card>> {
        let query = "
        SELECT id, horizon_id, card_type, resource_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data
        FROM cards
        WHERE horizon_id = ?1
        ORDER BY stacking_order ASC";

        let mut stmt = self.conn.prepare(query)?;
        let cards = stmt.query_map(rusqlite::params![horizon_id], |row| {
            Ok(Card {
                id: row.get(0)?,
                horizon_id: row.get(1)?,
                card_type: row.get(2)?,
                resource_id: row.get(3)?,
                position_x: row.get(4)?,
                position_y: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                stacking_order: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                data: row.get(11)?,
            })
        })?;

        let mut result = Vec::new();
        for card in cards {
            result.push(card?);
        }

        Ok(result)
    }

    // sorts cards by position_x by default
    pub fn list_cards(
        &self,
        horizon_id: &str,
        limit: i64,
        offset: i64,
    ) -> BackendResult<PaginatedCards> {
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE horizon_id = ?1 ORDER BY position_x ?2 OFFSET ?3")?;
        let cards = stmt.query_map(rusqlite::params![horizon_id, limit, offset], |row| {
            Ok(Card {
                id: row.get(0)?,
                horizon_id: row.get(1)?,
                card_type: row.get(2)?,
                resource_id: row.get(3)?,
                position_x: row.get(4)?,
                position_y: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                stacking_order: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                data: row.get(11)?,
            })
        })?;
        let mut result = Vec::new();
        for card in cards {
            result.push(card?);
        }
        let total = self.conn.query_row(
            "SELECT COUNT(*) FROM cards WHERE horizon_id = ?1",
            rusqlite::params![horizon_id],
            |row| Ok(row.get(0)?),
        )?;
        Ok(PaginatedCards {
            cards: result,
            total,
            limit,
            offset,
        })
    }

    pub fn list_all_horizons(&self) -> BackendResult<Vec<Horizon>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, horizon_name, icon_uri, tint, view_offset_x, created_at, updated_at FROM horizons")?;
        let horizons = stmt.query_map([], |row| {
            Ok(Horizon {
                id: row.get(0)?,
                horizon_name: row.get(1)?,
                icon_uri: row.get(2)?,
                tint: row.get(3)?,
                view_offset_x: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for horizon in horizons {
            result.push(horizon?);
        }
        Ok(result)
    }

    pub fn create_horizon_tx(
        tx: &mut rusqlite::Transaction,
        horizon: &Horizon,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO horizons (id, horizon_name, icon_uri, tint, view_offset_x, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))",
            rusqlite::params![horizon.id, horizon.horizon_name, horizon.icon_uri, horizon.tint, horizon.view_offset_x]
        )?;
        Ok(())
    }

    pub fn update_horizon_tx(
        tx: &mut rusqlite::Transaction,
        horizon: Horizon,
    ) -> BackendResult<()> {
        let query = "
            UPDATE horizons
            SET horizon_name = ?1, icon_uri = ?2, view_offset_x = ?3, updated_at = datetime('now')
            WHERE id = ?4";
        tx.execute(
            query,
            rusqlite::params![
                horizon.horizon_name,
                horizon.icon_uri,
                horizon.view_offset_x,
                horizon.id,
            ],
        )?;
        Ok(())
    }

    pub fn remove_horizon_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute("DELETE FROM card_positions WHERE rowid IN (SELECT rowid FROM cards WHERE horizon_id = ?1)", rusqlite::params![id])?;
        tx.execute("DELETE FROM horizons WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn create_userdata_tx(
        tx: &mut rusqlite::Transaction,
        userdata: &Userdata,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO userdata (id, user_id) VALUES (?1, ?2)",
            rusqlite::params![userdata.id, userdata.user_id],
        )?;
        Ok(())
    }

    pub fn get_userdata_by_user_id(&mut self, user_id: &str) -> BackendResult<Option<Userdata>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, user_id FROM userdata WHERE user_id = ?1")?;
        Ok(stmt
            .query_row(rusqlite::params![user_id], |row| {
                Ok(Userdata {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                })
            })
            .optional()?)
    }

    pub fn remove_userdata_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute("DELETE FROM userdata WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    fn list_resource_ids_by_tags_query(
        tag_filters: &Vec<ResourceTagFilter>,
        param_start_index: usize,
    ) -> (String, Vec<String>) {
        let mut query = String::from("");
        let mut i = 0;
        let n = tag_filters.len();
        let mut params: Vec<String> = Vec::new();
        for filter in tag_filters {
            let (where_clause, tag_value) = filter
                .get_sql_filter_with_value((i + 1 + param_start_index, i + 2 + param_start_index));

            query = format!(
                "{}SELECT resource_id FROM resource_tags WHERE ({})",
                query, where_clause,
            );
            if i < 2 * (n - 1) {
                query = format!("{} INTERSECT ", query);
            }
            i += 2;
            params.push(filter.tag_name.clone());
            params.push(tag_value);
        }
        (query, params)
    }

    pub fn list_resource_ids_by_tags(
        &self,
        tags: &mut Vec<ResourceTagFilter>,
    ) -> BackendResult<Vec<String>> {
        let mut result = Vec::new();
        if tags.is_empty() {
            return Ok(result);
        }
        let (query, params) = Self::list_resource_ids_by_tags_query(tags, 0);
        let mut stmt = self.conn.prepare(&query)?;
        let resource_ids =
            stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| row.get(0))?;
        for resource_id in resource_ids {
            result.push(resource_id?);
        }
        Ok(result)
    }

    pub fn list_cards_by_resource_id(&self, resource_id: &str) -> BackendResult<Vec<Card>> {
        let mut result: Vec<Card> = Vec::new();
        let mut stmt = self
            .conn
            .prepare("SELECT * FROM cards WHERE resource_id = ?1")?;

        let cards = stmt.query_map(rusqlite::params![resource_id], |row| {
            Ok(Card {
                id: row.get(0)?,
                horizon_id: row.get(1)?,
                card_type: row.get(2)?,
                resource_id: row.get(3)?,
                position_x: row.get(4)?,
                position_y: row.get(5)?,
                width: row.get(6)?,
                height: row.get(7)?,
                stacking_order: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                data: row.get(11)?,
            })
        })?;

        for card in cards {
            result.push(card?);
        }
        Ok(result)
    }

    pub fn list_card_ids_by_resource_id(&self, resource_id: &str) -> BackendResult<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id FROM cards WHERE resource_id = ?1")?;
        let card_ids = stmt.query_map(rusqlite::params![resource_id], |row| row.get(0))?;
        let mut result = Vec::new();
        for card_id in card_ids {
            result.push(card_id?);
        }
        Ok(result)
    }

    pub fn vector_search_card_positions(
        &self,
        horizon_id: &str,
        cp: &mut CardPosition,
        distance_threshold: f32,
        limit: i64,
    ) -> BackendResult<Vec<VectorSearchResult>> {
        let mut result = Vec::new();
        let query = format!(
            "WITH filtered_distances AS (
                SELECT rowid, distance_sqeuclidean_f32(position, ?1) AS distance
                FROM card_positions
                WHERE rowid IN (SELECT rowid FROM cards WHERE horizon_id = ?2)
            )
            SELECT rowid, distance
            FROM filtered_distances
            WHERE distance <= ?3 AND distance != 0
            ORDER BY distance ASC
            LIMIT ?4"
        );

        let mut stmt = self.conn.prepare(&query)?;
        let card_positions = stmt.query_map(
            rusqlite::params![cp.position, horizon_id, distance_threshold.powf(2.0), limit],
            |row| {
                Ok(VectorSearchResult {
                    rowid: row.get(0)?,
                    distance: row.get(1)?,
                })
            },
        )?;

        for card_position in card_positions {
            result.push(card_position?);
        }
        Ok(result)
    }

    pub fn proximity_search_with_resource_id(
        &self,
        resource_id: &str,
        distance_threshold: f32,
        limit: i64,
    ) -> BackendResult<Vec<SearchResultItem>> {
        let mut resources: Vec<SearchResultItem> = Vec::new();
        let mut card_position_rowids: Vec<rusqlite::types::Value> = Vec::new();

        let mut stmt = self.conn.prepare(
            "SELECT C.horizon_id, C.position_x, C.position_y FROM cards C WHERE C.resource_id=?1",
        )?;
        let card_positions = stmt.query_map(rusqlite::params![resource_id], |row| {
            let horizon_id: String = row.get(0)?;
            let card_position: CardPosition = CardPosition::new(&[row.get(1)?, row.get(2)?]);
            Ok((card_position, horizon_id))
        })?;
        for cp in card_positions {
            let cp = cp?;
            let mut position = cp.0;
            let horizon_id = cp.1;
            let results = self.vector_search_card_positions(
                &horizon_id,
                &mut position,
                distance_threshold,
                limit,
            )?;
            results.iter().for_each(|r| {
                card_position_rowids.push(rusqlite::types::Value::from(r.rowid));
            });
        }

        if card_position_rowids.is_empty() {
            return Ok(resources);
        }

        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT M.*, R.* FROM resource_metadata M
            LEFT JOIN resources R ON R.id = M.resource_id
            WHERE R.id IN (SELECT DISTINCT resource_id FROM cards WHERE rowid IN rarray(?1))",
        )?;
        let items = stmt.query_map(
            [Rc::new(card_position_rowids)],
            Self::map_resource_and_metadata(Some(resource_id.to_string()), SearchEngine::Proximity),
        )?;
        for i in items {
            resources.push(i?);
        }
        Ok(resources)
    }

    pub fn proximity_search_resources(
        &self,
        resource_id: &str,
        distance_threshold: f32,
        limit: i64,
    ) -> BackendResult<SearchResult> {
        let mut results =
            self.proximity_search_with_resource_id(resource_id, distance_threshold, limit)?;

        results.iter_mut().try_for_each(|r| -> BackendResult<()> {
            let card_ids = self.list_card_ids_by_resource_id(&r.resource.resource.id)?;
            r.card_ids = card_ids;
            Ok(())
        })?;
        let n = results.len() as i64;
        Ok(SearchResult {
            items: results,
            total: n,
        })
    }

    pub fn embeddings_search(
        &self,
        embedding_vector: &Vec<f32>,
        distance_threshold: f32,
        limit: i64,
        filtered_resource_ids: Vec<String>,
    ) -> BackendResult<Vec<SearchResultItem>> {
        let mut results: Vec<SearchResultItem> = Vec::new();

        let e = Embedding::new(embedding_vector);
        let params = rusqlite::params![e.embedding, limit, distance_threshold.powf(2.0)];
        let mut query = "WITH distance_calculations AS (
                SELECT
                    E.rowid,
                    distance_sqeuclidean_f32(E.embedding, ?1) AS distance
                FROM embeddings E
            )
            SELECT
                M.*, R.*, D.distance
            FROM
                resource_metadata M
                LEFT JOIN resources R ON M.resource_id = R.id
                LEFT JOIN embedding_resources E ON M.resource_id = E.resource_id
                LEFT JOIN distance_calculations D ON D.rowid = E.rowid
            WHERE
                D.distance <= ?3"
            .to_owned();

        let row_map_fn = Self::map_resource_and_metadata(None, SearchEngine::Embeddings);
        if !filtered_resource_ids.is_empty() {
            query.push_str(" AND R.id IN rarray(?4) ORDER BY D.distance ASC");
            let mut rids: Vec<rusqlite::types::Value> = Vec::new();
            for rid in filtered_resource_ids {
                rids.push(rusqlite::types::Value::from(rid));
            }
            query.push_str(" LIMIT ?2");
            let params = rusqlite::params![
                e.embedding,
                limit,
                distance_threshold.powf(2.0),
                Rc::new(rids)
            ];
            let mut stmt = self.conn.prepare(query.as_str())?;
            let items = stmt.query_map(params, row_map_fn)?;
            for i in items {
                results.push(i?);
            }
            return Ok(results);
        }
        query.push_str(" ORDER BY D.distance ASC LIMIT ?2");
        let mut stmt = self.conn.prepare(query.as_str())?;
        let items = stmt.query_map(params, row_map_fn)?;
        for i in items {
            results.push(i?);
        }
        Ok(results)
    }

    fn map_resource_and_metadata(
        ref_resource_id: Option<String>,
        engine: SearchEngine,
    ) -> impl FnMut(&rusqlite::Row<'_>) -> Result<SearchResultItem, rusqlite::Error> {
        move |row| {
            Ok(SearchResultItem {
                resource: CompositeResource {
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
                    // TODO: should we populate the resource tags?
                    resource_tags: None,
                    resource_annotations: None,
                },
                distance: row.get(12).unwrap_or(None),
                ref_resource_id: ref_resource_id.clone(),
                card_ids: Vec::new(),
                engine: engine.clone(),
            })
        }
    }

    pub fn keyword_search(
        &self,
        keyword: &str,
        filtered_resource_ids: Vec<String>,
    ) -> BackendResult<Vec<SearchResultItem>> {
        let mut results: Vec<SearchResultItem> = Vec::new();

        let escaped_keyword = escape_fts_query(keyword);

        let base_query = "
            SELECT DISTINCT M.*, R.* 
            FROM resource_metadata M
            LEFT JOIN resources R ON M.resource_id = R.id
            WHERE (
                R.id IN (SELECT T.resource_id FROM resource_text_content T WHERE T.content MATCH ?1)
                OR R.id IN (SELECT resource_id FROM resource_metadata WHERE resource_metadata MATCH ?1)
            )";

        let (query, params) = if filtered_resource_ids.is_empty() {
            (
                format!("{} ORDER BY rank", base_query),
                vec![escaped_keyword],
            )
        } else {
            let placeholders = vec!["?"; filtered_resource_ids.len()].join(",");
            let filtered_query = format!(
                "
                {}
                AND R.id IN ({})
                ORDER BY rank
            ",
                base_query, placeholders
            );

            let mut params = vec![escaped_keyword];
            params.extend(filtered_resource_ids);
            (filtered_query, params)
        };

        let row_map_fn = Self::map_resource_and_metadata(None, SearchEngine::Keyword);
        let mut stmt = self.conn.prepare(&query)?;
        let items = stmt.query_map(rusqlite::params_from_iter(params.iter()), row_map_fn)?;
        for item in items {
            results.push(item?);
        }

        Ok(results)
    }

    // search for resources that match the given tags and only return the resource ids
    pub fn list_resources_by_tags(
        &self,
        mut tags: Vec<ResourceTagFilter>,
    ) -> BackendResult<SearchResultSimple> {
        let filtered_resource_ids = self.list_resource_ids_by_tags(&mut tags)?;

        if filtered_resource_ids.is_empty() {
            return Ok(SearchResultSimple {
                items: vec![],
                total: 0,
            });
        }

        Ok(SearchResultSimple {
            total: filtered_resource_ids.len() as i64,
            items: filtered_resource_ids,
        })
    }

    pub fn search_resources(
        &self,
        keyword: &str,
        filtered_resource_ids: &Option<Vec<String>>,
        include_annotations: bool,
    ) -> BackendResult<SearchResult> {
        // The Some value in filtered_resource_ids indicates that the search MUST have the filter ids
        // so if value is Some and empty, we return an empty result
        let filtered_resource_ids = match filtered_resource_ids {
            Some(ids) => {
                if ids.is_empty() {
                    return Ok(SearchResult {
                        items: vec![],
                        total: 0,
                    });
                }
                ids
            }
            None => &vec![],
        };

        let mut results = self.keyword_search(keyword, filtered_resource_ids.clone())?;
        if include_annotations {
            let mut annotations = self.list_resource_annotations(
                results
                    .iter()
                    .map(|item| item.resource.resource.id.as_str())
                    .collect::<Vec<_>>()
                    .as_ref(),
            )?;
            for item in results.iter_mut() {
                item.resource.resource_annotations =
                    annotations.remove(item.resource.resource.id.as_str())
            }
        }
        Ok(SearchResult {
            total: results.len() as i64,
            items: results,
        })
        // let mut seen_resource_ids: Vec<String> = Vec::new();
        // keyword resouce ids are guaranteed to be unique
        // so not checking for duplicates
        // for search_result in keyword_search_results {
        //     seen_resource_ids.push(search_result.resource.resource.id.clone());
        //     results.push(search_result);
    }

    // TODO: frontend should use a list endpoint not search if keyword is empty
    // early return as we don't want to perform proximity search
    // if keyword == "" {
    //     let n = results.len() as i64;
    //     return Ok(SearchResult {
    //         items: results,
    //         total: n,
    //     });
    // }

    // embeddings search
    // if semantic_search_enabled {
    //     let embeddings_search_results = self.embeddings_search(
    //         &keyword_embedding,
    //         embeddings_distance_threshold,
    //         embeddings_limit,
    //         filtered_resource_ids.clone(),
    //     )?;
    //     for search_result in embeddings_search_results {
    //         if !seen_resource_ids.contains(&search_result.resource.resource.id) {
    //             seen_resource_ids.push(search_result.resource.resource.id.clone());
    //             results.push(search_result);
    //         }
    //     }
    // }

    // relooping through the keyword search results to perform proximity search
    // we did not combine the two loops so that keyword search results are pushed first
    // as they should be ranked higher
    // for resource_id in seen_resource_ids {
    //     let proximity_search_results = self.proximity_search_with_resource_id(
    //         &resource_id,
    //         proximity_distance_threshold,
    //         proximity_limit,
    //     )?;
    //     for search_result in proximity_search_results {
    //         if filtered_resource_ids.contains(&search_result.resource.resource.id) {
    //             results.push(search_result);
    //         }
    //     }
    // }

    // let mut results = remove_duplicate_search_results(&mut results);
    // results.into_iter().filter()
    // results.iter_mut().try_for_each(|r| -> BackendResult<()> {
    //     let card_ids = self.list_card_ids_by_resource_id(&r.resource.resource.id)?;
    //     r.card_ids = card_ids;
    //     Ok(())
    // })?;
    // let n = results.len() as i64;
    // Ok(SearchResult {
    //     items: results,
    //     total: n,
    // })
    // }

    pub fn create_history_entry(&self, entry: &HistoryEntry) -> BackendResult<()> {
        let query = "
            INSERT INTO history_entries (id, entry_type, url, title, search_query, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)";
        self.conn.execute(
            query,
            rusqlite::params![
                entry.id,
                entry.entry_type.as_ref(),
                entry.url,
                entry.title,
                entry.search_query,
                entry.created_at,
                entry.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_history_entry(&self, id: &str) -> BackendResult<Option<HistoryEntry>> {
        let query = "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at
            FROM history_entries
            WHERE id = ?1";
        self.conn
            .query_row(query, [id], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    // TODO: handle this better
                    entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str())
                        .unwrap(),
                    url: row.get(2)?,
                    title: row.get(3)?,
                    search_query: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .optional()
            .map_err(BackendError::DatabaseError)
    }

    pub fn update_history_entry(&self, entry: &HistoryEntry) -> BackendResult<()> {
        let query = "
            UPDATE history_entries
            SET entry_type = ?1, url = ?2, title = ?3, search_query = ?4, updated_at = ?5
            WHERE id = ?6";
        self.conn.execute(
            query,
            rusqlite::params![
                entry.entry_type.as_ref(),
                entry.url,
                entry.title,
                entry.search_query,
                entry.updated_at,
                entry.id,
            ],
        )?;
        Ok(())
    }

    pub fn remove_history_entry(&self, id: &str) -> BackendResult<()> {
        let query = "DELETE FROM history_entries WHERE id = ?1";
        self.conn.execute(query, [id])?;
        Ok(())
    }

    pub fn get_all_history_entries(&self) -> BackendResult<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "
            SELECT id, entry_type, url, title, search_query, created_at, updated_at
            FROM history_entries",
        )?;

        let history_entry_iter = stmt.query_map([], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                // TODO: handle this better
                entry_type: HistoryEntryType::from_str(row.get::<_, String>(1)?.as_str()).unwrap(),
                url: row.get(2)?,
                title: row.get(3)?,
                search_query: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut history_entries = Vec::new();
        for entry in history_entry_iter {
            history_entries.push(entry?);
        }

        Ok(history_entries)
    }

    pub fn delete_all_embedding_resources(&self, resource_id: &str, embedding_type: EmbeddingType) -> BackendResult<()> {
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
        let mut stmt = self.conn.prepare(&query)?;
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
            Self::get_order_by_clause_for_embedding_row_ids("E.rowid", &row_ids)
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
            })
        })?;

        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    pub fn list_resources_by_ids(
        &self,
        resource_ids: Vec<String>,
    ) -> BackendResult<Vec<CompositeResource>> {
        let placeholders = vec!["?"; resource_ids.len()].join(",");
        let query = format!(
            "SELECT DISTINCT M.*, R.*, C.* FROM resources R
            LEFT JOIN resource_metadata M ON M.resource_id = R.id
            LEFT JOIN resource_text_content C ON M.resource_id = C.resource_id
            WHERE R.id IN ({}) GROUP BY C.content",
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
                })
            })?;

        for result in results_iter {
            results.push(result?);
        }
        Ok(results)
    }

    fn get_order_by_clause_for_embedding_row_ids(column_name: &str, row_ids: &Vec<i64>) -> String {
        let mut order_by_clause = String::from(format!("CASE {} ", column_name));
        for (i, row_id) in row_ids.iter().enumerate() {
            order_by_clause.push_str(&format!("WHEN {} THEN {} ", row_id, i));
        }
        order_by_clause.push_str(" END");
        order_by_clause
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
            "SELECT M.*, R.*, C.* FROM embedding_resources E
            LEFT JOIN resource_text_content C ON E.content_id = C.rowid
            LEFT JOIN resources R ON E.resource_id = R.id
            LEFT JOIN resource_metadata M ON E.resource_id = M.resource_id
            WHERE E.rowid IN ({}) ORDER BY {}",
            placeholders,
            Self::get_order_by_clause_for_embedding_row_ids("E.rowid", &row_ids)
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
                text_content: Some(ResourceTextContent {
                    id: row.get(12)?,
                    resource_id: row.get(13)?,
                    content: row.get(14)?,
                    content_type: row.get(15)?,
                    metadata: row.get(16)?,
                }),
                resource_tags: None,
                resource_annotations: None,
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

    pub fn create_embedding_tx(
        tx: &mut rusqlite::Transaction,
        embedding: &Embedding,
    ) -> BackendResult<()> {
        let rowid = match embedding.rowid {
            Some(rowid) => rowid,
            None => Err(BackendError::GenericError(
                "rowid must be specified for embedding".to_string(),
            ))?,
        };
        tx.execute(
            "INSERT INTO embeddings (rowid, embedding) VALUES (?1, ?2)",
            rusqlite::params![rowid, embedding.embedding],
        )?;
        Ok(())
    }

    pub fn vector_search_embeddings(
        &self,
        embedding: &Embedding,
        distance_threshold: f32,
        limit: i64,
    ) -> BackendResult<Vec<VectorSearchResult>> {
        let mut result = Vec::new();
        // the limit only applies to the vss_search filter and only after that the rowid and distance filters are applied
        let mut stmt = self.conn.prepare(
            "SELECT rowid, distance_cosine_f32(embedding, ?1) AS distance
             FROM
                embeddings
             WHERE
                distance <= ?2
             ORDER BY distance ASC
             LIMIT ?3",
        )?;
        let embeddings = stmt.query_map(
            rusqlite::params![embedding.embedding, distance_threshold.powf(2.0), limit],
            |row| {
                let _rowid: i64 = row.get(0)?;
                let _distance: f32 = row.get(1)?;
                Ok(VectorSearchResult {
                    rowid: row.get(0)?,
                    distance: row.get(1)?,
                })
            },
        )?;
        for embedding in embeddings {
            result.push(embedding?);
        }
        Ok(result)
    }

    pub fn create_ai_session_tx(
        tx: &mut rusqlite::Transaction,
        session: &AIChatSession,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO ai_sessions (id, system_prompt) VALUES (?1, ?2)",
            rusqlite::params![session.id, session.system_prompt],
        )?;
        Ok(())
    }

    pub fn delete_ai_session_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM ai_sessions WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn create_ai_session_message_tx(
        tx: &mut rusqlite::Transaction,
        msg: &AIChatSessionMessage,
    ) -> BackendResult<()> {
        // TODO: impl FromSql and ToSql for sources
        let sources_string = match &msg.sources {
            Some(sources) => match serde_json::to_string(sources) {
                Ok(s) => s,
                Err(_) => "".to_string(),
            },
            None => "".to_string(),
        };
        tx.execute(
            "INSERT INTO ai_session_messages (ai_session_id, role, content, sources, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![msg.ai_session_id, msg.role, msg.content, sources_string, msg.created_at],
        )?;
        Ok(())
    }

    pub fn list_ai_session_messages(
        &self,
        session_id: &str,
    ) -> BackendResult<Vec<AIChatSessionMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT ai_session_id, role, content, sources, created_at
            FROM ai_session_messages
            WHERE ai_session_id = ?1
            ORDER BY created_at ASC",
        )?;
        let messages = stmt.query_map(rusqlite::params![session_id], |row| {
            let sources_raw: String = row.get(3)?;
            let parsed_sources: Option<Vec<AIChatSessionMessageSource>> =
                match serde_json::from_str(&sources_raw) {
                    Ok(sources) => Some(sources),
                    Err(_) => None,
                };

            Ok(AIChatSessionMessage {
                ai_session_id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                sources: parsed_sources,
                created_at: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for message in messages {
            result.push(message?);
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_resource_ids_by_tags_query() {
        let tags = vec![ResourceTagFilter {
            tag_name: "tag1".to_string(),
            tag_value: "value1".to_string(),
            op: ResourceTagFilterOp::Eq,
        }];
        let (query, params) = Database::list_resource_ids_by_tags_query(&tags, 0);
        assert_eq!(
            query,
            "SELECT resource_id FROM resource_tags WHERE (tag_name = ?1 AND tag_value = ?2)"
        );
        assert_eq!(params, vec!["tag1", "value1"]);

        let tags = vec![
            ResourceTagFilter {
                tag_name: "tag1".to_string(),
                tag_value: "value1".to_string(),
                op: ResourceTagFilterOp::Eq,
            },
            ResourceTagFilter {
                tag_name: "tag2".to_string(),
                tag_value: "value2".to_string(),
                op: ResourceTagFilterOp::Ne,
            },
            ResourceTagFilter {
                tag_name: "tag3".to_string(),
                tag_value: "value".to_string(),
                op: ResourceTagFilterOp::Prefix,
            },
            ResourceTagFilter {
                tag_name: "tag4".to_string(),
                tag_value: "".to_string(),
                op: ResourceTagFilterOp::NotExists,
            },
            ResourceTagFilter {
                tag_name: "tag5".to_string(),
                tag_value: "value".to_string(),
                op: ResourceTagFilterOp::Suffix,
            },
        ];
        let (query, params) = Database::list_resource_ids_by_tags_query(&tags, 0);
        assert_eq!(
            query,
            "SELECT resource_id FROM resource_tags WHERE (tag_name = ?1 AND tag_value = ?2) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?3 AND tag_value != ?4) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?5 AND tag_value LIKE ?6) INTERSECT SELECT resource_id FROM resource_tags WHERE (resource_id NOT IN (SELECT resource_id FROM resource_tags WHERE tag_name = ?7 AND tag_name = ?8)) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?9 AND tag_value LIKE ?10)"
        );
        assert_eq!(
            params,
            vec![
                "tag1", "value1", "tag2", "value2", "tag3", "value%", "tag4", "tag4", "tag5",
                "%value"
            ]
        );

        let (query, params) = Database::list_resource_ids_by_tags_query(&tags, 2);
        assert_eq!(
            query,
            "SELECT resource_id FROM resource_tags WHERE (tag_name = ?3 AND tag_value = ?4) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?5 AND tag_value != ?6) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?7 AND tag_value LIKE ?8) INTERSECT SELECT resource_id FROM resource_tags WHERE (resource_id NOT IN (SELECT resource_id FROM resource_tags WHERE tag_name = ?9 AND tag_name = ?10)) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?11 AND tag_value LIKE ?12)"
        );
        assert_eq!(
            params,
            vec![
                "tag1", "value1", "tag2", "value2", "tag3", "value%", "tag4", "tag4", "tag5",
                "%value"
            ]
        );
    }
}
