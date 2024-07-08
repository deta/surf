use core::fmt;
use std::time::Duration;

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
pub struct DataSourceChunkMetadata {
    pub resource_id: String,
    pub resource_type: String,
    pub hash: Option<String>,
    pub timestamp: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataSourceChunk {
    pub content: String,
    pub metadata: DataSourceChunkMetadata,
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
    pub hash: Option<String>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct SimilarDocsRequest {
    pub query: String,
    pub docs: Vec<String>,
    pub threshold: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub doc: String, 
    pub similarity: f32 
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscriptPiece {
    pub text: String,
    pub start: f32,
    pub duration: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscriptMetadata {
    pub source: String,
    pub transcript_pieces: Vec<YoutubeTranscriptPiece>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YoutubeTranscript {
    pub transcript: String,
    pub metadata: YoutubeTranscriptMetadata
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
        let client = reqwest::blocking::Client::builder().timeout(Duration::from_secs(300)).build().unwrap();
        Self {
            api_endpoint,
            client,
            async_client: reqwest::Client::new(),
        }
    }

    pub fn get_docs_similarity(
        &self,
        query: String, 
        docs: Vec<String>,
        threshold: Option<f32>,
    ) -> Result<Vec<DocsSimilarity>, reqwest::Error> {
        let url = format!("{}/docs_similarity", &self.api_endpoint);
        let request = SimilarDocsRequest {
            query,
            docs,
            threshold,
        };
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        let response = self
            .client
            .post(url)
            .headers(headers)
            .json(&request)
            .send()?;
        match response.error_for_status_ref() {
            Ok(_) => (),
            Err(e) => return Err(e),
        }
        Ok(response.json::<Vec<DocsSimilarity>>()?)
    }

    pub fn get_chat_history(
        &self,
        session_id: String,
        api_endpoint: Option<String>,
    ) -> Result<ChatHistory, reqwest::Error> {
        let mut api_endpoint = api_endpoint.unwrap_or_else(|| self.api_endpoint.clone());
        if api_endpoint == "" {
            api_endpoint = self.api_endpoint.clone();
        }
        let url = format!("{}/admin/chat_history/{}", &api_endpoint, session_id);
        let response = self.client.get(url).send()?;
        let chat_history = response.json::<ChatHistory>()?;
        Ok(chat_history)
    }

    pub fn delete_chat_history(&self, session_id: String) -> Result< (), reqwest::Error> {
        let url = format!("{}/admin/chat_history/{}", &self.api_endpoint, &session_id);
        let response = self.client.delete(url).send()?;
        match response.error_for_status_ref() {
            Ok(_) => Ok(()),
            Err(e) => Err(e)
        }
    }

    pub fn get_resources(
        &self,
        query: String,
        resource_ids: Vec<String>,
    ) -> BackendResult<Vec<String>> {
        let url = format!("{}/resources", &self.api_endpoint);
        let response = self
            .client
            .get(url)
            .query(&vec![
                ("query", query.as_str()),
                ("resource_ids", resource_ids.join(",").as_str()),
            ])
            .send()?;
        Ok(response.json()?)
    }

    pub fn get_data_source(&self, source_hash: &str) -> Result<DataSourceChunk, reqwest::Error> {
        let url = format!("{}/admin/data_sources/{}", &self.api_endpoint, source_hash);
        let response = self.client.get(url).send()?;
        let data_source = response.json::<DataSourceChunk>()?;
        Ok(data_source)
    }

    pub fn get_youtube_transcript(&self, video_url: &str) -> Result<YoutubeTranscript, reqwest::Error> {
        let url = format!("{}/transcripts/youtube?url={}", &self.api_endpoint, video_url);
        let encoded = url::form_urlencoded::Serializer::new(url).finish();
        
        let response = self.client.get(encoded).send()?;
        match response.error_for_status_ref() {
            Ok(_) => {
                Ok(response.json::<YoutubeTranscript>()?)
            },
            Err(e) => Err(e)
        }
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

    pub fn remove_data_source_by_resource_id(&self, resource_id: &str) -> Result<(), reqwest::Error> {
        let url = format!("{}/admin/data_sources?resource_id={}", &self.api_endpoint, resource_id);
        let response = self.client.delete(url).send()?;
        match response.error_for_status() {
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        }
    }

    pub async fn chat(
        &self,
        query: String,
        session_id: String,
        number_documents: i32,
        model: String,
        rag_only: bool,
        api_endpoint: Option<String>,
        resource_ids: Option<Vec<String>>,
    ) -> BackendResult<impl Stream<Item = BackendResult<Option<String>>>> {
        let mut api_endpoint = api_endpoint.unwrap_or_else(|| self.api_endpoint.clone());
        if api_endpoint == "" {
            api_endpoint = self.api_endpoint.clone();
        }

        let url = format!("{}/chat", &api_endpoint);
        let mut query_params = vec![
            ("rag_only", rag_only.to_string()),
            ("query", query),
            ("session_id", session_id),
            ("number_documents", number_documents.to_string()),
            ("model", model),
        ];
        if let Some(resource_ids) = resource_ids {
            query_params.push(("resource_ids", resource_ids.join(",")))
        }

        let response = self
            .async_client
            .get(url)
            .query(&query_params)
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
