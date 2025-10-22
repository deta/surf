use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
use std::sync::mpsc::{SendError, Sender};
use tracing::{error, instrument, warn};
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

use super::{try_stream_write_all, try_stream_write_all_bytes};
use crate::embeddings::model::EmbeddingModel;
use crate::server::message::Message;
use crate::BackendResult;

use super::send_done;

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsSimilarityRequest {
    query: String,
    docs: Vec<String>,
    threshold: f32,
    num_docs: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilteredSearchRequest {
    query: String,
    num_docs: usize,
    keys: Vec<u64>,
    threshold: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpsertEmbeddingsRequest {
    pub old_keys: Vec<i64>,
    pub new_keys: Vec<i64>,
    pub chunks: Vec<String>,
}

#[instrument(level = "trace", skip(main_thread_tx, stream, message))]
fn send_to_main_thread(
    main_thread_tx: &Sender<Message>,
    message: Message,
    stream: &UnixStream,
) -> Result<(), SendError<Message>> {
    match main_thread_tx.send(message) {
        Ok(_) => Ok(()),
        Err(e) => {
            error!(?e, "failed to send message to main thread");
            try_stream_write_all(stream, &format!("error: failed to send message: {:#?}", e));
            Err(e)
        }
    }
}

#[instrument(
    level = "trace",
    skip(main_thread_tx, stream, embedding_model, client_message)
)]
pub fn handle_get_docs_similarity(
    main_thread_tx: Sender<Message>,
    stream: &UnixStream,
    embedding_model: &EmbeddingModel,
    client_message: &str,
) -> BackendResult<()> {
    let request = serde_json::from_str::<DocsSimilarityRequest>(client_message)?;

    let query_embedding = embedding_model.encode_single(&request.query)?;
    let doc_embeddings = embedding_model.encode(&request.docs)?;

    let (response_tx, response_rx) = std::sync::mpsc::channel();
    send_to_main_thread(
        &main_thread_tx,
        Message::GetDocsSimilarity(
            response_tx,
            query_embedding,
            doc_embeddings,
            request.threshold,
            request.num_docs,
        ),
        stream,
    )?;

    let docs_similarity = match response_rx.recv()? {
        Ok(docs_similarity) => docs_similarity,
        Err(e) => {
            error!(?e, "error processing similarity request");
            return Err(e);
        }
    };

    let docs_similarity = serde_json::to_vec(&docs_similarity)?;
    try_stream_write_all_bytes(stream, &docs_similarity);
    send_done(stream);
    Ok(())
}

#[instrument(level = "trace", skip(stream, embedding_model, client_message))]
pub fn handle_encode_sentences(
    stream: &UnixStream,
    embedding_model: &EmbeddingModel,
    client_message: &str,
) -> BackendResult<()> {
    let sentences = serde_json::from_str::<Vec<String>>(client_message)?;
    let embeddings = embedding_model.encode(&sentences)?;
    let embeddings = serde_json::to_vec(&embeddings)?;

    try_stream_write_all_bytes(stream, &embeddings);
    send_done(stream);
    Ok(())
}

#[instrument(
    level = "trace",
    skip(main_thread_tx, stream, embedding_model, client_message)
)]
pub fn handle_filtered_search(
    main_thread_tx: Sender<Message>,
    stream: &UnixStream,
    embedding_model: &EmbeddingModel,
    client_message: &str,
) -> BackendResult<()> {
    let request = serde_json::from_str::<FilteredSearchRequest>(client_message)?;

    let query_embedding = embedding_model.encode_single(&request.query)?;
    let (response_tx, response_rx) = std::sync::mpsc::channel();

    send_to_main_thread(
        &main_thread_tx,
        Message::FilteredSearch(
            response_tx,
            query_embedding,
            request.num_docs,
            request.keys.to_vec(),
            request.threshold,
        ),
        stream,
    )?;

    let search_results = match response_rx.recv()? {
        Ok(search_results) => search_results,
        Err(e) => {
            error!(?e, "error processing search request");
            return Err(e);
        }
    };

    let search_results: Vec<i64> = search_results.iter().map(|id| *id as i64).collect();
    let search_results = serde_json::to_vec(&search_results)?;

    try_stream_write_all_bytes(stream, &search_results);
    send_done(stream);
    Ok(())
}

#[instrument(
    level = "trace",
    skip(main_thread_tx, stream, embedding_model, client_message)
)]
pub fn handle_upsert_embeddings(
    main_thread_tx: Sender<Message>,
    stream: &UnixStream,
    embedding_model: &EmbeddingModel,
    client_message: &str,
) -> BackendResult<()> {
    let request = serde_json::from_str::<UpsertEmbeddingsRequest>(client_message)?;

    let embeddings = embedding_model.encode(&request.chunks)?;
    let (response_tx, response_rx) = std::sync::mpsc::channel();

    send_to_main_thread(
        &main_thread_tx,
        Message::BatchRemoveEmbeddings(
            response_tx.clone(),
            request.old_keys.iter().map(|&x| x as u64).collect(),
        ),
        stream,
    )?;

    match response_rx.recv()? {
        Ok(_) => (),
        Err(e) => {
            error!(?e, "failed to remove old embeddings");
            return Err(e);
        }
    };

    if !request.new_keys.is_empty() {
        send_to_main_thread(
            &main_thread_tx,
            Message::BatchAddEmbeddings(
                response_tx,
                request.new_keys.iter().map(|&x| x as u64).collect(),
                embeddings,
                10,
            ),
            stream,
        )?;

        match response_rx.recv()? {
            Ok(_) => (),
            Err(e) => {
                error!(?e, "failed to add new embeddings");
                return Err(e);
            }
        }
    }

    try_stream_write_all(stream, "ok");
    send_done(stream);
    Ok(())
}
