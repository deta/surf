use crate::{
    ai::{llm::models::Message, DocsSimilarity},
    BackendError, BackendResult,
};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
use std::pin::Pin;
use std::task::{Context, Poll};
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

pub struct LocalAIClient {
    socket_path: String,
}

pub struct LocalAIStream {
    stream: Pin<Box<UnixStream>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarityRequest {
    pub query: String,
    pub docs: Vec<String>,
    pub threshold: f32,
    pub num_docs: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilteredSearchRequest {
    pub query: String,
    pub num_docs: usize,
    pub keys: Vec<u64>,
    pub threshold: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpsertEmbeddingsRequest {
    pub old_keys: Vec<i64>,
    pub new_keys: Vec<i64>,
    pub chunks: Vec<String>,
}

#[allow(dead_code)]
impl LocalAIStream {
    pub fn new(stream: UnixStream) -> Self {
        Self {
            stream: Box::pin(stream),
        }
    }
}

impl Stream for LocalAIStream {
    type Item = BackendResult<String>;

    fn poll_next(mut self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Option<Self::Item>> {
        let mut buffer = [0; 1024];
        let bytes_read = self
            .stream
            .read(&mut buffer[..])
            .expect("failed to read from client");
        if bytes_read == 0 {
            return Poll::Ready(None);
        }
        let message = String::from_utf8_lossy(&buffer[..bytes_read]);
        Poll::Ready(Some(Ok(message.to_string())))
    }
}

impl LocalAIClient {
    pub fn new(socket_path: String) -> Self {
        Self { socket_path }
    }

    fn read_message(stream: &mut UnixStream) -> BackendResult<String> {
        let mut buffer = [0; 1024];
        let bytes_read = stream.read(&mut buffer[..]).map_err(|e| {
            BackendError::GenericError(format!("failed to read from client: {:#?}", e))
        })?;
        if bytes_read == 0 {
            return Err(BackendError::GenericError("no bytes read".to_string()));
        }
        let message = String::from_utf8_lossy(&buffer[..bytes_read]);
        Ok(message.to_string())
    }

    fn is_ack_message(message: &str) -> bool {
        message.trim() == "[ack]"
    }

    #[allow(dead_code)]
    fn try_stream_shutdown(stream: &mut UnixStream) -> BackendResult<()> {
        match stream.shutdown(std::net::Shutdown::Both) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("failed to shutdown stream: {:#?}", e);
            }
        }
        Ok(())
    }

    fn send_message(stream: &mut UnixStream, message: &str) -> BackendResult<()> {
        match stream.write_all(message.as_bytes()) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("failed to write message: {:#?}", e);
                return Err(BackendError::GenericError(format!(
                    "failed to write message: {:#?}",
                    e
                )));
            }
        }
        Ok(())
    }

