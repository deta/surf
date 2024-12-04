use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

use crate::{BackendError, BackendResult};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MessageContentText {
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MessageContentImageURL {
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MessageContentImage {
    pub image_url: MessageContentImageURL,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum MessageContent {
    #[serde(rename = "text")]
    Text(MessageContentText),
    #[serde(rename = "image_url")]
    Image(MessageContentImage),
}

impl MessageContent {
    pub fn new_text(text: String) -> MessageContent {
        MessageContent::Text(MessageContentText { text })
    }
    pub fn new_image(url: String) -> MessageContent {
        MessageContent::Image(MessageContentImage {
            image_url: MessageContentImageURL { url },
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, EnumString, PartialEq, Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum MessageRole {
    System,
    Assistant,
    User,
    Function,
    Tool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ContextMessage {
    pub id: String,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub content_type: String,
    pub title: Option<String>,
    pub author: Option<String>,
    pub source_url: Option<String>,
    pub page: Option<u32>,
    pub description: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Message {
    pub role: MessageRole,
    pub content: Vec<MessageContent>,
    #[serde(skip)]
    pub truncatable: bool,
    #[serde(skip)]
    pub is_context: bool,
}

impl Message {
    pub fn with_truncatable(mut self, truncatable: bool) -> Self {
        self.truncatable = truncatable;
        self
    }

    pub fn new_system(msg: &str) -> Message {
        Message {
            role: MessageRole::System,
            content: vec![MessageContent::new_text(msg.to_string())],
            truncatable: false,
            is_context: false,
        }
    }

    pub fn new_user(msg: &str) -> Message {
        Message {
            role: MessageRole::User,
            content: vec![MessageContent::new_text(msg.to_string())],
            truncatable: false,
            is_context: false,
        }
    }

    pub fn new_assistant(msg: &str) -> Message {
        Message {
            role: MessageRole::Assistant,
            content: vec![MessageContent::new_text(msg.to_string())],
            truncatable: false,
            is_context: false,
        }
    }

    // TODO: try different formats for context messages
    pub fn new_context(msg: &ContextMessage) -> BackendResult<Message> {
        let context_message_str = serde_json::to_string(msg).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize context message: {}", e))
        })?;
        Ok(Message {
            role: MessageRole::User,
            content: vec![MessageContent::new_text(context_message_str)],
            truncatable: true,
            is_context: true,
        })
    }

    // TODO: what if image is a non-truncatable user message?
    pub fn new_image(url: &str) -> Message {
        Message {
            role: MessageRole::User,
            content: vec![MessageContent::new_image(url.to_string())],
            truncatable: true,
            is_context: true,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatCompletionMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaUsageType {
    DailyInputTokens,
    DailyOutputTokens,
    MonthlyInputTokens,
    MonthlyOutputTokens,
    MonthlyVisionRequests,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaTier {
    Premium,
    PremiumVision,
    Standard,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Quota {
    pub tier: QuotaTier,
    pub usage_type: QuotaUsageType,
    pub used: u64,
    pub total: u64,
    pub updated_at: String,
    pub resets_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuotaResponse {
    pub quotas: Vec<Quota>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuotasDepletedResponse {
    pub detail: String,
    pub quotas: Vec<Quota>,
}
