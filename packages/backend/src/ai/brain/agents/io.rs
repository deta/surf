use serde::Serialize;

use crate::BackendResult;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusType {
    Status,
    Error,
    Sources,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusMessage {
    #[serde(rename = "type")]
    pub status_type: StatusType,
    pub value: String,
}

impl StatusMessage {
    pub fn new_status(value: &str) -> Self {
        Self {
            status_type: StatusType::Status,
            value: value.to_string(),
        }
    }

    pub fn new_error(value: &str) -> Self {
        Self {
            status_type: StatusType::Error,
            value: value.to_string(),
        }
    }

    pub fn new_sources(value: &str) -> Self {
        Self {
            status_type: StatusType::Sources,
            value: value.to_string(),
        }
    }
}

// TODO: readAt and writeAt, append?
pub trait AgentIO {
    fn get_id(&self) -> String;
    fn write(&self, content: &str) -> BackendResult<()>;
    fn write_status(&self, message: StatusMessage) -> BackendResult<()>;
    fn read(&self) -> BackendResult<String>;
    fn clear(&self) -> BackendResult<()>;
}

pub struct MemoryIO {
    content: RwLock<String>,
}

impl Default for MemoryIO {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryIO {
    pub fn new() -> Self {
        Self {
            content: RwLock::new(String::new()),
        }
    }
}

impl AgentIO for MemoryIO {
    fn get_id(&self) -> String {
        "memory_io".to_string()
    }

    fn write(&self, content: &str) -> BackendResult<()> {
        let mut buffer = self.content.write().unwrap();
        buffer.push_str(content);
        tracing::debug!("IO Output: {}", content);
        Ok(())
    }

    fn write_status(&self, _status: StatusMessage) -> BackendResult<()> {
        Ok(())
    }

    fn read(&self) -> BackendResult<String> {
        Ok(self.content.read().unwrap().clone())
    }

    fn clear(&self) -> BackendResult<()> {
        let mut buffer = self.content.write().unwrap();
        buffer.clear();
        Ok(())
    }
}
