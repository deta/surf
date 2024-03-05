use std::str::FromStr;

use super::models::*;
use crate::{BackendError, BackendResult};

use rusqlite::{ffi::sqlite3_auto_extension, Connection, OptionalExtension};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use sqlite_vss::{sqlite3_vector_init, sqlite3_vss_init};

#[derive(RustEmbed)]
#[folder = "migrations/"]
struct Migrations;

#[derive(Debug)]
pub struct Database {
    conn: rusqlite::Connection,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CompositeResource {
    pub resource: Resource,
    pub metadata: Option<ResourceMetadata>,
    pub text_content: Option<ResourceTextContent>,
    pub resource_tags: Option<Vec<ResourceTag>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SearchEngine {
    Metadata,
    TextContent,
    Proximity,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub resource: CompositeResource,
    pub card_ids: Vec<String>,
    pub engine: SearchEngine,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub items: Vec<SearchResultItem>,
    pub total: i64,
}

impl Database {
    pub fn new(db_path: &str) -> BackendResult<Database> {
        unsafe {
            // the following only works with rusqlite < 0.29.0 as rusqlite updated the function signatures in later versions
            // we might have to update the sqlite3_vector_init and sqlite3_vss_init bindings ourselves if we want to use a newer version of rusqlite
            sqlite3_auto_extension(Some(sqlite3_vector_init));
            sqlite3_auto_extension(Some(sqlite3_vss_init));
        }

        let init_schema = Migrations::get("init.sql")
            .ok_or(BackendError::GenericError("init.sql not found".into()))?;
        let init_schame = std::str::from_utf8(init_schema.data.as_ref())
            .map_err(|e| BackendError::GenericError(e.to_string()))?;
        let migrations_schema = Migrations::get("migrations.sql")
            .map(|f| std::str::from_utf8(f.data.as_ref()).map(|s| s.to_owned()))
            .transpose()
            .map_err(|e| BackendError::GenericError(e.to_string()))?;

        // Connection::open already handles creating the file if it doesn't exist
        // let mut conn = Connection::open(db_path).map_err(BackendError::DatabaseError)?;
        let mut conn = Connection::open(db_path)?;

        let tx = conn.transaction()?;
        tx.execute_batch(init_schame)?;
        if let Some(schema) = migrations_schema {
            tx.execute_batch(&schema)?;
        }
        tx.commit()?;

        Ok(Database { conn })
    }

    pub fn begin(&mut self) -> BackendResult<rusqlite::Transaction> {
        Ok(self.conn.transaction()?)
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

    pub fn touch_resource(&self, resource_id: &str) -> BackendResult<()> {
        self.conn.execute(
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

    pub fn create_resource_tag_tx(
        tx: &mut rusqlite::Transaction,
        resource_tag: &ResourceTag,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_tags (id, resource_id, tag_name, tag_value) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![resource_tag.id, resource_tag.resource_id, resource_tag.tag_name, resource_tag.tag_value]
        )?;
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
        Ok(())
    }

    pub fn remove_resource_tag_tx(tx: &mut rusqlite::Transaction, id: &str) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_tags WHERE id = ?1",
            rusqlite::params![id],
        )?;
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
        Ok(())
    }

    pub fn create_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        tx.execute(
            "INSERT INTO resource_metadata (id, resource_id, name, source_uri, alt) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt]
        )?;
        Ok(())
    }

    pub fn update_resource_metadata(
        &mut self,
        resource_metadata: &ResourceMetadata,
    ) -> BackendResult<()> {
        self.conn.execute(
            "UPDATE resource_metadata SET resource_id = ?2, name = ?3, source_uri = ?4, alt = ?5 WHERE id = ?1",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt]
        )?;
        Ok(())
    }

