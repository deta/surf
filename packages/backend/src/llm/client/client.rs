use reqwest::{blocking::Response, header};
use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader},
    time::{Duration, Instant},
};

use super::{models::TokenModel, tokens};
use crate::{
    ai::_AI_API_ENDPOINT,
    llm::models::{
        Message, MessageContent, MessageRole, Quota, QuotaResponse, QuotasDepletedResponse,
    },
    BackendError, BackendResult,
};

#[derive(Debug, Clone)]
pub struct ProxyConfig {
    pub api_base: String,
    pub api_key: String,
}

pub struct ChatCompletionStream {
    reader: BufReader<Response>,
    buffer: String,
    provider: Provider,
    last_update: Instant,
    update_interval: Duration,
}

pub struct LLMClient {
    client: reqwest::blocking::Client,
    proxy: ProxyConfig,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    OpenAI,
    Anthropic,
    Gemini,
    Custom(String),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Model {
    #[serde(rename = "gpt-4o")]
    GPT4o,
    #[serde(rename = "gpt-4o-mini")]
    GPT4oMini,

    #[serde(rename = "claude-3-5-sonnet-latest")]
    Claude35Sonnet,
    #[serde(rename = "claude-3-5-haiku-latest")]
    Claude35Haiku,

    #[serde(rename = "custom")]
    Custom {
        name: String,
        provider: Provider,
        max_tokens: usize,
        vision: bool,
    },
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
                msg.content = msg
                    .content
                    .into_iter()
                    .filter(|c| matches!(c, MessageContent::Text(_)))
                    .collect();
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
    fn get_completion_url(&self, base_url: Option<&str>) -> String {
        match self {
            Self::OpenAI => format!(
                "{}/v1/chat/completions",
                base_url.unwrap_or("https://api.openai.com"),
            ),
            Self::Gemini => format!(
                "{}/v1/chat/completions",
                base_url.unwrap_or("https://generativelanguage.googleapis.com/v1beta/openai"),
            ),
            Self::Anthropic => format!(
                "{}/v1/messages",
                base_url.unwrap_or("https://api.anthropic.com")
            ),
            Self::Custom(url) => format!("{url}/v1/chat/completions"),
        }
    }

    fn as_str(&self) -> &str {
        match self {
            Self::OpenAI => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
            Self::Custom(_) => "custom",
        }
    }

    fn get_headers(&self, api_key: Option<&str>) -> Vec<(String, String)> {
        let mut headers = vec![("Content-Type".to_string(), "application/json".to_string())];

        if let Some(api_key) = api_key {
            let auth = match self {
                Self::OpenAI | Self::Gemini | Self::Custom(_) => {
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
        proxy: &ProxyConfig,
        custom_key: Option<&str>,
    ) -> (String, Vec<(String, String)>) {
        let (completions_url, api_key) = match (self, custom_key) {
            (Self::Custom(_), api_key) => (self.get_completion_url(None), api_key),
            (_, Some(api_key)) => (self.get_completion_url(None), Some(api_key)),
            (_, None) => (
                self.get_completion_url(Some(
                    format!("{}/{}/{}", proxy.api_base, _AI_API_ENDPOINT, self.as_str()).as_str(),
                )),
                Some(proxy.api_key.as_str()),
            ),
        };

        (completions_url, self.get_headers(api_key))
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
            Self::OpenAI | Self::Gemini => {
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
        serde_json::to_string(&serde_json::json!({
            "model": model,
            "stream": stream,
            "messages": messages,
            "response_format": response_format
        }))
        .map_err(|err| {
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

        if let Ok(error) = serde_json::from_str::<QuotasDepletedResponse>(data) {
            return Err(BackendError::LLMClientErrorQuotasDepleted {
                quotas: serde_json::to_value(error).map_err(|e| {
                    BackendError::GenericError(format!("failed to serialize quotas: {e}"))
                })?,
            });
        }

        if let Ok(error) = serde_json::from_str::<ChatCompletionChunkErrorResponse>(data) {
            return Err(BackendError::LLMClientError {
                r#type: error.error.r#type,
                message: error.error.message,
            }
            .into());
        }

        Ok(())
    }

    fn parse_response_chunk(&self, data: &str, delta: bool) -> BackendResult<Option<String>> {
        self.parse_potential_error(data)?;

        use response_types::*;
        match self {
            Self::OpenAI | Self::Gemini | Self::Custom(_) => {
                let resp = serde_json::from_str::<openai::ChatCompletionChunkResponse>(data)
                    .map_err(|e| {
                        BackendError::GenericError(format!("failed to parse openai response: {e}"))
                    })?;

                Ok(resp
                    .choices
                    .get(0)
                    .map(|choice| {
                        if delta {
                            choice.delta.clone().map(|d| d.content).flatten()
                        } else {
                            choice.message.clone().map(|m| m.content)
                        }
                    })
                    .flatten())
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
            Self::OpenAI | Self::Gemini | Self::Custom(_) => self.parse_response_chunk(data, false),
            Self::Anthropic => {
                match serde_json::from_str::<anthropic::Response>(data).map_err(|e| {
                    BackendError::GenericError(format!("failed to parse anthropic response: {e}"))
                })? {
                    anthropic::Response::Error(err) => Err(BackendError::GenericError(format!(
                        "error response from anthropic: {err:?}"
                    ))),
                    anthropic::Response::Message(message) => {
                        message.content.get(0).map(|c| Some(c.text.clone())).ok_or(
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
            Self::GPT4o => "gpt-4o",
            Self::GPT4oMini => "gpt-4o-mini",
            Self::Claude35Sonnet => "claude-3-5-sonnet-latest",
            Self::Claude35Haiku => "claude-3-5-haiku-latest",
            Self::Custom { name, .. } => name,
        }
        .to_string()
    }

    fn provider(&self) -> &Provider {
        match self {
            Self::GPT4o | Self::GPT4oMini => &Provider::OpenAI,
            Self::Claude35Sonnet | Self::Claude35Haiku => &Provider::Anthropic,
            Self::Custom { provider, .. } => provider,
        }
    }
}

impl TokenModel for Model {
    fn max_tokens(&self) -> usize {
        match self {
            Self::GPT4o => 128_000,
            Self::GPT4oMini => 128_000,
            Self::Claude35Sonnet | Self::Claude35Haiku => 200_000,
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
    pub fn new(api_base: String, api_key: String) -> BackendResult<Self> {
        Ok(Self {
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()?,
            proxy: ProxyConfig { api_base, api_key },
        })
    }

    #[tracing::instrument(level = "trace", skip(self, messages, response_format))]
    pub fn create_chat_completion(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<&str>,
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
        custom_key: Option<&str>,
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

    // TODO: provider based quotas handling
    pub fn get_quotas(&self) -> BackendResult<Vec<Quota>> {
        let url = format!("{}/{}/quotas", self.proxy.api_base, _AI_API_ENDPOINT);
        let response = self
            .client
            .get(&url)
            .header("x-api-key", &self.proxy.api_key)
            .send()?;
        match response.error_for_status_ref() {
            Ok(_) => {
                let body = response.json::<QuotaResponse>()?;
                Ok(body.quotas)
            }
            Err(err) => Err(BackendError::ReqwestError(err)),
        }
    }

    fn send_completion_request(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<&str>,
        response_format: Option<&serde_json::Value>,
        stream: bool,
    ) -> BackendResult<Response> {
        let messages = truncate_messages(filter_unsupported_content(messages, model), model);
        let provider = model.provider();
        let (url, headers) = provider.get_request_params(&self.proxy, custom_key);
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
                if let Ok(header_value) = header::HeaderValue::from_str(&value) {
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
