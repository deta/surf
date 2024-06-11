use core::fmt;

use crate::{BackendError, BackendResult};
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSource {
    pub data_type: String,
    pub data_value: String,
    pub metadata: String,
    pub env_variables: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataSourceMetadata {
    pub resource_id: String,
    pub resource_type: String,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CitationSourceMetadata {
    pub timestamp: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CitationSource {
    pub id: String,
    pub resource_id: String,
    pub content: Option<String>,
    pub metadata: Option<CitationSourceMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub sources: Option<Vec<CitationSource>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatHistory {
    pub id: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug)]
pub enum DataSourceType {
    Text,
    YoutubeVideo,
    Webpage,
}

impl fmt::Display for DataSourceType {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DataSourceType::Text => write!(f, "text"),
            DataSourceType::YoutubeVideo => write!(f, "youtube_video"),
            DataSourceType::Webpage => write!(f, "web_page"),
        }
    }
}

#[derive(Debug)]
pub struct AI {
    api_endpoint: String,
    client: reqwest::blocking::Client,
    async_client: reqwest::Client,
}

impl AI {
    pub fn new(api_endpoint: String) -> Self {
        Self {
            api_endpoint,
            client: reqwest::blocking::Client::new(),
            async_client: reqwest::Client::new(),
        }
    }

    pub fn get_chat_history(&self, session_id: String, api_endpoint: Option<String>) -> Result<ChatHistory, reqwest::Error> {
        let mut api_endpoint = api_endpoint.unwrap_or_else(|| self.api_endpoint.clone());
        if api_endpoint == "" {
            api_endpoint = self.api_endpoint.clone();
        }
        let url = format!("{}/admin/chat_history/{}", &api_endpoint, session_id);
        let response = self.client.get(url).send()?;
        let chat_history = response.json::<ChatHistory>()?;
        Ok(chat_history)
    }

    pub fn add_data_source(&self, data_source: &DataSource) -> Result<(), reqwest::Error> {
        dbg!(data_source);
        let url = format!("{}/admin/data_sources", &self.api_endpoint);

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(data_source)
            .send()?;
        dbg!(&response.text());
        Ok(())
    }

    pub async fn chat(
        &self,
        query: String,
        session_id: String,
        number_documents: i32,
        model: String,
        api_endpoint: Option<String>, 
    ) -> BackendResult<impl Stream<Item = BackendResult<Option<String>>>> {
        let mut api_endpoint = api_endpoint.unwrap_or_else(|| self.api_endpoint.clone());
        if api_endpoint == "" {
            api_endpoint = self.api_endpoint.clone();
        }

        let url = format!("{}/chat", &api_endpoint);
        let response = self
            .async_client
            .get(url)
            .query(&[
                ("query", &query),
                ("session_id", &session_id),
                ("number_documents", &number_documents.to_string()),
                ("model", &model),
            ])
            .send()
            .await?;

        let stream = response.bytes_stream().map(|chunk| match chunk {
            Ok(bytes) => match String::from_utf8(bytes.to_vec()) {
                Ok(string) => Ok(Some(string)),
                Err(e) => Err(BackendError::GenericError(e.to_string())),
            },
            Err(e) => Err(BackendError::from(e)),
        });

        Ok(stream)
    }
}