    pub fn remove_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> BackendResult<()> {
        tx.execute(
            "DELETE FROM resource_metadata WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get_resource_metadata_by_resource_id(
        &self,
        resource_id: &str,
    ) -> BackendResult<Option<ResourceMetadata>> {
        let query = "SELECT id, resource_id, name, source_uri, alt FROM resource_metadata WHERE resource_id = ?1 LIMIT 1";
        self.conn
            .query_row(query, rusqlite::params![resource_id], |row| {
                Ok(ResourceMetadata {
                    id: row.get(0)?,
                    resource_id: row.get(1)?,
                    name: row.get(2)?,
                    source_uri: row.get(3)?,
                    alt: row.get(4)?,
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
            "INSERT INTO resource_text_content (id, resource_id, content) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                resource_text_content.id,
                resource_text_content.resource_id,
                resource_text_content.content
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
            "DELETE FROM resource_text_content WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn create_card_position_tx(
        tx: &mut rusqlite::Transaction,
        card_position: &CardPosition,
    ) -> BackendResult<i64> {
        //let mut stmt = tx.prepare("INSERT INTO card_positions (position) VALUES (?1)")?;
        //stmt.insert(rusqlite::params![card_position.position])?;
        //Ok(tx.last_insert_rowid())
        Ok(0)
    }

    pub fn remove_card_position_tx(
        tx: &mut rusqlite::Transaction,
        row_id: &i64,
    ) -> BackendResult<()> {
        //tx.execute(
        //    "DELETE FROM card_positions WHERE row_id = ?1",
        //    rusqlite::params![row_id],
        //)?;
        Ok(())
    }

    pub fn create_card_tx(tx: &mut rusqlite::Transaction, card: &mut Card) -> BackendResult<()> {
        let card_position_id = Self::create_card_position_tx(
            tx,
            &CardPosition {
                position: format!("[{}, {}]", card.position_x, card.position_y)
                    .as_bytes()
                    .to_vec(),
            },
        )?;
        card.position_id = card_position_id;
        tx.execute(
            "INSERT INTO cards (id, horizon_id, card_type, resource_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data, position_id) 
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![card.id, card.horizon_id, card.card_type, card.resource_id, card.position_x, card.position_y, card.width, card.height, card.stacking_order, card.created_at, card.updated_at, card.data, card.position_id]
        )?;
        Ok(())
    }

    pub fn get_card(&self, id: &str) -> BackendResult<Option<Card>> {
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE id = ?1")?;
        let card = stmt
            .query_row(rusqlite::params![id], |row| {
                Ok(Card {
                    id: row.get(0)?,
                    horizon_id: row.get(1)?,
                    card_type: row.get(2)?,
                    resource_id: row.get(3)?,
                    position_id: row.get(4)?,
                    position_x: row.get(5)?,
                    position_y: row.get(6)?,
                    width: row.get(7)?,
                    height: row.get(8)?,
                    stacking_order: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    data: row.get(12)?,
                })
            })
            .optional()?;
        Ok(card)
    }

    pub fn update_card_tx(tx: &mut rusqlite::Transaction, card: &mut Card) -> BackendResult<()> {
        tx.execute("DELETE FROM card_positions WHERE row_id = (SELECT position_id FROM cards WHERE id = ?1)", rusqlite::params![card.id])?;
        let card_position_id = Self::create_card_position_tx(
            tx,
            &CardPosition {
                position: format!("[{}, {}]", card.position_x, card.position_y)
                    .as_bytes()
                    .to_vec(),
            },
        )?;
        card.position_id = card_position_id;
        tx.execute(
            "UPDATE cards SET 
            horizon_id = ?2, card_type = ?3, resource_id = ?4, position_x = ?5, position_y = ?6, position_id = ?7,
            width = ?8, height = ?9, stacking_order = ?10, updated_at = datetime('now'), data = ?11 WHERE id = ?1",
            rusqlite::params![card.id, card.horizon_id, card.card_type, card.resource_id, card.position_x, card.position_y, card.position_id, card.width, card.height, card.stacking_order, card.data]
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
        //tx.execute("DELETE FROM card_positions WHERE row_id = (SELECT position_id FROM cards WHERE id = ?1)", rusqlite::params![card_id])?;
        let card_position_id = Self::create_card_position_tx(
            tx,
            &CardPosition {
                position: format!("[{}, {}]", position_x, position_y)
                    .as_bytes()
                    .to_vec(),
            },
        )?;
        tx.execute(
            "UPDATE cards SET position_x = ?2, position_y = ?3, width = ?4, height = ?5, position_id=?6, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id, position_x, position_y, width, height, card_position_id]
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
        //tx.execute(
        //    "DELETE FROM card_positions WHERE row_id = (SELECT position_id FROM cards WHERE id = ?1)",
        //())?;
        tx.execute("DELETE FROM cards WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn list_all_cards(&self, horizon_id: &str) -> BackendResult<Vec<Card>> {
        let query = "
        SELECT id, horizon_id, card_type, resource_id, position_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data 
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
                position_id: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                stacking_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                data: row.get(12)?,
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
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE horizon_id = ?1 ORDER BY position_x ?2 OFFSET ?3")?;
        let cards = stmt.query_map(rusqlite::params![horizon_id, limit, offset], |row| {
            Ok(Card {
                id: row.get(0)?,
                horizon_id: row.get(1)?,
                card_type: row.get(2)?,
                resource_id: row.get(3)?,
                position_id: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                stacking_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                data: row.get(12)?,
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
            .prepare("SELECT id, horizon_name, icon_uri, view_offset_x, created_at, updated_at FROM horizons")?;
        let horizons = stmt.query_map([], |row| {
            Ok(Horizon {
                id: row.get(0)?,
                horizon_name: row.get(1)?,
                icon_uri: row.get(2)?,
                view_offset_x: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
            "INSERT INTO horizons (id, horizon_name, icon_uri, view_offset_x, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
            rusqlite::params![horizon.id, horizon.horizon_name, horizon.icon_uri, horizon.view_offset_x]
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
        tx.execute("DELETE FROM card_positions WHERE row_id IN (SELECT position_id FROM cards WHERE horizon_id = ?1)", rusqlite::params![id])?;
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

    // full text search on resource metadata after filtering by resource tags
    pub fn search_resources(
        &self,
        keyword: &str,
        tags: Option<Vec<ResourceTagFilter>>,
    ) -> BackendResult<SearchResult> {
        let mut params_vector = vec![format!("%{}%", keyword).to_string()];
        let mut query = "SELECT DISTINCT M.*, R.*
            FROM resource_metadata M
            LEFT JOIN resource_text_content T ON M.resource_id = T.resource_id
            LEFT JOIN resources R ON M.resource_id = R.id
            WHERE (M.name LIKE ?1 OR M.source_uri LIKE ?1 OR M.alt LIKE ?1 OR T.content LIKE ?1)"
            .to_owned();
        if let Some(tags) = tags {
            if !tags.is_empty() {
                let (subquery, mut params) = Self::list_resource_ids_by_tags_query(&tags, 1);
                params_vector.append(&mut params);
                query.push_str(format!(" AND R.id IN ({})", subquery).as_str());
            }
        }
        let params = rusqlite::params_from_iter(params_vector.iter());
        let mut stmt = self.conn.prepare(query.as_str())?;
        let search_results = stmt.query_map(params, |row| {
            Ok(SearchResultItem {
                resource: CompositeResource {
                    metadata: Some(ResourceMetadata {
                        id: row.get(0)?,
                        resource_id: row.get(1)?,
                        name: row.get(2)?,
                        source_uri: row.get(3)?,
                        alt: row.get(4)?,
                    }),
                    resource: Resource {
                        id: row.get(5)?,
                        resource_path: row.get(6)?,
                        resource_type: row.get(7)?,
                        created_at: row.get(8)?,
                        updated_at: row.get(9)?,
                        deleted: row.get(10)?,
                    },
                    text_content: None,
                    // TODO: should we populate the resource tags?
                    resource_tags: None,
                },
                // TODO: proximity search on the card ids
                card_ids: Vec::new(),
                engine: SearchEngine::Metadata,
            })
        })?;

        let mut results = Vec::new();
        for search_result in search_results {
            results.push(search_result?);
        }
        let n = results.len() as i64;
        Ok(SearchResult {
            items: results,
            total: n,
        })
    }

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
        ];
        let (query, params) = Database::list_resource_ids_by_tags_query(&tags, 0);
        assert_eq!(
            query,
            "SELECT resource_id FROM resource_tags WHERE (tag_name = ?1 AND tag_value = ?2) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?3 AND tag_value != ?4) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?5 AND tag_value LIKE ?6)"
        );
        assert_eq!(
            params,
            vec!["tag1", "value1", "tag2", "value2", "tag3", "value%"]
        );

        let (query, params) = Database::list_resource_ids_by_tags_query(&tags, 2);
        assert_eq!(
            query,
            "SELECT resource_id FROM resource_tags WHERE (tag_name = ?3 AND tag_value = ?4) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?5 AND tag_value != ?6) INTERSECT SELECT resource_id FROM resource_tags WHERE (tag_name = ?7 AND tag_value LIKE ?8)"
        );
        assert_eq!(
            params,
            vec!["tag1", "value1", "tag2", "value2", "tag3", "value%"]
        );
    }
}
