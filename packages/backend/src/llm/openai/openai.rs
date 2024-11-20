use crate::{
    llm::models::Message,
    BackendError, BackendResult,
};
use futures::Stream;
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use std::pin::Pin;

use super::response::{parse_error, parse_response, DelimitedStream};

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

impl OpenAI {
    pub fn new(
        model: String,
        api_key: String,
        api_base_url: Option<String>,
    ) -> BackendResult<Self> {
        let api_base_url = api_base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string());

        let mut default_headers = header::HeaderMap::new();
        default_headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        let auth_header = header::HeaderValue::from_str(format!("Bearer {}", api_key).as_str());
        match auth_header {
            Ok(h) => {
                default_headers.insert(header::AUTHORIZATION, h);
            }
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
        let body = serde_json::to_string(&request).map_err(|e| {
            BackendError::GenericError(format!("OpenAI client: failed to serialize request: {}", e))
        })?;
        let response = self.client.post(url).body(body).send()?;
        match response.error_for_status_ref() {
            Ok(_) => {
                let body = response.text()?;
                Ok(parse_response(body.as_bytes().to_vec())?)
            }
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
        let body = serde_json::to_string(&request).map_err(|e| {
            BackendError::GenericError(format!("OpenAI client: failed to serialize request: {}", e))
        })?;
        let response = self.async_client.post(url).body(body).send().await?;
        match response.error_for_status_ref() {
            Ok(_) => {}
            Err(_) => return Err(parse_error(response.text().await?)),
        }
        let stream = DelimitedStream::new(response, "\n\n");
        Ok(Box::pin(stream))
    }
}

#[cfg(test)]
mod tests {
    use crate::llm::models::MessageContent;
    use super::*;
    use futures::StreamExt;
    use tokio::runtime::Runtime;

    #[test]
    fn test_sanity_create_chat_completion() -> Result<(), Box<dyn std::error::Error>> {
        let api_key =
            std::env::var("TEST_OPENAI_API_KEY").map_err(|_| "TEST_OPENAI_API_KEY not set")?;
        let openai = OpenAI::new("gpt-4o-mini".to_string(), api_key, None)?;

        let messages = vec![Message {
            role: "user".to_string(),
            content: vec![MessageContent::new_text("Hello!".to_string())],
        }];
        let runtime = Runtime::new()?;
        let mut result = String::new();
        runtime.block_on(async {
            let mut stream = openai.create_chat_completion(messages).await?;
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(chunk) => {
                        result.push_str(&chunk);
                    }
                    Err(e) => return Err(e),
                }
            }
            Ok(())
        })?;
        Ok(())
    }
}
