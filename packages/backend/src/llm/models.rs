use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageContentText {
    #[serde(rename = "type")]
    typ: String,
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageContentImageURL {
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageContentImage {
    #[serde(rename = "type")]
    typ: String,
    pub image_url: MessageContentImageURL,
}

#[derive(Deserialize, Debug, Clone)]
pub enum MessageContent {
    Text(MessageContentText),
    Image(MessageContentImage),
}

impl MessageContent {
    pub fn new_text(text: String) -> MessageContent {
        MessageContent::Text(MessageContentText {
            typ: "text".to_string(),
            text,
        })
    }
    pub fn new_image(url: String) -> MessageContent {
        MessageContent::Image(MessageContentImage {
            typ: "image_url".to_string(),
            image_url: MessageContentImageURL { url },
        })
    }
}

impl Serialize for MessageContent {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        match self {
            MessageContent::Text(text) => text.serialize(serializer),
            MessageContent::Image(image) => image.serialize(serializer),
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub role: String,
    pub content: Vec<MessageContent>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatCompletionMessage {
    pub role: String,
    pub content: String,
}
