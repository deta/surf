use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixStream;
use std::sync::mpsc::{SendError, Sender};
use tracing::{debug, error, instrument, warn};
#[cfg(target_os = "windows")]
use uds_windows::UnixStream;

use crate::embeddings::model::EmbeddingModel;
use crate::handlers::{try_stream_write_all, try_stream_write_all_bytes};
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
    debug!("sending message to main thread");
    match main_thread_tx.send(message) {
        Ok(_) => {
            debug!("message sent successfully");
            Ok(())
        }
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
    debug!("parsing docs similarity request");
    let request = serde_json::from_str::<DocsSimilarityRequest>(client_message)?;
    debug!(
        docs_count = ?request.docs.len(),
        threshold = ?request.threshold,
        num_docs = ?request.num_docs,
        "processing docs similarity request"
    );

    debug!("encoding query");
    let query_embedding = embedding_model.encode_single(&request.query)?;
    debug!("encoding documents");
    let doc_embeddings = embedding_model.encode(&request.docs)?;

    let (response_tx, response_rx) = std::sync::mpsc::channel();
    debug!("sending docs similarity request to main thread");
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

    debug!("waiting for similarity results");
    let docs_similarity = response_rx.recv()?;
    let docs_similarity = match docs_similarity {
        Ok(docs_similarity) => {
            debug!("received similarity results successfully");
            docs_similarity
        }
        Err(e) => {
            error!(?e, "error processing similarity request");
            return Err(e);
        }
    };

    debug!("serializing similarity results");
    let docs_similarity = serde_json::to_vec(&docs_similarity)?;
    debug!(response_size = ?docs_similarity.len(), "sending response");
    try_stream_write_all_bytes(stream, &docs_similarity);
    send_done(stream);
    debug!("docs similarity request completed");
    Ok(())
}

#[instrument(level = "trace", skip(stream, embedding_model, client_message))]
pub fn handle_encode_sentences(
    stream: &UnixStream,
    embedding_model: &EmbeddingModel,
    client_message: &str,
) -> BackendResult<()> {
    debug!("parsing sentences request");
    let sentences = serde_json::from_str::<Vec<String>>(client_message)?;
    debug!(sentence_count = ?sentences.len(), "encoding sentences");

    let embeddings = embedding_model.encode(&sentences)?;
    debug!("serializing embeddings");
    let embeddings = serde_json::to_vec(&embeddings)?;

    debug!(response_size = ?embeddings.len(), "sending response");
    try_stream_write_all_bytes(stream, &embeddings);
    send_done(stream);
    debug!("encode sentences request completed");
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
    debug!("parsing filtered search request");
    let request = serde_json::from_str::<FilteredSearchRequest>(client_message)?;
    debug!(
        num_docs = ?request.num_docs,
        keys_count = ?request.keys.len(),
        threshold = ?request.threshold,
        "processing filtered search request"
    );

    debug!("encoding query");
    let query_embedding = embedding_model.encode_single(&request.query)?;
    let (response_tx, response_rx) = std::sync::mpsc::channel();

    debug!("sending search request to main thread");
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

    debug!("waiting for search results");
    let search_results = match response_rx.recv()? {
        Ok(search_results) => {
            debug!(result_count = ?search_results.len(), "received search results");
            search_results
        }
        Err(e) => {
            error!(?e, "error processing search request");
            return Err(e);
        }
    };

    let search_results: Vec<i64> = search_results.iter().map(|id| *id as i64).collect();
    debug!("serializing search results");
    let search_results = serde_json::to_vec(&search_results)?;

    debug!(response_size = ?search_results.len(), "sending response");
    try_stream_write_all_bytes(stream, &search_results);
    send_done(stream);
    debug!("filtered search request completed");
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
    debug!("parsing upsert embeddings request");
    let request = serde_json::from_str::<UpsertEmbeddingsRequest>(client_message)?;
    debug!(
        old_keys_count = ?request.old_keys.len(),
        new_keys_count = ?request.new_keys.len(),
        chunks_count = ?request.chunks.len(),
        "processing upsert embeddings request"
    );

    debug!("encoding chunks");
    let embeddings = embedding_model.encode(&request.chunks)?;
    let (response_tx, response_rx) = std::sync::mpsc::channel();

    debug!(keys_to_remove = ?request.old_keys.len(), "removing old embeddings");
    send_to_main_thread(
        &main_thread_tx,
        Message::BatchRemoveEmbeddings(
            response_tx.clone(),
            request.old_keys.iter().map(|&x| x as u64).collect(),
        ),
        stream,
    )?;

    debug!("waiting for removal confirmation");
    match response_rx.recv()? {
        Ok(_) => debug!("old embeddings removed successfully"),
        Err(e) => {
            error!(?e, "failed to remove old embeddings");
            return Err(e);
        }
    };

    if !request.new_keys.is_empty() {
        debug!(keys_to_add = ?request.new_keys.len(), "adding new embeddings");
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

        debug!("waiting for add confirmation");
        match response_rx.recv()? {
            Ok(_) => debug!("new embeddings added successfully"),
            Err(e) => {
                error!(?e, "failed to add new embeddings");
                return Err(e);
            }
        }
    }

    debug!("sending success response");
    try_stream_write_all(stream, "ok");
    send_done(stream);
    debug!("upsert embeddings request completed");
    Ok(())
}
