use crate::{llm::models::Message, BackendResult, BackendError};

use bytes::Bytes;
use futures::Stream;
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::task::{Context, Poll};

pub struct OpenAI {
    pub model: String,
    pub api_base_url: String,
    async_client: reqwest::Client,
    client: reqwest::blocking::Client,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionChoiceDelta {
    content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionChoice {
    message: Option<Message>,
    index: u32,
    delta: Option<ChatCompletionChoiceDelta>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionChunkResponse {
    choices: Vec<ChatCompletionChoice>
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionError {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
    code: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatCompletionChunkErrorResponse {
    error: ChatCompletionError,
}

fn parse_response(data: Vec<u8>) -> BackendResult<String> {
    match String::from_utf8(data) {
        Ok(d) => {
            let response = serde_json::from_str::<ChatCompletionChunkResponse>(&d)
                .map_err(|e| BackendError::GenericError(e.to_string()))?;
            if response.choices.len() == 0 {
                return Err(BackendError::OpenAIError("No choices in response".to_string()));
            }
            if let Some(message) = response.choices[0].message.as_ref() {
                return Ok(message.content.clone());
            }
            Err(BackendError::OpenAIError("No content in response".to_string()))
        },
        Err(e) => Err(BackendError::GenericError(e.to_string())),
    }
}

fn parse_chunk_data(data: Vec<u8>) -> BackendResult<String> {
    let data = match String::from_utf8(data) {
        Ok(d) => d,
        Err(e) => return Err(BackendError::GenericError(e.to_string())),
    };
    let mut result = String::new();
    for line in data.split("\n\n") {
        let clean = line.strip_prefix("data: ").unwrap_or(&line);
        if clean == "" || clean == "[DONE]"{
            continue;
        }
        match serde_json::from_str::<ChatCompletionChunkResponse>(clean) {
            Ok(response) => {
                if response.choices.len() == 0 {
                    continue;
                }
                if let Some(delta) = response.choices[0].delta.as_ref() {
                    if let Some(c) = delta.content.as_ref() {
                        result.push_str(c);
                    }
                }
            },
            Err(e) => return Err(BackendError::GenericError(e.to_string())),
        }
    }
    Ok(result)
}

fn parse_error(response: String) -> BackendError {
    match serde_json::from_str::<ChatCompletionChunkErrorResponse>(&response) {
        Ok(response) => {
            match response.error.error_type.as_str() {
                "invalid_request_error" => {
                    if response.error.message.contains("string too long") {
                        return BackendError::OpenAIError("Content is too long".to_string());
                    }
                    BackendError::OpenAIError(response.error.message)
                }
                "tokens_exceeded_error" => BackendError::OpenAIError("Content is too long".to_string()),
                _ => BackendError::OpenAIError(response.error.message),
            }
        }
        Err(e) => BackendError::GenericError(format!("OpenAI client: failed to parse error response: {}", e.to_string())),
    }
}

struct DelimitedStream {
    response: Pin<Box<dyn Stream<Item = Result<Bytes, reqwest::Error>> + Send>>,
    delimiter: Vec<u8>,
    buffer: Vec<u8>,
}

impl DelimitedStream {
    fn new(response: reqwest::Response, delimiter: &str) -> Self {
        DelimitedStream {
            response: Box::pin(response.bytes_stream()),
            delimiter: delimiter.as_bytes().to_vec(),
            buffer: Vec::new(),
        }
    }
}

impl Stream for DelimitedStream {
    type Item = BackendResult<String>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        loop {
            let n = self.delimiter.len();
            if let Some(pos) = self.buffer.windows(n).position(|window| window == self.delimiter.as_slice()) {
                let chunk = self.buffer.drain(..pos + n).collect::<Vec<u8>>();
                return Poll::Ready(Some(Ok(parse_chunk_data(chunk)?)));
            }

            match self.response.as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(chunk))) => {
                    self.buffer.extend_from_slice(&chunk);
                }
                Poll::Ready(Some(Err(e))) => return Poll::Ready(Some(Err(BackendError::ReqwestError(e)))),
                Poll::Ready(None) => {
                    if !self.buffer.is_empty() {
                        let remaining = std::mem::take(&mut self.buffer);
                        return Poll::Ready(Some(Ok(parse_chunk_data(remaining)?)));
                    }
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}


impl OpenAI {
    pub fn new(
        model: String,
        api_key: String,
        api_base_url: Option<String>,
    ) -> BackendResult<Self> {
        let api_base_url = api_base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string());

        let mut default_headers = header::HeaderMap::new();
        default_headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/json"));

        let auth_header = header::HeaderValue::from_str(format!("Bearer {}", api_key).as_str());
        match auth_header {
            Ok(h) => {
                default_headers.insert(header::AUTHORIZATION, h);
            },
            Err(_) => {}
        };

        let request_timeout = std::time::Duration::from_secs(300); // 5 minutes

        Ok(Self {
            model,
            api_base_url,
            client: reqwest::blocking::Client::builder()
                .default_headers(default_headers.clone())
                .timeout(request_timeout.clone())
                .build()?,
            async_client: Client::builder()
                .default_headers(default_headers)
                .timeout(request_timeout)
                .build()?,
        })
    }

    pub fn create_chat_completion_blocking(
        &self,
        messages: Vec<Message>,
        model: Option<String>,
    ) -> BackendResult<String> {
        let url = format!("{}/chat/completions", self.api_base_url);
        let model = model.unwrap_or_else(|| self.model.clone());
        let request = ChatCompletionRequest {
            model,
            messages,
            stream: false,
        };
        let response = self.client.post(url).json(&request).send()?;
        match response.error_for_status_ref() {
            Ok(_) => {
                let body = response.text()?;
                Ok(parse_response(body.as_bytes().to_vec())?)
            },
            Err(_) => {
                let body = response.text()?;
                Err(parse_error(body))
            }
        }
    }

    pub async fn create_chat_completion(
    &self, 
    messages: Vec<Message>,
    ) -> BackendResult<Pin<Box<dyn Stream<Item = BackendResult<String>>>>> {
        let url = format!("{}/chat/completions", self.api_base_url); 
        let request = ChatCompletionRequest {
            model: self.model.clone(),
            messages,
            stream: true,
        };
        let response = self.async_client.post(url).json(&request).send().await?;
        match response.error_for_status_ref() {
            Ok(_) => {},
            Err(_) => return Err(parse_error(response.text().await?)), 
        }
        let stream = DelimitedStream::new(response, "\n\n");
        Ok(Box::pin(stream))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::StreamExt;
    use tokio::runtime::Runtime;

    #[test]
    fn test_sanity_create_chat_completion() -> Result<(), Box<dyn std::error::Error>> {
        let api_key = std::env::var("TEST_OPENAI_API_KEY").map_err(|_| "TEST_OPENAI_API_KEY not set")?;
        let openai = OpenAI::new("gpt-4o-mini".to_string(), api_key, None)?;

        let messages = vec![
            Message {
                role: "user".to_string(),
                content: "What is 42".to_string(),
            },
        ];
        let runtime = Runtime::new()?;
        let mut result = String::new();
        runtime.block_on(async {
            let mut stream = openai.create_chat_completion(messages).await?;
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
        Ok(())
    }
}
