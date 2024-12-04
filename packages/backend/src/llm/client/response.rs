// use crate::{llm::models::ChatCompletionMessage, BackendError, BackendResult};
// use bytes::Bytes;
// use futures::Stream;
// use reqwest;
// use serde::{Deserialize, Serialize};
// use std::pin::Pin;
// use std::task::{Context, Poll};

// #[derive(Debug, Serialize, Deserialize)]
// pub(crate) struct ChatCompletionChoiceDelta {
//     pub content: Option<String>,
// }

// #[derive(Debug, Serialize, Deserialize)]
// pub(crate) struct ChatCompletionChoice {
//     pub message: Option<ChatCompletionMessage>,
//     pub index: u32,
//     pub delta: Option<ChatCompletionChoiceDelta>,
// }

// #[derive(Debug, Serialize, Deserialize)]
// pub(crate) struct ChatCompletionChunkResponse {
//     pub choices: Vec<ChatCompletionChoice>,
// }

// #[derive(Debug, Serialize, Deserialize)]
// struct ChatCompletionError {
//     message: String,
//     #[serde(rename = "type")]
//     error_type: String,
//     code: Option<String>,
// }

// #[derive(Debug, Serialize, Deserialize)]
// struct ChatCompletionChunkErrorResponse {
//     error: ChatCompletionError,
// }

// pub(crate) struct DelimitedStream {
//     response: Pin<Box<dyn Stream<Item = Result<Bytes, reqwest::Error>> + Send>>,
//     delimiter: Vec<u8>,
//     buffer: Vec<u8>,
// }

// #[allow(dead_code)]
// impl DelimitedStream {
//     pub fn new(response: reqwest::Response, delimiter: &str) -> Self {
//         DelimitedStream {
//             response: Box::pin(response.bytes_stream()),
//             delimiter: delimiter.as_bytes().to_vec(),
//             buffer: Vec::new(),
//         }
//     }
// }

// impl Stream for DelimitedStream {
//     type Item = BackendResult<String>;

//     fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
//         loop {
//             let n = self.delimiter.len();
//             if let Some(pos) = self
//                 .buffer
//                 .windows(n)
//                 .position(|window| window == self.delimiter.as_slice())
//             {
//                 let chunk = self.buffer.drain(..pos + n).collect::<Vec<u8>>();
//                 return Poll::Ready(Some(Ok(parse_chunk_data(chunk)?)));
//             }

//             match self.response.as_mut().poll_next(cx) {
//                 Poll::Ready(Some(Ok(chunk))) => {
//                     self.buffer.extend_from_slice(&chunk);
//                 }
//                 Poll::Ready(Some(Err(e))) => {
//                     return Poll::Ready(Some(Err(BackendError::ReqwestError(e))))
//                 }
//                 Poll::Ready(None) => {
//                     if !self.buffer.is_empty() {
//                         let remaining = std::mem::take(&mut self.buffer);
//                         return Poll::Ready(Some(Ok(parse_chunk_data(remaining)?)));
//                     }
//                     return Poll::Ready(None);
//                 }
//                 Poll::Pending => return Poll::Pending,
//             }
//         }
//     }
// }

// pub(crate) fn parse_chunk_data(data: Vec<u8>) -> BackendResult<String> {
//     let data = match String::from_utf8(data) {
//         Ok(d) => d,
//         Err(e) => return Err(BackendError::GenericError(e.to_string())),
//     };
//     let mut result = String::new();
//     for line in data.split("\n\n") {
//         let clean = line.strip_prefix("data: ").unwrap_or(&line);
//         if clean == "" || clean == "[DONE]" {
//             continue;
//         }
//         match serde_json::from_str::<ChatCompletionChunkResponse>(clean) {
//             Ok(response) => {
//                 if response.choices.len() == 0 {
//                     continue;
//                 }
//                 if let Some(delta) = response.choices[0].delta.as_ref() {
//                     if let Some(c) = delta.content.as_ref() {
//                         result.push_str(c);
//                     }
//                 }
//             }
//             Err(e) => return Err(BackendError::GenericError(e.to_string())),
//         }
//     }
//     Ok(result)
// }

// pub(crate) fn parse_error(response: String) -> BackendError {
//     match serde_json::from_str::<ChatCompletionChunkErrorResponse>(&response) {
//         Ok(response) => match response.error.error_type.as_str() {
//             "invalid_request_error" => {
//                 if response.error.message.contains("string too long") {
//                     return BackendError::LLMClientError("Content is too long".to_string());
//                 }
//                 BackendError::LLMClientError(response.error.message)
//             }
//             "tokens_exceeded_error" => {
//                 BackendError::LLMClientError("Content is too long".to_string())
//             }
//             _ => BackendError::LLMClientError(response.error.message),
//         },
//         Err(e) => BackendError::GenericError(format!(
//             "OpenAI client: failed to parse error response: {}",
//             e.to_string()
//         )),
//     }
// }
