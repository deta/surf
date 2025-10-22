mod embeddings;
mod requests;

use crate::embeddings::model::EmbeddingModel;
use crate::server::message::Message;
use crate::BackendResult;
use embeddings::{
    handle_encode_sentences, handle_filtered_search, handle_get_docs_similarity,
    handle_upsert_embeddings,
};
use requests::Requests;
use std::io::{Read, Write};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
use std::str::FromStr;
use std::sync::mpsc::Sender;
use tracing::{error, instrument, warn};
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

#[instrument(level = "trace", skip(stream))]
pub fn read_msg(mut stream: &UnixStream) -> BackendResult<(usize, String)> {
    let mut buffer = [0; 1024 * 16];
    let bytes_read = stream.read(&mut buffer[..])?;

    if bytes_read == 0 {
        return Ok((0, String::new()));
    }

    let message = String::from_utf8_lossy(&buffer[..bytes_read]);
    let message = message.trim();
    Ok((bytes_read, message.to_string()))
}

#[instrument(level = "trace", skip(stream))]
pub fn send_ack(stream: &UnixStream) {
    try_stream_write_all(stream, "[ack]\n");
}

#[instrument(level = "trace", skip(stream))]
pub fn send_done(stream: &UnixStream) {
    try_stream_write_all(stream, "[done]\n");
}

#[instrument(level = "trace", skip(message))]
pub fn is_done(message: &str) -> (bool, String) {
    let done = message.ends_with("[done]");
    if done {
        let stripped = message.strip_suffix("[done]").unwrap();
        return (done, stripped.to_string());
    }
    (done, message.to_string())
}

#[instrument(level = "trace", skip(stream, message), fields(message_len = message.len()))]
pub fn try_stream_write_all(mut stream: &UnixStream, message: &str) {
    if let Err(e) = stream.write_all(message.as_bytes()) {
        error!(?e, "failed to write to stream");
    }
    if let Err(e) = stream.flush() {
        error!(?e, "failed to flush stream");
    }
}

#[instrument(level = "trace", skip(stream, bytes), fields(bytes_len = bytes.len()))]
pub fn try_stream_write_all_bytes(mut stream: &UnixStream, bytes: &[u8]) {
    if let Err(e) = stream.write_all(bytes) {
        error!(?e, "failed to write bytes to stream");
    }
    if let Err(e) = stream.flush() {
        error!(?e, "failed to flush stream");
    }
}

#[instrument(level = "trace", skip(main_thread_tx, embedding_model, stream))]
pub fn handle_client(
    main_thread_tx: Sender<Message>,
    embedding_model: &EmbeddingModel,
    stream: UnixStream,
) -> BackendResult<()> {
    let mut client_message_buffer = String::new();

    let (bytes_read, api_request) = read_msg(&stream)?;
    let api_request = match Requests::from_str(&api_request) {
        Ok(request) => request,
        Err(e) => {
            error!(?e, "failed to parse API request");
            try_stream_write_all(
                &stream,
                format!("error: failed to parse api request: {}", e)
                    .to_string()
                    .as_str(),
            );
            return Ok(());
        }
    };
    send_ack(&stream);

    if bytes_read == 0 {
        return Ok(());
    }

    loop {
        let (bytes_read, message) = read_msg(&stream)?;
        if bytes_read == 0 {
            return Ok(());
        }
        let (is_done, message) = is_done(&message);
        client_message_buffer.push_str(&message);
        if is_done {
            break;
        }
    }

    match api_request {
        Requests::LLMChatCompletion => {
            warn!("local LLM request rejected - feature not enabled");
            try_stream_write_all(&stream, "error: local llm not enabled, api unsupported");
        }
        Requests::GetDocsSimilarity => {
            if let Err(e) = handle_get_docs_similarity(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                error!(?e, "get docs similarity request failed");
                try_stream_write_all(&stream, &format!("error: {:#?}", e));
            }
        }
        Requests::EncodeSentences => {
            if let Err(e) =
                handle_encode_sentences(&stream, embedding_model, &client_message_buffer)
            {
                error!(?e, "encode sentences request failed");
                try_stream_write_all(&stream, &format!("error: {:#?}", e));
            }
        }
        Requests::FilteredSearch => {
            if let Err(e) = handle_filtered_search(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                error!(?e, "filtered search request failed");
                try_stream_write_all(&stream, &format!("error: {:#?}", e));
            }
        }
        Requests::UpsertEmbeddings => {
            if let Err(e) = handle_upsert_embeddings(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                error!(?e, "upsert embeddings request failed");
                try_stream_write_all(&stream, &format!("error: {:#?}", e));
            }
        }
    }
    Ok(())
}
