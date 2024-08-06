use core::fmt;

use crate::ai::client::FilteredSearchRequest;
use crate::embeddings::chunking::ContentChunker;
use crate::store::db::{CompositeResource, Database};
use crate::store::models::{AIChatSessionMessage, AIChatSessionMessageSource};
use crate::{llm, llm::openai::openai};
use crate::{BackendError, BackendResult};
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};

use super::client::{DocsSimilarityRequest, LocalAIClient, UpsertEmbeddingsRequest};
use super::prompts::{
    chat_prompt, command_prompt, create_app_prompt, general_chat_prompt, sql_query_generator_prompt, should_narrow_search_prompt 
};

use std::pin::Pin;

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
pub struct SimilarDocsRequest {
    pub query: String,
    pub docs: Vec<String>,
    pub threshold: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub index: u64, 
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAppRequest {
    pub prompt: String,
    pub session_id: String,
    pub contexts: Option<Vec<String>>,
    pub system_prompt: Option<String>,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct ResourcesQueryRequest {
    pub query: String,
    pub resource_ids: Vec<String>,
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

// TODO: move embeddings store and embedding model to backend server process
pub struct AI {
    pub llm: openai::OpenAI, // TODO: use a trait
    pub chunker: ContentChunker, 
    local_mode: bool,
    local_ai_client: LocalAIClient,
    async_runtime: tokio::runtime::Runtime,
}

impl AI {
    pub fn new(
        api_key: String, 
        local_mode: bool,
        local_ai_socket_path: String
    ) -> BackendResult<Self> {
        let local_ai_client = LocalAIClient::new(local_ai_socket_path);
        Ok(Self {
            // TODO: not hardcode model
            llm: openai::OpenAI::new("gpt-4o".to_string(), api_key, None)?,
            chunker: ContentChunker::new(2000, 1),
            local_mode,
            local_ai_client,
            async_runtime: tokio::runtime::Runtime::new()?,
        })
    }

    pub fn toggle_local_mode(&mut self) {
        self.local_mode = !self.local_mode;
    }

    pub fn format_chat_history(&self, history: Vec<AIChatSessionMessage>) -> Option<String> {
        if history.is_empty() {
            return None;
        }
        let mut formatted = String::new();
        for message in history {
            formatted.push_str(format!("{}: {}\n", message.role, message.content).as_str());
        }
        Some(formatted)
    }

    pub fn get_docs_similarity(
        &self,
        query: String, 
        docs: Vec<String>,
        threshold: Option<f32>,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        let threshold = threshold.unwrap_or(0.5);
        self.local_ai_client.get_docs_similarity(DocsSimilarityRequest{
            query,
            docs,
            threshold,
            num_docs: 5,
        })
    }

    pub fn should_cluster(&self, query: &str) -> BackendResult<bool>{
        let prompt = should_narrow_search_prompt();
        let messages = vec![
            llm::models::Message {
                role: "system".to_string(),
                content: prompt,
            },
            llm::models::Message {
                role: "user".to_string(),
                content: query.to_string(),
            },
        ];
        // TODO: use local mode
        Ok(self.llm.create_chat_completion_blocking(messages)?
            .to_lowercase()
            .contains("true")
        )
    }

    pub fn upsert_embeddings(
        &mut self,
        old_keys: Vec<i64>,
        new_keys: Vec<i64>,
        chunks: Vec<String>
    ) -> BackendResult<()> {
        self.local_ai_client.upsert_embeddings(UpsertEmbeddingsRequest{
            old_keys,
            new_keys,
            chunks,
        }) 
    }
    
    // TODO: what behavior if no num_docs and no resource_ids?
    pub fn vector_search(&self, 
        contents_store: &Database, 
        query: String, 
        // matches all embeddings if None
        num_docs: usize,
        resource_ids: Option<Vec<String>>,
        unique_resources_only: bool,
    ) -> BackendResult<Vec<CompositeResource>>{
        dbg!(&query);
        dbg!(&num_docs);
        dbg!(&resource_ids);

        let keys: Vec<i64> = match resource_ids {
            Some(resource_ids) => contents_store.list_embedding_ids_by_resource_ids(resource_ids)?,
            None => contents_store.list_non_deleted_embedding_ids()?
        };
        let keys: Vec<u64> = keys.iter().map(|id| *id as u64).collect();
        dbg!(&keys);

        let search_results = self.local_ai_client.filtered_search(FilteredSearchRequest{
            query: query.clone(),
            num_docs,
            keys,
        })?;
        dbg!(&search_results);
        let resources = match unique_resources_only{
            false => contents_store.list_resources_by_embedding_row_ids(search_results)?,
            true => contents_store.list_unique_resources_only_by_embedding_row_ids(search_results)?,
        };
        Ok(resources)
    }

    pub fn get_sources_contexts(&self, resources: Vec<CompositeResource>) -> (Vec<AIChatSessionMessageSource>, String, String) {
        let mut sources = Vec::new();
        let mut sources_xml = "<sources>\n".to_string();
        let mut contexts = String::new();
        let mut index = 1;
        for resource in resources {
            if resource.text_content.is_none() {
                continue;
            }
            let source = AIChatSessionMessageSource::from_resource_index(&resource, index);
            if source.is_none() {
                continue;
            }
            let content = resource.text_content.unwrap().content;
            let source = source.unwrap();
            sources_xml.push_str(&source.to_xml());
            sources.push(source);
            contexts.push_str(format!("{}. {}\n", index, content).as_str());
            index += 1;
        }
        sources_xml.push_str("</sources>");
        (sources, sources_xml, contexts)
    }

    async fn general_chat(&self, query: String, history: Option<String>) -> BackendResult<(String, Pin<Box<dyn Stream<Item = BackendResult<String>>>>)> {
        let messages = vec![
            llm::models::Message {
                role: "system".to_string(),
                content: general_chat_prompt(history),
            },
            llm::models::Message {
                role: "user".to_string(),
                content: query,
            },
        ];
        let preamble = "<sources></sources>".to_string();
        let stream = match self.local_mode {
            true => self.local_ai_client.create_chat_completion(messages).await?,
            false => self.llm.create_chat_completion(messages).await?,
        };
        Ok((preamble, stream))
    }

    pub fn encode_sentences(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>>{ 
        self.local_ai_client.encode_sentences(&sentences)
    }

    // TODO: history and return sources separately 
    pub async fn chat(
        &self,
        contents_store: &Database,
        query: String,
        number_documents: i32,
        resource_ids: Option<Vec<String>>,
        general: bool,
        should_cluster: bool,
        history: Option<String>,
    ) -> BackendResult<(Vec<AIChatSessionMessageSource>, String, Pin<Box<dyn Stream<Item = BackendResult<String>>>>)> {
        if general {
            let (preamble, stream) = self.general_chat(query, history).await?;     
            return Ok((Vec::new(), preamble, stream));
        }
        
        if !should_cluster && resource_ids.is_none() {
            return Err(BackendError::GenericError("Resource IDs must be provided if not clustering".to_string()));
        }
        let resource_ids = resource_ids.unwrap_or(Vec::new());

        dbg!(&query);
        dbg!(should_cluster);

        let rag_results = match should_cluster {
            true => self.vector_search(
                contents_store,
                query.clone(),
                number_documents as usize,
                Some(resource_ids),
                false,
            )?, 
            false => contents_store.list_resources_by_ids(resource_ids)?,
        };
        dbg!(&rag_results.len());
        let (sources, sources_xml, contexts) = self.get_sources_contexts(rag_results);
        dbg!(&sources.len());
        let messages = vec![
            llm::models::Message {
                role: "system".to_string(),
                content: chat_prompt(contexts, history),
            },
            llm::models::Message {
                role: "user".to_string(),
                content: query,
            },
        ]; 
        let stream = match self.local_mode {
            true => self.local_ai_client.create_chat_completion(messages).await?,
            false => self.llm.create_chat_completion(messages).await?,
        };
        Ok((sources, sources_xml, stream))
    }

    // TODO: migrate
    pub fn get_sql_query(&self, prompt: String) -> BackendResult<String> {
        let messages = vec![
            llm::models::Message {
                role: "system".to_string(),
                content: sql_query_generator_prompt()
            },
            llm::models::Message {
                role: "user".to_string(),
                content: prompt
            }
        ];
        match self.local_mode {
            true => {
                let mut result = String::new();
                self.async_runtime.block_on(async {
                    let mut stream = self.local_ai_client.create_chat_completion(messages).await?;
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(chunk) => {
                                result.push_str(&chunk);
                            },
                            Err(e) => return Err(e),
                        }
                    }
                    Ok(())
                })?;
                Ok(result)            
            },
            false => {
                let mut result = String::new();
                self.async_runtime.block_on(async {
                    let mut stream = self.llm.create_chat_completion(messages).await?;
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(chunk) => {
                                result.push_str(&chunk);
                            },
                            Err(e) => return Err(e),
                        }
                    }
                    Ok(())
                })?;
                Ok(result)
            }
        }
    }

