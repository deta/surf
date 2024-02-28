use serde::{Deserialize, Serialize};

pub fn current_time() -> chrono::DateTime<chrono::Utc> {
    chrono::Utc::now()
}

pub fn random_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn parse_datetime_from_str(
    datetime: &str,
) -> Result<chrono::DateTime<chrono::Utc>, chrono::ParseError> {
    let format = "%Y-%m-%d %H:%M:%S";
    let ut = chrono::DateTime::parse_from_str(datetime, format)?;
    return Ok(ut.with_timezone(&chrono::Utc));
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Userdata {
    #[serde(default = "random_uuid")]
    pub id: String,

    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Horizon {
    #[serde(default = "random_uuid")]
    pub id: String,

    pub horizon_name: String,

    #[serde(default)]
    pub icon_uri: String,

    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Card {
    #[serde(default = "random_uuid")]
    pub id: String,

    pub horizon_id: String,
    pub card_type: String,

    #[serde(default)]
    pub resource_id: String,

    #[serde(default)]
    pub position_id: i64,

    pub position_x: i64,
    pub position_y: i64,
    pub width: i32,
    pub height: i32,

    #[serde(default = "current_time")]
    pub stacking_order: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,

    #[serde(default)]
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Resource {
    #[serde(default = "random_uuid")]
    pub id: String,

    #[serde(default)]
    pub resource_path: String,

    pub resource_type: String,

    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,

    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,

    #[serde(default)]
    pub deleted: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTag {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub tag_name: String,
    pub tag_value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceMetadata {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub name: String,

    #[serde(default)]
    pub source_uri: String,

    #[serde(default)]
    pub alt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTextContent {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub content: String,
}

#[derive(Debug)]
pub struct CardPosition {
    pub position: Vec<u8>,
}
