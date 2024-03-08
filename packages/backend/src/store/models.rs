use serde::{Deserialize, Serialize};
use url::Url;

use std::str::FromStr;
use std::string::ToString;

pub fn default_horizon_tint() -> String {
    "hsl(275, 40%, 80%)".to_owned()
}

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

fn get_hostname_from_uri(uri: &str) -> Option<String> {
    Url::parse(uri)
        .ok()
        .and_then(|url| url.host_str().map(|host| host.to_owned()))
}

// TODO: use strum
pub enum InternalResourceTagNames {
    Type,
    Deleted,
    Hostname,
    HorizonId,
}

impl InternalResourceTagNames {
    pub fn as_str(&self) -> &str {
        match self {
            InternalResourceTagNames::Type => "type",
            InternalResourceTagNames::Deleted => "deleted",
            InternalResourceTagNames::Hostname => "hostname",
            InternalResourceTagNames::HorizonId => "horizonId",
        }
    }
}

impl FromStr for InternalResourceTagNames {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "type" => Ok(InternalResourceTagNames::Type),
            "deleted" => Ok(InternalResourceTagNames::Deleted),
            "hostname" => Ok(InternalResourceTagNames::Hostname),
            "horizonId" => Ok(InternalResourceTagNames::HorizonId),
            _ => Err(()),
        }
    }
}

impl ToString for InternalResourceTagNames {
    fn to_string(&self) -> String {
        match self {
            InternalResourceTagNames::Type => "type".to_string(),
            InternalResourceTagNames::Deleted => "deleted".to_string(),
            InternalResourceTagNames::Hostname => "hostname".to_string(),
            InternalResourceTagNames::HorizonId => "horizonId".to_string(),
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
    pub tint: String,
    #[serde(default = "default_horizon_tint")]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, strum::EnumString, strum::AsRefStr)]
#[strum(ascii_case_insensitive)]
#[serde(rename_all = "lowercase")]
pub enum ResourceTagFilterOp {
    Eq,
    Ne,
    Prefix,
    Suffix,
}

impl Default for ResourceTagFilterOp {
    fn default() -> Self {
        ResourceTagFilterOp::Eq
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTagFilter {
    pub tag_name: String,
    pub tag_value: String,
    #[serde(default)]
    pub op: ResourceTagFilterOp,
}

impl ResourceTagFilter {
    pub fn get_sql_filter_with_value(&self, indexes: (usize, usize)) -> (String, String) {
        let (i1, i2) = indexes;
        match self.op {
            ResourceTagFilterOp::Eq => (
                format!("tag_name = ?{} AND tag_value = ?{}", i1, i2),
                self.tag_value.clone(),
            ),
            ResourceTagFilterOp::Ne => (
                format!("tag_name = ?{} AND tag_value != ?{}", i1, i2),
                self.tag_value.clone(),
            ),
            ResourceTagFilterOp::Prefix => (
                format!("tag_name = ?{} AND tag_value LIKE ?{}", i1, i2),
                format!("{}%", self.tag_value),
            ),
            ResourceTagFilterOp::Suffix => (
                format!("tag_name = ?{} AND tag_value LIKE ?{}", i1, i2),
                format!("%{}", self.tag_value),
            ),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceMetadata {
    #[serde(default = "random_uuid")]
    pub id: String,
    pub resource_id: String,
    pub name: String,

    #[serde(default)]
    pub source_uri: String,

    #[serde(default)]
    pub alt: String,

    #[serde(default)]
    pub user_context: String,
}

impl ResourceMetadata {
    pub fn get_tags(&self) -> Vec<ResourceTag> {
        let mut tags: Vec<ResourceTag> = Vec::new();
        if self.source_uri != "" {
            if let Some(hostname) = get_hostname_from_uri(&self.source_uri) {
                tags.push(ResourceTag {
                    id: random_uuid(),
                    resource_id: self.resource_id.clone(),
                    tag_name: InternalResourceTagNames::Hostname.to_string(),
                    tag_value: hostname,
                });
            }
        }
        tags
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
        let pos_str = format!("[{:?}.0, {:?}.0]", position_array[0], position_array[1]);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hostname_from_uri() {
        let uri = "https://www.google.com";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("www.google.com".to_string()));

        let uri = "https://deta.space";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("deta.space".to_string()));

        let uri = "non valid uri";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, None);

        let uri = "https://google.com/search?q=hello";
        let hostname = get_hostname_from_uri(uri);
        assert_eq!(hostname, Some("google.com".to_string()));
    }

    #[test]
    fn test_get_tags_from_resource_metadata() {
        let metadata = ResourceMetadata {
            id: random_uuid(),
            resource_id: random_uuid(),
            name: "test".to_string(),
            source_uri: "https://www.google.com".to_string(),
            alt: "".to_string(),
            user_context: "".to_string(),
        };
        let tags = metadata.get_tags();
        assert_eq!(tags.len(), 1);
        assert_eq!(
            tags[0].tag_name,
            InternalResourceTagNames::Hostname.to_string()
        );
        assert_eq!(tags[0].tag_value, "www.google.com".to_string());
    }
}