    pub fn create_app(&self, prompt: String, _session_id: String, contexts: Option<Vec<String>>) -> BackendResult<String> {
        // TODO: support multiple contexts 
        let mut ctx = String::new();
        if let Some(contexts) = contexts {
            if contexts.len() > 1 {
                return Err(BackendError::GenericError("Only one context is supported".to_string()));
            }
            ctx = contexts[0].clone();
        }

        let system_message = match prompt.to_lowercase().starts_with("app:") {
            true => create_app_prompt(&ctx),
            false => command_prompt(&ctx),
        };

        let messages = vec![
            llm::models::Message {
                role: "system".to_string(),
                content: system_message,
            },
            llm::models::Message {
                role: "user".to_string(),
                content: prompt,
            },
        ];

        // TODO: is this the best way to use tokio async runtime?
        let runtime = tokio::runtime::Runtime::new().map_err(|e| BackendError::GenericError(e.to_string()))?;
        let mut result = String::new();
        
        if self.local_mode {
            runtime.block_on(async {
                let mut stream = self.local_ai_client.create_chat_completion(messages).await?;
                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(chunk) => {
                            result.push_str(&chunk);
                        },
                        Err(e) => return Err(e),
                    }
                }
                Ok(())
            })?;
        } else {
            result = self.llm.create_chat_completion_blocking(messages)?;
        }
        dbg!(&result);
        Ok(result)
    }
}
