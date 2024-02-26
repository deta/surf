use serde::{Deserialize, Serialize};

pub struct Horizon {
    pub id: String,
    pub horizon_name: String,
    pub icon_uri: String,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Card {
    pub id: String,
    pub horizon_id: String,
    pub card_type: String,
    pub resource_id: String,
    pub position_id: i64,
    pub position_x: i64,
    pub position_y: i64,
    pub width: i32,
    pub height: i32,
    pub stacking_order: String,
    pub created_at: String,
    pub updated_at: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Resource {
    pub id: String,
    pub resource_path: String,
    pub resource_type: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTag {
    pub id: String,
    pub resource_id: String,
    pub tag_name: String,
    pub tag_value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceMetadata {
    pub id: String,
    pub resource_id: String,
    pub name: String,
    pub source_uri: String,
    pub alt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTextContent {
    pub id: String,
    pub resource_id: String,
    pub content: String,
}

pub struct CardPosition {
    pub position: Vec<u8>,
}
