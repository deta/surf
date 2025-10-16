mod handlers;
pub mod message;

use std::fs;
#[cfg(not(target_os = "windows"))]
use std::os::unix::net::UnixListener;
use std::path::{Path, PathBuf};
use tracing::{error, info, instrument};
#[cfg(target_os = "windows")]
use uds_windows::UnixListener;

use crate::embeddings::model::{EmbeddingModel, EmbeddingModelMode};
use crate::embeddings::store::EmbeddingsStore;
use crate::{BackendError, BackendResult};
use handlers::handle_client;
use message::Message;

use std::sync::{mpsc, Arc};

pub struct LocalAIServer {
    socket_path: String,
    index_path: String,
    embedding_model: Arc<EmbeddingModel>,
    listener: UnixListener,
}

impl LocalAIServer {
    #[instrument(level = "trace", skip(model_cache_dir))]
    pub fn new(
        socket_path: &PathBuf,
        index_path: &PathBuf,
        model_cache_dir: &Path,
        local_llm: bool,
        embedding_model_mode: EmbeddingModelMode,
    ) -> BackendResult<Self> {
        if socket_path.exists() {
            fs::remove_file(socket_path)?;
        }

        let listener = UnixListener::bind(socket_path)?;

        if local_llm {
            return Err(BackendError::GenericError(
                "Local LLM not supported".to_string(),
            ));
        }

        let embedding_model = Arc::new(EmbeddingModel::new_remote(
            model_cache_dir,
            embedding_model_mode,
        )?);

        Ok(Self {
            socket_path: socket_path.to_string_lossy().to_string(),
            index_path: index_path.to_string_lossy().to_string(),
            embedding_model,
            listener,
        })
    }

    fn try_send<T>(sender: mpsc::Sender<T>, msg: T) {
        if let Err(e) = sender.send(msg) {
            error!(?e, "failed to send message");
        }
    }

    #[instrument(level = "trace", skip(rx, embedding_dim, index_path))]
    fn handle_main_thread_messages(
        rx: mpsc::Receiver<Message>,
        index_path: &str,
        embedding_dim: &usize,
    ) {
        let embeddings_store = match EmbeddingsStore::new(index_path, embedding_dim) {
            Ok(store) => store,
            Err(e) => {
                error!(?e, "failed to create embeddings store");
                return;
            }
        };

        loop {
            let msg = match rx.recv() {
                Ok(msg) => msg,
                Err(e) => {
                    error!(?e, "failed to receive message");
                    break;
                }
            };

            match msg {
                Message::AddEmbedding(sender, id, embedding) => {
                    Self::try_send(sender, embeddings_store.add(id, &embedding));
                }
                Message::RemoveEmbedding(sender, id) => {
                    Self::try_send(sender, embeddings_store.remove(id));
                }
                Message::BatchAddEmbeddings(sender, ids, embeddings, _size) => {
                    Self::try_send(sender, embeddings_store.batch_add(ids, &embeddings));
                }
                Message::BatchRemoveEmbeddings(sender, ids) => {
                    Self::try_send(sender, embeddings_store.batch_remove(ids));
                }
                Message::FilteredSearch(sender, query, num_docs, filter_ids, threshold) => {
                    Self::try_send(
                        sender,
                        embeddings_store.filtered_search(&query, num_docs, &filter_ids, &threshold),
                    );
                }
                Message::GetDocsSimilarity(sender, query, docs, threshold, num_docs) => {
                    Self::try_send(
                        sender,
                        embeddings_store.get_docs_similarity(&query, &docs, &threshold, &num_docs),
                    );
                }
            }
        }
    }

    pub fn listen(&self) {
        info!(socket_path = ?self.socket_path, "server starting");
        let (tx, rx) = mpsc::channel();

        let index_path = self.index_path.clone();
        let embedding_dim = self.embedding_model.get_embedding_dim();

        std::thread::spawn(move || {
            Self::handle_main_thread_messages(rx, &index_path, &embedding_dim)
        });

        info!("listening for incoming connections");
        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    let embedding_model = Arc::clone(&self.embedding_model);
                    let tx = tx.clone();

                    std::thread::spawn(move || {
                        if let Err(e) = handle_client(tx, &embedding_model, stream) {
                            error!(?e, "client handler error");
                        }
                    });
                }
                Err(e) => {
                    error!(?e, "failed to accept client connection");
                }
            }
        }
    }
}
