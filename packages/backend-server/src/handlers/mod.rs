pub mod embeddings;
pub mod requests;

use crate::embeddings::model::EmbeddingModel;
use crate::handlers::embeddings::{
    handle_encode_sentences, handle_filtered_search, handle_get_docs_similarity,
    handle_upsert_embeddings,
};
use crate::handlers::requests::Requests;
use crate::server::message::Message;
use crate::BackendResult;
use std::io::{Read, Write};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
use std::str::FromStr;
use std::sync::mpsc::Sender;
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

// TODO: better logging, especially for errors

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

pub fn send_ack(stream: &UnixStream) {
    try_stream_write_all(stream, "[ack]\n");
}

pub fn send_done(stream: &UnixStream) {
    try_stream_write_all(stream, "[done]\n");
}

pub fn is_done(message: &str) -> (bool, String) {
    let done = message.ends_with("[done]");
    if done {
        let stripped = message.strip_suffix("[done]").unwrap();
        return (done, stripped.to_string());
    }
    (done, message.to_string())
}

pub fn try_stream_write_all(mut stream: &UnixStream, message: &str) {
    match stream.write_all(message.as_bytes()) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("[LocalAIServer] failed to write to stream: {:#?}", e);
        }
    }
    match stream.flush() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("[LocalAIServer] failed to flush stream: {:#?}", e);
        }
    }
}

pub fn try_stream_write_all_bytes(mut stream: &UnixStream, bytes: &[u8]) {
    match stream.write_all(bytes) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("[LocalAIServer] failed to write to stream: {:#?}", e);
        }
    }
    match stream.flush() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("[LocalAIServer] failed to flush stream: {:#?}", e);
        }
    }
}

// TODO: better error handling and saner protocol
pub fn handle_client(
    main_thread_tx: Sender<Message>,
    embedding_model: &EmbeddingModel,
    mut stream: UnixStream,
) -> BackendResult<()> {
    let mut client_message_buffer = String::new();
    let (bytes_read, api_request) = read_msg(&stream)?;
    let api_request = match Requests::from_str(&api_request) {
        Ok(request) => request,
        Err(e) => {
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
            println!(
                "[LocalAIServer] received message with len: {:#?}",
                message.len()
            );
            break;
        }
    }
    match api_request {
        Requests::LLMChatCompletion => {
            try_stream_write_all(&mut stream, "error: local llm not enabled, api unsupported");
        }
        Requests::GetDocsSimilarity => {
            match handle_get_docs_similarity(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                Ok(_) => {}
                Err(e) => {
                    try_stream_write_all(&stream, &format!("error: {:#?}", e));
                }
            }
        }
        Requests::EncodeSentences => {
            match handle_encode_sentences(&stream, embedding_model, &client_message_buffer) {
                Ok(_) => {}
                Err(e) => {
                    try_stream_write_all(&stream, &format!("error: {:#?}", e));
                }
            }
        }
        Requests::FilteredSearch => {
            match handle_filtered_search(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                Ok(_) => {}
                Err(e) => {
                    try_stream_write_all(&mut stream, &format!("error: {:#?}", e));
                }
            }
        }
        Requests::UpsertEmbeddings => {
            match handle_upsert_embeddings(
                main_thread_tx,
                &stream,
                embedding_model,
                &client_message_buffer,
            ) {
                Ok(_) => {}
                Err(e) => {
                    try_stream_write_all(&mut stream, &format!("error: {:#?}", e));
                }
            }
        }
    }
    Ok(())
}
