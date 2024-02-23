use crate::{BackendError, BackendResult};

use super::models::*;

use rusqlite::{
    ffi::sqlite3_auto_extension, params_from_iter, Connection, OptionalExtension, Result,
};
use rust_embed::RustEmbed;
use sqlite_vss::{sqlite3_vector_init, sqlite3_vss_init};
use std::{error::Error, iter::Enumerate};

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

pub struct CompositeResource {
    pub resource: Resource,
    pub metadata: Option<ResourceMetadata>,
    pub text_content: Option<ResourceTextContent>,
    pub resource_tags: Option<Vec<ResourceTag>>,
}

pub enum SearchEngine {
    Metadata,
    TextContent,
    Proximity,
}

pub struct SearchResultItem {
    pub resource: CompositeResource,
    pub card_ids: Vec<String>,
    pub engine: SearchEngine,
}

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

    pub fn begin(&mut self) -> Result<rusqlite::Transaction, rusqlite::Error> {
        self.conn.transaction()
    }

    pub fn create_resource_tx(
        tx: &mut rusqlite::Transaction,
        resource: &Resource,
    ) -> Result<(), rusqlite::Error> {
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "UPDATE resources SET resource_path = ?2, resource_type = ?3, created_at = ?4, updated_at = ?5, deleted = ?6 WHERE id = ?1",
            rusqlite::params![resource.id, resource.resource_path, resource.resource_type, resource.created_at, resource.updated_at, resource.deleted]
        )?;
        Ok(())
    }

    pub fn touch_resource(&self, resource_id: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "UPDATE resources SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![resource_id],
        )?;
        Ok(())
    }

    pub fn update_resource_deleted(
        &self,
        resource_id: &str,
        deleted: i32,
    ) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "UPDATE resources SET deleted = ?2 WHERE id = ?1",
            rusqlite::params![resource_id, deleted],
        )?;
        Ok(())
    }

    pub fn get_resource(&self, id: String) -> Result<Option<Resource>, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT id, resource_path, resource_type, created_at, updated_at, deleted FROM resources WHERE id = ?1")?;
        stmt.query_row(rusqlite::params![id], |row| {
            Ok(Resource {
                id: row.get(0)?,
                resource_path: row.get(1)?,
                resource_type: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                deleted: row.get(5)?,
            })
        })
        .optional()
    }

    pub fn remove_resource_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> Result<(), rusqlite::Error> {
        tx.execute("DELETE FROM resources WHERE id = ?1", rusqlite::params![id])?;
        Self::remove_resource_metadata_tx(tx, id)?;
        Self::remove_resource_text_content_tx(tx, id)?;
        Ok(())
    }

    pub fn remove_deleted_resources_tx(
        tx: &mut rusqlite::Transaction,
    ) -> Result<(), rusqlite::Error> {
        tx.execute("DELETE FROM resource_metadata WHERE resource_id IN (SELECT id FROM resources WHERE deleted=1)", ())?;
        tx.execute("DELETE FROM resource_text_content WHERE resource_id IN (SELECT id FROM resources WHERE deleted=1)", ())?;
        tx.execute("DELETE FROM resources WHERE deleted=1", ())?;
        Ok(())
    }

    pub fn list_all_resources(&self, deleted: i32) -> Result<Vec<Resource>, rusqlite::Error> {
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
    ) -> Result<PaginatedResources, rusqlite::Error> {
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

    pub fn list_resource_tags(
        &self,
        resource_id: &str,
    ) -> Result<Vec<ResourceTag>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, resource_id, tag_name, tag_value FROM resource_tag WHERE resource_id = ?1",
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "INSERT INTO resource_tags (id, resource_id, tag_name, tag_value) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![resource_tag.id, resource_tag.resource_id, resource_tag.tag_name, resource_tag.tag_value]
        )?;
        Ok(())
    }

    pub fn update_resource_tag_tx(
        tx: &mut rusqlite::Transaction,
        resource_tag: &ResourceTag,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "UPDATE resource_tags SET resource_id = ?2, tag_name = ?3, tag_value = ?4 WHERE id = ?1",
            rusqlite::params![resource_tag.id, resource_tag.resource_id, resource_tag.tag_name, resource_tag.tag_value]
        )?;
        Ok(())
    }

    pub fn remove_resource_tag_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> Result<(), rusqlite::Error> {
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "DELETE FROM resource_tags WHERE resource_id = ?1 AND tag_name = ?2",
            rusqlite::params![resource_id, tag_name],
        )?;
        Ok(())
    }

    pub fn create_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "INSERT INTO resource_metadata (id, resource_id, name, source_uri, alt) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt]
        )?;
        Ok(())
    }

    pub fn update_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        resource_metadata: &ResourceMetadata,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "UPDATE resource_metadata SET resource_id = ?2, name = ?3, source_uri = ?4, alt = ?5 WHERE id = ?1",
            rusqlite::params![resource_metadata.id, resource_metadata.resource_id, resource_metadata.name, resource_metadata.source_uri, resource_metadata.alt]
        )?;
        Ok(())
    }

    pub fn remove_resource_metadata_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "DELETE FROM resource_metadata WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get_resource_metadata(
        &self,
        resource_id: &str,
    ) -> Result<Vec<ResourceMetadata>, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT id, resource_id, name, source_uri, alt FROM resource_metadata WHERE resource_id = ?1")?;
        let resource_metadata = stmt.query_map(rusqlite::params![resource_id], |row| {
            Ok(ResourceMetadata {
                id: row.get(0)?,
                resource_id: row.get(1)?,
                name: row.get(2)?,
                source_uri: row.get(3)?,
                alt: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for metadata in resource_metadata {
            result.push(metadata?);
        }
        Ok(result)
    }

    pub fn create_resource_text_content_tx(
        tx: &mut rusqlite::Transaction,
        resource_text_content: &ResourceTextContent,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
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
    ) -> Result<(), rusqlite::Error> {
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "DELETE FROM resource_text_content WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn create_card_position_tx(
        tx: &mut rusqlite::Transaction,
        card_position: &CardPosition,
    ) -> Result<i64, rusqlite::Error> {
        let mut stmt = tx.prepare("INSERT INTO card_positions (position) VALUES (?1)")?;
        stmt.insert(rusqlite::params![card_position.position])?;
        Ok(tx.last_insert_rowid())
    }

    pub fn remove_card_position_tx(
        tx: &mut rusqlite::Transaction,
        row_id: &i64,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "DELETE FROM card_positions WHERE row_id = ?1",
            rusqlite::params![row_id],
        )?;
        Ok(())
    }

    pub fn create_card_tx(
        tx: &mut rusqlite::Transaction,
        card: &mut Card,
    ) -> Result<(), rusqlite::Error> {
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

    pub fn get_card(&self, id: &str) -> Result<Card, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE id = ?1")?;
        let card = stmt.query_row(rusqlite::params![id], |row| {
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
        Ok(card)
    }

    pub fn update_card_tx(
        tx: &mut rusqlite::Transaction,
        card: &mut Card,
    ) -> Result<(), rusqlite::Error> {
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

    pub fn update_card_resource_id(
        &self,
        tx: &mut rusqlite::Transaction,
        card_id: &str,
        resource_id: &str,
    ) -> Result<(), rusqlite::Error> {
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute("DELETE FROM card_positions WHERE row_id = (SELECT position_id FROM cards WHERE id = ?1)", rusqlite::params![card_id])?;
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
        stacking_order: &str,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "UPDATE cards SET stacking_order = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![card_id, stacking_order],
        )?;
        Ok(())
    }

    pub fn remove_card_tx(tx: &mut rusqlite::Transaction, id: &str) -> Result<(), rusqlite::Error> {
        tx.execute(
            "DELETE FROM card_positions WHERE row_id = (SELECT position_id FROM cards WHERE id = ?1)",
        ())?;
        tx.execute("DELETE FROM cards WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn list_all_cards(&self, horizon_id: &str) -> Result<Vec<Card>, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT id, horizon_id, card_type, resource_id, position_id, position_x, position_y, width, height, stacking_order, created_at, updated_at, data FROM cards WHERE horizon_id = ?1 ORDER BY position_x")?;
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
    ) -> Result<PaginatedCards, rusqlite::Error> {
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

    pub fn list_all_horizons(&self) -> Result<Vec<Horizon>, rusqlite::Error> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, horizon_name, icon_uri, created_at, updated_at FROM horizons")?;
        let horizons = stmt.query_map([], |row| {
            Ok(Horizon {
                id: row.get(0)?,
                horizon_name: row.get(1)?,
                icon_uri: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
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
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "INSERT INTO horizons (id, horizon_name, icon_uri, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
            rusqlite::params![horizon.id, horizon.horizon_name, horizon.icon_uri]
        )?;
        Ok(())
    }

    pub fn update_horizon_name_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
        horizon_name: &str,
    ) -> Result<(), rusqlite::Error> {
        tx.execute(
            "UPDATE horizons SET horizon_name = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![id, horizon_name],
        )?;
        Ok(())
    }

    pub fn remove_horizon_tx(
        tx: &mut rusqlite::Transaction,
        id: &str,
    ) -> Result<(), rusqlite::Error> {
        tx.execute("DELETE FROM card_positions WHERE row_id IN (SELECT position_id FROM cards WHERE horizon_id = ?1)", rusqlite::params![id])?;
        tx.execute("DELETE FROM horizons WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn list_resource_ids_by_tags(
        &self,
        tags: &mut Vec<ResourceTag>,
    ) -> Result<Vec<String>, rusqlite::Error> {
        let mut query = String::from("SELECT resource_id FROM resource_tags WHERE");
        let mut i = 0;
        let n = tags.len();
        let mut params: Vec<String> = Vec::new();
        for tag in tags {
            query = format!(
                "{} (tag_name = ?{} AND tag_value = ?{})",
                query,
                i + 1,
                i + 2
            );
            if i < n - 1 {
                query = format!("{} OR", query);
            }
            i += 2;
            params.push(tag.tag_name.clone());
            params.push(tag.tag_value.clone());
        }
        let mut stmt = self.conn.prepare(&query)?;
        let resource_ids =
            stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| row.get(0))?;
        let mut result = Vec::new();
        for resource_id in resource_ids {
            result.push(resource_id?);
        }
        Ok(result)
    }

    // full text search on resource metadata after filtering by resource tags
    pub fn search_resource_metadata(
        &self,
        keyword: &str,
        tags: &mut Vec<ResourceTag>,
    ) -> Result<SearchResult, rusqlite::Error> {
        let resource_ids = self.list_resource_ids_by_tags(tags)?;
        let resource_ids = std::rc::Rc::new(
            resource_ids
                .into_iter()
                .map(rusqlite::types::Value::from)
                .collect::<Vec<rusqlite::types::Value>>(),
        );

        let mut stmt = self.conn.prepare("SELECT * FROM resource_metadata M JOIN resources R ON M.resource_id = R.id WHERE R.id IN (?1) AND M MATCH ?2")?;
        let search_results = stmt.query_map(rusqlite::params![&resource_ids, keyword], |row| {
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
}