    fn send_message_bytes(stream: &mut UnixStream, message: &[u8]) -> BackendResult<()> {
        match stream.write_all(message) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("failed to write message bytes: {:#?}", e);
                return Err(BackendError::GenericError(format!(
                    "failed to write message bytes: {:#?}",
                    e
                )));
            }
        }
        Ok(())
    }

    fn send_done(stream: &mut UnixStream) -> BackendResult<()> {
        stream.write_all("[done]\n".as_bytes())?;
        Ok(stream.flush()?)
    }

    fn is_done(message: &str) -> (bool, String) {
        let message = message.trim();
        let done = message.ends_with("[done]");
        if done {
            let stripped = message.strip_suffix("[done]").unwrap();
            return (done, stripped.to_string());
        }
        (done, message.to_string())
    }

    fn is_error(message: &str) -> (bool, String) {
        (message.contains("error:"), message.to_string())
    }

    fn send_api_request_preamble(stream: &mut UnixStream, api_request: &str) -> BackendResult<()> {
        Self::send_message(stream, api_request)?;
        let response = Self::read_message(stream)?;
        if !Self::is_ack_message(&response) {
            eprintln!("server returned no ack, response: {:#?}", response);
            return Err(BackendError::GenericError(
                "server returned no ack".to_string(),
            ));
        }
        Ok(())
    }

    pub fn get_docs_similarity(
        &self,
        req: DocsSimilarityRequest,
    ) -> BackendResult<Vec<DocsSimilarity>> {
        let message = serde_json::to_string(&req).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize request: {:#?}", e))
        })?;

        let mut stream = UnixStream::connect(&self.socket_path)?;

        Self::send_api_request_preamble(&mut stream, "get_docs_similarity")?;
        Self::send_message(&mut stream, &message)?;
        Self::send_done(&mut stream)?;
        let mut server_message_buffer = String::new();
        loop {
            let message = Self::read_message(&mut stream)?;
            let (is_err, message) = Self::is_error(&message);
            if is_err {
                eprintln!("failed to get docs similarity: {:#?}", message);
                return Err(BackendError::GenericError(format!(
                    "failed to get docs similarity: {:#?}",
                    message
                )));
            }
            let (is_done, message) = Self::is_done(&message);
            server_message_buffer.push_str(&message);
            if is_done {
                break;
            }
        }
        let docs_similarity = serde_json::from_str::<Vec<DocsSimilarity>>(&server_message_buffer)
            .map_err(|e| {
            BackendError::GenericError(format!("failed to parse response: {:#?}", e))
        })?;
        Ok(docs_similarity)
    }

    pub fn encode_sentences(&self, sentences: &Vec<String>) -> BackendResult<Vec<Vec<f32>>> {
        let message = serde_json::to_vec(sentences).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize sentences: {:#?}", e))
        })?;

        let mut stream = UnixStream::connect(&self.socket_path)?;

        Self::send_api_request_preamble(&mut stream, "encode_sentences")?;
        Self::send_message_bytes(&mut stream, &message)?;
        Self::send_done(&mut stream)?;
        let mut server_message_buffer = String::new();
        loop {
            let message = Self::read_message(&mut stream)?;
            let (is_err, message) = Self::is_error(&message);
            if is_err {
                eprintln!("failed to encode sentences: {:#?}", message);
                return Err(BackendError::GenericError(format!(
                    "failed to encode sentences: {:#?}",
                    message
                )));
            }
            let (is_done, message) = Self::is_done(&message);
            server_message_buffer.push_str(&message);
            if is_done {
                break;
            }
        }
        let embeddings =
            serde_json::from_str::<Vec<Vec<f32>>>(&server_message_buffer).map_err(|e| {
                BackendError::GenericError(format!("failed to parse response: {:#?}", e))
            })?;
        Ok(embeddings)
    }

    pub fn filtered_search(&self, req: FilteredSearchRequest) -> BackendResult<Vec<i64>> {
        let message = serde_json::to_string(&req).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize request: {:#?}", e))
        })?;

        let mut stream = UnixStream::connect(&self.socket_path)?;

        Self::send_api_request_preamble(&mut stream, "filtered_search")?;
        Self::send_message(&mut stream, &message)?;
        Self::send_done(&mut stream)?;
        let mut server_message_buffer = String::new();
        loop {
            let message = Self::read_message(&mut stream)?;
            let (is_err, message) = Self::is_error(&message);
            if is_err {
                eprintln!("failed to do filtered search: {:#?}", message);
                return Err(BackendError::GenericError(format!(
                    "failed to do filtered search: {:#?}",
                    message
                )));
            }
            let (is_done, message) = Self::is_done(&message);
            server_message_buffer.push_str(&message);
            if is_done {
                break;
            }
        }
        let results = serde_json::from_str::<Vec<i64>>(&server_message_buffer).map_err(|e| {
            BackendError::GenericError(format!("failed to parse response: {:#?}", e))
        })?;
        Ok(results)
    }

    pub fn upsert_embeddings(&self, req: UpsertEmbeddingsRequest) -> BackendResult<()> {
        let message = serde_json::to_string(&req).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize request: {:#?}", e))
        })?;

        let mut stream = UnixStream::connect(&self.socket_path)?;

        Self::send_api_request_preamble(&mut stream, "upsert_embeddings")?;
        Self::send_message(&mut stream, &message)?;
        Self::send_done(&mut stream)?;
        let mut server_message_buffer = String::new();
        loop {
            let message = Self::read_message(&mut stream)?;
            let (is_err, message) = Self::is_error(&message);
            if is_err {
                eprintln!("failed to upsert embeddings: {:#?}", message);
                return Err(BackendError::GenericError(format!(
                    "failed to upsert embeddings: {:#?}",
                    message
                )));
            }
            let (is_done, message) = Self::is_done(&message);
            server_message_buffer.push_str(&message);
            if is_done {
                break;
            }
        }
        if server_message_buffer != "ok" {
            return Err(BackendError::GenericError(format!(
                "failed to upsert embeddings: {:#?}",
                server_message_buffer
            )));
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn create_chat_completion(
        &self,
        messages: Vec<Message>,
    ) -> BackendResult<Pin<Box<dyn Stream<Item = BackendResult<String>>>>> {
        let message = serde_json::to_string(&messages).map_err(|e| {
            BackendError::GenericError(format!("failed to serialize messages: {:#?}", e))
        })?;
        let mut stream = UnixStream::connect(&self.socket_path)?;

        Self::send_api_request_preamble(&mut stream, "get_docs_similarity")?;
        Self::send_message(&mut stream, &message)?;
        Self::send_done(&mut stream)?;
        Ok(Box::pin(LocalAIStream::new(stream)))
    }
}
