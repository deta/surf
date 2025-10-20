pub mod embeddings;
pub mod llm;
pub mod youtube;

#[cfg(feature = "wip")]
pub mod brain;

mod local;
mod prompts;

pub const _MODULE_PREFIX: &str = "ai";
pub const _AI_API_ENDPOINT: &str = "v1/deta-os-ai";

use std::str::FromStr;

use crate::ai::embeddings::chunking::ContentChunker;
use crate::ai::llm::client;
use crate::ai::llm::client::{ChatCompletionStream, Model};
use crate::ai::llm::models::{ContextMessage, Message, MessageContent, MessageRole};
use crate::ai::local::client::{
    DocsSimilarityRequest, FilteredSearchRequest, LocalAIClient, UpsertEmbeddingsRequest,
};
use crate::store::db::Database;
use crate::store::models::{AIChatSessionMessage, AIChatSessionMessageSource, CompositeResource};
use crate::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};

use prompts::{
    chat_prompt, create_app_prompt, general_chat_prompt, note_prompt, should_narrow_search_prompt,
    should_narrow_search_prompt_simple, sql_query_generator_prompt,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarity {
    pub index: u64,
    pub similarity: f32,
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
    pub metadata: YoutubeTranscriptMetadata,
}

pub struct ChatInput {
    pub query: String,
    pub model: Model,
    pub custom_key: Option<String>,
    pub resource_ids: Vec<String>,
    pub note_resource_id: Option<String>,
    pub number_documents: i32,
    pub inline_images: Option<Vec<String>>,
    pub general: bool,
    pub websearch: bool,
    pub surflet: bool,
}

// TODO: fix sources vs messages
pub struct ChatResult {
    pub messages: Vec<Message>,
    pub sources: Vec<AIChatSessionMessageSource>,
    pub sources_xml: String,
    pub stream: ChatCompletionStream,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShouldClusterResult {
    pub embeddings_search_needed: bool,
    pub relevant_context_ids: Option<Vec<String>>,
}

pub struct AI {
    pub client: client::LLMClient,
    pub chunker: ContentChunker,
    local_ai_client: LocalAIClient,
}

fn human_readable_current_time() -> String {
    // 2023-09-13 21:00:00 Tuesday
    chrono::Utc::now()
        .format("%Y-%m-%d %H:%M:%S %A")
        .to_string()
}

impl AI {
    pub fn new(local_ai_socket_path: String) -> BackendResult<Self> {
        Ok(Self {
            client: client::LLMClient::new()?,
            chunker: ContentChunker::new(2000, 1),
            local_ai_client: LocalAIClient::new(local_ai_socket_path),
        })
    }

    pub fn parse_chat_history(
        &self,
        history: Vec<AIChatSessionMessage>,
    ) -> BackendResult<Vec<Message>> {
        let mut messages = Vec::new();
        for msg in history {
            let content = match msg.msg_type.as_ref() {
                "text" => MessageContent::new_text(msg.content),
                "image" => MessageContent::new_image(msg.content),
                _ => {
                    return Err(BackendError::GenericError(format!(
                        "unknown chat message type: {}",
                        msg.msg_type
                    )));
                }
            };
            let role = MessageRole::from_str(&msg.role).map_err(|e| {
                BackendError::GenericError(format!("failed to parse chat message role: {}", e))
            })?;
            messages.push(Message {
                role,
                content: vec![content],
                truncatable: msg.truncatable,
                is_context: msg.is_context,
            });
        }
        Ok(messages)
    }

    pub fn get_docs_similarity(
        &self,
        query: String,
        docs: Vec<String>,
        threshold: Option<f32>,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        let threshold = threshold.unwrap_or(0.5);

        // TOOD: what's a better strategy?
        let mut num_docs = 3;
        if docs.len() > 30 {
            num_docs = 5
        }
        self.local_ai_client
            .get_docs_similarity(DocsSimilarityRequest {
                query,
                docs,
                threshold,
                num_docs,
            })
    }

    pub fn should_cluster(
        &self,
        query: &str,
        model: &Model,
        custom_key: Option<String>,
        context: Vec<ContextMessage>,
    ) -> BackendResult<ShouldClusterResult> {
        // TODO(@nullptropy): temporary measure to make local model UX better
        let (prompt, response_format) = match model {
            Model::Custom { .. } => (should_narrow_search_prompt_simple(), None),
            _ => (
                should_narrow_search_prompt(&human_readable_current_time()),
                Some(serde_json::json!({
                    "type": "json_schema",
                    "json_schema": {
                        "name": "should_cluster_response",
                        "strict": true,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "embeddings_search_needed": {
                                    "type": "boolean"
                                },
                                "relevant_context_ids": {
                                    "type": "array",
                                    "items": {
                                        "type": "string"
                                    }
                                }
                            },
                            "required": ["embeddings_search_needed", "relevant_context_ids"],
                            "additionalProperties": false
                        }
                    }
                })),
            ),
        };

        let mut messages = vec![Message::new_system(&prompt)];
        for msg in context {
            messages.push(Message::new_context(&msg)?);
        }
        messages.push(Message::new_user(&format!(
            "{}\n\nUSER QUERY: {}",
            prompt, query
        )));

        let answer =
            self.client
                .create_chat_completion(messages, model, custom_key, response_format)?;

        if let Model::Custom { .. } = model {
            Ok(ShouldClusterResult {
                embeddings_search_needed: answer.trim().to_lowercase() == "true",
                relevant_context_ids: Some(vec![]),
            })
        } else {
            let response: ShouldClusterResult = serde_json::from_str(&answer).map_err(|e| {
                BackendError::GenericError(format!(
                    "failed to parse should_cluster response: {}",
                    e
                ))
            })?;
            Ok(response)
        }
    }

    pub fn upsert_embeddings(
        &mut self,
        old_keys: Vec<i64>,
        new_keys: Vec<i64>,
        chunks: Vec<String>,
    ) -> BackendResult<()> {
        self.local_ai_client
            .upsert_embeddings(UpsertEmbeddingsRequest {
                old_keys,
                new_keys,
                chunks,
            })
    }

    pub fn encode_sentences(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        self.local_ai_client.encode_sentences(sentences)
    }

    // TODO: what behavior if no num_docs and no resource_ids?
    pub fn vector_search(
        &self,
        contents_store: &Database,
        query: String,
        // matches all embeddings if None
        num_docs: usize,
        resource_ids: Option<Vec<String>>,
        unique_resources_only: bool,
        distance_threshold: Option<f32>,
    ) -> BackendResult<Vec<CompositeResource>> {
        let keys: Vec<i64> = match resource_ids {
            Some(resource_ids) => {
                contents_store.list_embedding_ids_by_resource_ids(resource_ids)?
            }
            None => contents_store.list_non_deleted_embedding_ids()?,
        };
        let keys: Vec<u64> = keys.iter().map(|id| *id as u64).collect();

        let search_results = self
            .local_ai_client
            .filtered_search(FilteredSearchRequest {
                query: query.clone(),
                num_docs,
                keys,
                threshold: distance_threshold,
            })?;
        let resources = match unique_resources_only {
            false => contents_store.list_resources_by_embedding_row_ids(search_results)?,
            true => {
                contents_store.list_unique_resources_only_by_embedding_row_ids(search_results)?
            }
        };
        Ok(resources)
    }

    pub fn llm_metadata_messages_from_sources(
        &self,
        resources: &[CompositeResource],
    ) -> Vec<ContextMessage> {
        let mut messages = Vec::new();
        for (i, resource) in resources.iter().enumerate() {
            let mut msg = ContextMessage {
                // we don't use the actual resource id as it's a uuid
                // which is too long, use simple index instead
                id: i.to_string(),
                content_type: resource.resource.get_human_readable_type().clone(),
                created_at: Some(resource.resource.created_at.to_string()),
                page: None,
                content: None,
                title: None,
                source_url: None,
                author: None,
                description: None,
            };
            // TODO: is author info easily retreivable or stored?
            if let Some(metadata) = &resource.metadata {
                if !metadata.name.is_empty() {
                    msg.title = Some(metadata.name.clone());
                }
                if !metadata.source_uri.is_empty() {
                    msg.source_url = Some(metadata.source_uri.clone());
                }
                if !metadata.alt.is_empty() {
                    msg.description = Some(metadata.alt.clone());
                }
            }
            messages.push(msg);
        }
        messages
    }

    pub fn llm_context_messages_from_sources(
        &self,
        resources: &[CompositeResource],
    ) -> Vec<ContextMessage> {
        let mut messages = Vec::new();

        for (i, resource) in resources.iter().enumerate() {
            if resource.text_content.is_none() {
                continue;
            }
            let text_content = resource.text_content.as_ref().unwrap();
            let mut msg = ContextMessage {
                id: (i + 1).to_string(),
                content: Some(text_content.content.clone()),
                content_type: resource.resource.get_human_readable_type().clone(),
                created_at: Some(resource.resource.created_at.to_string()),
                page: text_content.metadata.page,
                title: None,
                source_url: None,
                author: None,
                description: None,
            };
            // TODO: is author info easily retreivable or stored?
            if let Some(metadata) = &resource.metadata {
                if !metadata.name.is_empty() {
                    msg.title = Some(metadata.name.clone());
                }
                if !metadata.source_uri.is_empty() {
                    msg.source_url = Some(metadata.source_uri.clone());
                }
                if !metadata.alt.is_empty() {
                    msg.description = Some(metadata.alt.clone());
                }
            }
            messages.push(msg);
        }
        messages
    }

    pub fn get_sources_xml(
        &self,
        resources: Vec<CompositeResource>,
    ) -> (Vec<AIChatSessionMessageSource>, String) {
        let mut sources_xml = "<sources>\n".to_string();
        let mut index = 1;
        let mut sources = Vec::new();
        for resource in resources {
            let source = AIChatSessionMessageSource::from_resource_index(&resource, index);
            if source.is_none() {
                continue;
            }
            let source = source.unwrap();
            sources_xml.push_str(&source.to_xml());
            sources.push(source);
            index += 1;
        }
        sources_xml.push_str("</sources>");
        (sources, sources_xml)
    }

    pub fn chat(
        &self,
        contents_store: &Database,
        input: ChatInput,
        history: Vec<Message>,
        should_cluster: bool,
    ) -> BackendResult<ChatResult> {
        if input.resource_ids.is_empty() && !input.general {
            return Err(BackendError::GenericError(
                "Resource IDs must be provided if not general query".to_string(),
            ));
        }

        let mut rag_results = match should_cluster {
            true => self.vector_search(
                contents_store,
                input.query.clone(),
                input.number_documents as usize,
                Some(input.resource_ids.clone()),
                false,
                // this is intentionally set a bit lax to allow for more results
                // ultimately the llm will decide what to do with the results
                Some(0.5),
            )?,
            false => contents_store.list_resources_by_ids(input.resource_ids.clone())?,
        };
        if rag_results.is_empty() && !input.general {
            // NOTE: this is a fallback solution to let the llm decide what to do if no rag results
            // are found by sending everything to the llm
            // side effect is context window might be too large
            if should_cluster {
                rag_results = contents_store.list_resources_by_ids(input.resource_ids)?;
            }
            if rag_results.is_empty() {
                return Err(BackendError::RAGEmptyContextError(
                    "No results found".to_string(),
                ));
            }
        }

        let contexts = self.llm_context_messages_from_sources(&rag_results);
        let (sources, sources_xml) = self.get_sources_xml(rag_results);

        // system message
        let current_time = human_readable_current_time();
        let system_message_prompt = match input.note_resource_id {
            Some(_) => note_prompt(&current_time, input.websearch, input.surflet),
            None => match input.general {
                true => general_chat_prompt(&current_time),
                false => chat_prompt(&current_time),
            },
        };

        let mut messages = vec![Message::new_system(&system_message_prompt)];

        let history_len = history.len();
        // history if any
        messages.extend(history);

        // context messages
        for msg in contexts {
            messages.push(Message::new_context(&msg)?);
        }
        // inline images
        if let Some(inline_images) = input.inline_images {
            for image in inline_images {
                messages.push(Message::new_image(&image));
            }
        }

        if let Some(note_resource_id) = input.note_resource_id {
            let resource_text_contents =
                contents_store.list_resource_text_content_by_resource_id(&note_resource_id)?;
            // concatate contents
            let content = resource_text_contents
                .iter()
                .map(|c| c.content.clone())
                .collect::<Vec<String>>()
                .join("\n");
            messages.push(Message::new_note(&content));
        }

        messages.push(Message::new_user(&input.query));
        let messages_slice = messages[history_len + 1..].to_vec().clone();
        let stream = self.client.create_streaming_chat_completion(
            messages,
            &input.model,
            input.custom_key,
            None,
        )?;

        Ok(ChatResult {
            messages: messages_slice,
            sources,
            sources_xml,
            stream,
        })
    }

    // TODO: migrate
    pub fn get_sql_query(
        &self,
        prompt: String,
        model: &Model,
        custom_key: Option<String>,
    ) -> BackendResult<String> {
        let messages = vec![
            Message::new_system(&sql_query_generator_prompt()),
            Message::new_user(&prompt),
        ];
        self.client
            .create_chat_completion(messages, model, custom_key, None)
    }

    pub fn create_app(
        &self,
        query: String,
        model: &Model,
        custom_key: Option<String>,
        inline_images: Option<Vec<String>>,
    ) -> BackendResult<ChatCompletionStream> {
        let mut messages = vec![
            Message::new_system(&create_app_prompt(&human_readable_current_time())),
            Message::new_user(&query),
        ];
        if let Some(inline_images) = inline_images {
            for image in inline_images {
                messages.push(Message::new_image(&image));
            }
        }
        self.client
            .create_streaming_chat_completion(messages, model, custom_key, None)
    }
}
