pub mod tokens;

use reqwest::{blocking::Response, header};
use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader},
    time::{Duration, Instant},
};

use crate::{
    ai::llm::models::{Message, MessageContent, MessageRole},
    BackendError, BackendResult,
};

pub struct ChatCompletionStream {
    reader: BufReader<Response>,
    buffer: String,
    provider: Provider,
    last_update: Instant,
    update_interval: Duration,
}

pub struct LLMClient {
    client: reqwest::blocking::Client,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    OpenAI,
    Anthropic,
    Google,
    Custom(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Model {
    #[serde(rename = "gpt-5")]
    GPT5,
    #[serde(rename = "gpt-5-mini")]
    #[allow(non_camel_case_types)]
    GPT5_Mini,
    #[serde(rename = "gpt-4.1")]
    GPT4_1,
    #[serde(rename = "gpt-4.1-mini")]
    GPT4_1Mini,
    #[serde(rename = "gpt-4o")]
    GPT4o,
    #[serde(rename = "gpt-4o-mini")]
    GPT4oMini,
    #[serde(rename = "o3-mini")]
    O3Mini,

    #[serde(rename = "claude-4-5-sonnet-latest")]
    Claude45Sonnet,
    #[serde(rename = "claude-4-sonnet-latest")]
    Claude4Sonnet,
    #[serde(rename = "claude-3-7-sonnet-latest")]
    Claude37Sonnet,
    #[serde(rename = "claude-3-5-sonnet-latest")]
    Claude35Sonnet,
    #[serde(rename = "claude-3-5-haiku-latest")]
    Claude35Haiku,

    #[serde(rename = "gemini-2.0-flash")]
    Gemini20Flash,

    #[serde(rename = "custom")]
    Custom {
        name: String,
        provider: Provider,
        max_tokens: usize,
        vision: bool,
    },
}

pub trait TokenModel {
    fn max_tokens(&self) -> usize;
}

mod response_types {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    pub struct ChatCompletionError {
        pub r#type: String,
        pub message: String,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct ChatCompletionChunkErrorResponse {
        pub error: ChatCompletionError,
    }

    pub mod openai {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize, Clone)]
        pub(crate) struct ChatCompletionChoiceDelta {
            pub content: Option<String>,
        }

        #[derive(Serialize, Deserialize, Debug, Clone)]
        pub struct ChatCompletionMessage {
            pub role: String,
            pub content: String,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub(crate) struct ChatCompletionChoice {
            pub message: Option<ChatCompletionMessage>,
            pub index: u32,
            pub delta: Option<ChatCompletionChoiceDelta>,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub(crate) struct ChatCompletionChunkResponse {
            pub choices: Vec<ChatCompletionChoice>,
        }
    }

    pub mod anthropic {
        use serde::{Deserialize, Serialize};

        #[derive(Debug, Serialize, Deserialize)]
        pub struct ChunkResponseDelta {
            pub text: Option<String>,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct ChunkResponse {
            pub delta: Option<ChunkResponseDelta>,
        }

        #[derive(Debug, Serialize, Deserialize)]
        #[serde(tag = "type")]
        pub enum Response {
            #[serde(rename = "message")]
            Message(MessageResponse),
            #[serde(rename = "error")]
            Error(ErrorResponse),
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct MessageResponse {
            pub content: Vec<Content>,
            pub id: String,
            pub model: String,
            pub role: String,
            pub stop_reason: Option<String>,
            pub stop_sequence: Option<String>,
            pub usage: Usage,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct Content {
            pub r#type: String,
            pub text: String,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct Usage {
            pub input_tokens: u32,
            pub output_tokens: u32,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct ErrorResponse {
            pub error: Error,
        }

        #[derive(Debug, Serialize, Deserialize)]
        pub struct Error {
            pub r#type: String,
            pub message: String,
        }
    }
}

fn filter_unsupported_content(messages: Vec<Message>, model: &Model) -> Vec<Message> {
    if model.supports_images() {
        messages
    } else {
        messages
            .into_iter()
            .map(|mut msg| {
                msg.content.retain(|c| matches!(c, MessageContent::Text(_)));
                msg
            })
            .filter(|msg| !msg.content.is_empty())
            .collect()
    }
}

fn truncate_messages(messages: Vec<Message>, model: &Model) -> Vec<Message> {
    if messages.is_empty() {
        return messages;
    }
    let mut truncated_messages = vec![messages[0].clone()];
    let (_, messages) = tokens::truncate_messages(messages[1..].to_vec(), model);
    truncated_messages.extend(messages);
    truncated_messages
}

impl ChatCompletionStream {
    fn new(reader: BufReader<Response>, provider: Provider, packets_per_second: u32) -> Self {
        Self {
            reader,
            buffer: String::new(),
            provider,
            last_update: Instant::now(),
            update_interval: Duration::from_secs_f64(1.0 / packets_per_second as f64),
        }
    }

    pub fn set_packets_per_second(&mut self, pps: u32) {
        self.update_interval = Duration::from_secs_f64(1.0 / pps as f64);
    }

    fn wait_for_next_update(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_update);
        if elapsed < self.update_interval {
            std::thread::sleep(self.update_interval - elapsed);
        }
        self.last_update = Instant::now();
    }
}

impl Provider {
    fn get_completion_url(&self, base_url: Option<String>) -> String {
        match self {
            Self::OpenAI => format!(
                "{}/v1/chat/completions",
                base_url.unwrap_or("https://api.openai.com".to_string()),
            ),
            Self::Google => format!(
                "{}/chat/completions",
                base_url.unwrap_or(
                    "https://generativelanguage.googleapis.com/v1beta/openai".to_string()
                ),
            ),
            Self::Anthropic => format!(
                "{}/v1/messages",
                base_url.unwrap_or("https://api.anthropic.com".to_string())
            ),
            Self::Custom(url) => url.to_string(),
        }
    }

    fn get_headers(&self, api_key: Option<String>) -> Vec<(String, String)> {
        let mut headers = vec![("Content-Type".to_string(), "application/json".to_string())];

        if let Some(api_key) = api_key {
            let auth = match self {
                Self::OpenAI | Self::Google | Self::Custom(_) => {
                    ("Authorization".to_string(), format!("Bearer {}", api_key))
                }
                Self::Anthropic => ("x-api-key".to_string(), api_key.to_string()),
            };
            headers.push(auth);
        }

        if matches!(self, Self::Anthropic) {
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
        }

        headers
    }
}

impl Provider {
    fn get_request_params(
        &self,
        custom_key: Option<String>,
    ) -> BackendResult<(String, Vec<(String, String)>)> {
        let (completions_url, api_key) = match (self, custom_key) {
            (Self::Custom(_), api_key) => (self.get_completion_url(None), api_key),
            (_, Some(api_key)) => (self.get_completion_url(None), Some(api_key)),
            (_, None) => return Err(BackendError::LLMClientErrorAPIKeyMissing),
        };

        Ok((completions_url, self.get_headers(api_key)))
    }

    fn prepare_completion_request(
        &self,
        model: &str,
        stream: bool,
        max_tokens: i32,
        messages: &[Message],
        response_format: Option<&serde_json::Value>,
    ) -> BackendResult<String> {
        match self {
            Self::OpenAI | Self::Google => {
                self.prepare_openai_request(model, stream, messages, response_format)
            }
            Self::Custom(_) => self.prepare_openai_request(
                model,
                stream,
                &self.add_response_format_if_needed(messages.to_vec(), response_format),
                None,
            ),
            Self::Anthropic => self.prepare_anthropic_request(
                model,
                stream,
                max_tokens,
                &self.add_response_format_if_needed(messages.to_vec(), response_format),
                response_format,
            ),
        }
    }

    fn prepare_openai_request(
        &self,
        model: &str,
        stream: bool,
        messages: &[Message],
        response_format: Option<&serde_json::Value>,
    ) -> BackendResult<String> {
        let mut json_obj = serde_json::json!({
            "model": model,
            "stream": stream,
            "messages": messages,
        });
        if let Some(format) = response_format {
            json_obj["response_format"] = serde_json::json!(format);
        }

        serde_json::to_string(&json_obj).map_err(|err| {
            BackendError::GenericError(format!(
                "failed to serialize openai completion request: {err}"
            ))
        })
    }

    fn prepare_anthropic_request(
        &self,
        model: &str,
        stream: bool,
        max_tokens: i32,
        messages: &[Message],
        _response_format: Option<&serde_json::Value>,
    ) -> BackendResult<String> {
        let system_message = messages
            .first()
            .filter(|m| m.role == MessageRole::System)
            .map(|m| m.content.clone());
        let transformed_messages = self.transform_messages_for_anthropic(messages);

        serde_json::to_string(&serde_json::json!({
            "model": model,
            "stream": stream,
            "system": system_message,
            "messages": transformed_messages,
            "max_tokens": max_tokens,
        }))
        .map_err(|err| {
            BackendError::GenericError(format!(
                "failed to serialize anthropic completion request: {err}"
            ))
        })
    }

    fn transform_messages_for_anthropic(&self, messages: &[Message]) -> Vec<serde_json::Value> {
        messages
            .iter()
            .filter(|m| m.role != MessageRole::System)
            .map(|m| {
                let transformed_content = m
                    .content
                    .iter()
                    .map(|content| match content {
                        MessageContent::Text(text_content) => {
                            serde_json::json!({
                                "type": "text",
                                "text": text_content.text
                            })
                        }
                        MessageContent::Image(image_content) => {
                            let (media_type, base64_data) =
                                self.extract_image_data(&image_content.image_url.url);
                            serde_json::json!({
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": base64_data
                                }
                            })
                        }
                    })
                    .collect::<Vec<_>>();

                serde_json::json!({
                    "role": m.role.to_string(),
                    "content": transformed_content
                })
            })
            .collect()
    }

    fn extract_image_data<'a>(&self, url: &'a str) -> (&'a str, &'a str) {
        if let Some(stripped) = url.strip_prefix("data:") {
            let parts: Vec<&str> = stripped.split(";base64,").collect();
            (parts[0], parts[1])
        } else {
            ("image/jpeg", url)
        }
    }

    fn add_response_format_if_needed(
        &self,
        mut messages: Vec<Message>,
        response_format: Option<&serde_json::Value>,
    ) -> Vec<Message> {
        if let Some(format) = response_format {
            messages.push(Message::new_user(
                format!(
                    "Return ONLY a JSON object matching this schema - no other text:\n{format}"
                )
                .as_str(),
            ));
            messages.push(Message::new_assistant("{"));
        }
        messages
    }
}

impl Provider {
    fn parse_potential_error(&self, data: &str) -> BackendResult<()> {
        use response_types::*;

        if let Ok(error) = serde_json::from_str::<ChatCompletionChunkErrorResponse>(data) {
            return Err(BackendError::LLMClientError {
                r#type: error.error.r#type,
                message: error.error.message,
            });
        }

        Ok(())
    }

    fn parse_response_chunk(&self, data: &str, delta: bool) -> BackendResult<Option<String>> {
        self.parse_potential_error(data)?;

        use response_types::*;
        match self {
            Self::OpenAI | Self::Google | Self::Custom(_) => {
                let resp = serde_json::from_str::<openai::ChatCompletionChunkResponse>(data)
                    .map_err(|e| {
                        BackendError::GenericError(format!("failed to parse openai response: {e}"))
                    })?;

                Ok(resp.choices.first().and_then(|choice| {
                    if delta {
                        choice.delta.clone().and_then(|d| d.content)
                    } else {
                        choice.message.clone().map(|m| m.content)
                    }
                }))
            }
            Self::Anthropic => serde_json::from_str::<anthropic::ChunkResponse>(data)
                .map_err(|e| {
                    BackendError::GenericError(format!("failed to parse anthropic response: {e}"))
                })
                .map(|chunk| chunk.delta.and_then(|d| d.text)),
        }
    }

    fn parse_response(&self, data: &str) -> BackendResult<Option<String>> {
        self.parse_potential_error(data)?;

        use response_types::*;
        match self {
            Self::OpenAI | Self::Google | Self::Custom(_) => self.parse_response_chunk(data, false),
            Self::Anthropic => {
                match serde_json::from_str::<anthropic::Response>(data).map_err(|e| {
                    BackendError::GenericError(format!("failed to parse anthropic response: {e}"))
                })? {
                    anthropic::Response::Error(err) => Err(BackendError::GenericError(format!(
                        "error response from anthropic: {err:?}"
                    ))),
                    anthropic::Response::Message(message) => {
                        message.content.first().map(|c| Some(c.text.clone())).ok_or(
                            BackendError::GenericError(
                                "no content found in anthropic response".to_owned(),
                            ),
                        )
                    }
                }
            }
        }
    }
}

impl Model {
    fn supports_images(&self) -> bool {
        match self {
            Self::Claude35Haiku => false,
            // TODO: *some* custom models will support image input
            // make this configurable from the frontend
            Self::Custom { vision, .. } => *vision,
            _ => true,
        }
    }

    fn as_str(&self) -> String {
        match self {
            Self::GPT5 => "gpt-5",
            Self::GPT5_Mini => "gpt-5-mini",
            Self::GPT4_1 => "gpt-4.1",
            Self::GPT4_1Mini => "gpt-4.1-mini",
            Self::GPT4o => "gpt-4o",
            Self::GPT4oMini => "gpt-4o-mini",
            Self::O3Mini => "o3-mini",
            Self::Claude45Sonnet => "claude-sonnet-4-5-20250929",
            Self::Claude4Sonnet => "claude-sonnet-4-20250514",
            Self::Claude37Sonnet => "claude-3-7-sonnet-latest",
            Self::Claude35Sonnet => "claude-3-5-sonnet-latest",
            Self::Claude35Haiku => "claude-3-5-haiku-latest",
            Self::Gemini20Flash => "gemini-2.0-flash",
            Self::Custom { name, .. } => name,
        }
        .to_string()
    }

    fn provider(&self) -> &Provider {
        match self {
            Self::GPT5
            | Self::GPT5_Mini
            | Self::GPT4_1
            | Self::GPT4_1Mini
            | Self::GPT4o
            | Self::GPT4oMini
            | Self::O3Mini => &Provider::OpenAI,
            Self::Claude45Sonnet
            | Self::Claude4Sonnet
            | Self::Claude37Sonnet
            | Self::Claude35Sonnet
            | Self::Claude35Haiku => &Provider::Anthropic,
            Self::Gemini20Flash => &Provider::Google,
            Self::Custom { provider, .. } => provider,
        }
    }
}

impl TokenModel for Model {
    fn max_tokens(&self) -> usize {
        match self {
            // NOTE: actual is 1M for gpt4.1
            Self::GPT5 | Self::GPT5_Mini => 900_000,
            Self::GPT4_1 => 900_000,
            Self::GPT4_1Mini => 900_000,
            Self::GPT4o => 128_000,
            Self::GPT4oMini => 128_000,
            Self::O3Mini => 128_000,
            // TODO: verify if 200k tokens is correct for Claude models
            Self::Claude45Sonnet
            | Self::Claude4Sonnet
            | Self::Claude37Sonnet
            | Self::Claude35Sonnet
            | Self::Claude35Haiku => 200_000,
            // NOTE: actual is 1M for gemini-2.0-flash
            Self::Gemini20Flash => 900_000,
            Self::Custom { max_tokens, .. } => *max_tokens,
        }
    }
}

impl Iterator for ChatCompletionStream {
    type Item = BackendResult<String>;

    fn next(&mut self) -> Option<Self::Item> {
        self.buffer.clear();

        match self.reader.read_line(&mut self.buffer) {
            Ok(0) => None,
            Ok(_) => {
                self.buffer = self.buffer.trim().to_string();
                if self.buffer.is_empty() {
                    return self.next();
                }

                let data = match self.buffer.strip_prefix("data: ") {
                    None => return self.next(),
                    Some("[DONE]") => return None,
                    Some(data) => data,
                };

                match self.provider.parse_response_chunk(data, true).transpose() {
                    Some(Ok(content)) => {
                        self.wait_for_next_update();
                        Some(Ok(content))
                    }
                    Some(Err(e)) => Some(Err(e)),
                    None => self.next(),
                }
            }
            Err(e) => Some(Err(BackendError::GenericError(e.to_string()))),
        }
    }
}

impl LLMClient {
    pub fn new() -> BackendResult<Self> {
        Ok(Self {
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()?,
        })
    }

    #[tracing::instrument(level = "trace", skip(self, messages, response_format))]
    pub fn create_chat_completion(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<String>,
        response_format: Option<serde_json::Value>,
    ) -> BackendResult<String> {
        let provider = model.provider();
        let response = self.send_completion_request(
            messages,
            model,
            custom_key,
            response_format.as_ref(),
            false,
        )?;

        self.handle_completion_response(response, provider, response_format.is_some())
    }

    #[tracing::instrument(level = "trace", skip(self, messages, response_format))]
    pub fn create_streaming_chat_completion(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<String>,
        response_format: Option<serde_json::Value>,
    ) -> BackendResult<ChatCompletionStream> {
        let response = self.send_completion_request(
            messages,
            model,
            custom_key,
            response_format.as_ref(),
            true,
        )?;

        self.handle_streaming_response(response, model.provider())
    }

    fn send_completion_request(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<String>,
        response_format: Option<&serde_json::Value>,
        stream: bool,
    ) -> BackendResult<Response> {
        let messages = truncate_messages(filter_unsupported_content(messages, model), model);
        let provider = model.provider();
        let (url, headers) = provider.get_request_params(custom_key)?;
        let body = provider.prepare_completion_request(
            &model.as_str(),
            stream,
            8192,
            &messages,
            response_format,
        )?;

        let mut builder = self.client.post(&url);
        for (name, value) in headers.iter() {
            if let Ok(header_name) = header::HeaderName::from_bytes(name.as_bytes()) {
                if let Ok(header_value) = header::HeaderValue::from_str(value) {
                    builder = builder.header(header_name, header_value);
                }
            }
        }

        let response = builder.body(body).send()?;
        tracing::debug!(
            "completion request - url: {:?}, stream: {}, status: {:?}, model: {:?}",
            url,
            stream,
            response.status(),
            model,
        );

        if let Err(err) = response.error_for_status_ref() {
            if let Some(status) = err.status() {
                if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    return Err(BackendError::LLMClientErrorTooManyRequests);
                }
                // TODO: are there other cases of bad request
                if status == reqwest::StatusCode::BAD_REQUEST {
                    return Err(BackendError::LLMClientErrorBadRequest(response.text()?));
                }
                if status == reqwest::StatusCode::UNAUTHORIZED {
                    return Err(BackendError::LLMClientErrorUnauthorized);
                }
                if status.is_client_error() {
                    let error_text = response.text()?;
                    model.provider().parse_potential_error(&error_text)?;
                }
            }
            return Err(BackendError::ReqwestError(err));
        }

        Ok(response)
    }

    fn handle_completion_response(
        &self,
        response: Response,
        provider: &Provider,
        has_response_format: bool,
    ) -> BackendResult<String> {
        let resp = provider
            .parse_response(&response.text()?)
            .map(|m| m.unwrap_or_default());

        match provider {
            Provider::Anthropic | Provider::Custom(_) if has_response_format => {
                resp.map(|r| format!("{{{r}"))
            }
            _ => resp,
        }
    }

    fn handle_streaming_response(
        &self,
        response: Response,
        provider: &Provider,
    ) -> BackendResult<ChatCompletionStream> {
        Ok(ChatCompletionStream::new(
            BufReader::new(response),
            provider.clone(),
            120,
        ))
    }
}
