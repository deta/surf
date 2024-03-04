use serde::{Deserialize, Serialize};

use std::str::FromStr;
use std::string::ToString;

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
    Ok(ut.with_timezone(&chrono::Utc))
}

pub enum InternalResourceTagNames {
    Type,
    Deleted,
}

impl InternalResourceTagNames {
    pub fn as_str(&self) -> &str {
        match self {
            InternalResourceTagNames::Type => "type",
            InternalResourceTagNames::Deleted => "deleted",
        }
    }
}

impl FromStr for InternalResourceTagNames {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "type" => Ok(InternalResourceTagNames::Type),
            "deleted" => Ok(InternalResourceTagNames::Deleted),
            _ => Err(()),
        }
    }
}

impl ToString for InternalResourceTagNames {
    fn to_string(&self) -> String {
        match self {
            InternalResourceTagNames::Type => "type".to_string(),
            InternalResourceTagNames::Deleted => "deleted".to_string(),
        }
    }
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
    #[serde(default)]
    pub view_offset_x: i64,
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

impl ResourceTag {
    pub fn new_deleted(resource_id: &str, deleted: bool) -> ResourceTag {
        ResourceTag {
            id: random_uuid(),
            resource_id: resource_id.to_string(),
            tag_name: InternalResourceTagNames::Deleted.to_string(),
            tag_value: deleted.to_string(),
        }
    }

    pub fn new_type(resource_id: &str, resource_type: &str) -> ResourceTag {
        ResourceTag {
            id: random_uuid(),
            resource_id: resource_id.to_string(),
            tag_name: InternalResourceTagNames::Type.to_string(),
            tag_value: resource_type.to_string(),
        }
    }
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
    pub rowid: Option<i64>,
    pub position: String,
}

impl CardPosition {
    pub fn new(position_array: &[i64; 2]) -> CardPosition {
        let pos_str = format!("[{:?}.0, {:?}.0]", position_array[0], position_array[1],);
        CardPosition {
            rowid: None,
            position: pos_str,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, strum::EnumString, strum::AsRefStr)]
#[strum(ascii_case_insensitive)]
pub enum HistoryEntryType {
    Search,
    Navigation,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub entry_type: HistoryEntryType,
    pub url: Option<String>,
    pub title: Option<String>,
    pub search_query: Option<String>,
    #[serde(default = "current_time")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "current_time")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub struct Embedding {
    pub rowid: Option<i64>,
    pub embedding: String,
}

impl Embedding {
    pub fn new(embedding: &Vec<f32>) -> Embedding {
        let embedding_str = embedding
            .iter()
            .map(|x| format!("{}", x))
            .collect::<Vec<String>>()
            .join(", ");
        Embedding {
            rowid: None,
            embedding: format!("[{}]", embedding_str),
        }
    }
}
