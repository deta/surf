use std::fs;
use std::os::unix::net::UnixListener;
use std::path::PathBuf;

use crate::embeddings::model::{EmbeddingModel, EmbeddingModelMode};
use crate::embeddings::store::EmbeddingsStore;
use crate::handlers::handle_client;
use crate::llm::llama::llama::Llama;
use crate::server::message::Message;
use crate::BackendResult;

use std::sync::{mpsc, Arc};

pub struct LocalAIServer {
    socket_path: String,
    index_path: String,
    llama: Arc<Option<Llama>>,
    embedding_model: Arc<EmbeddingModel>,
    listener: UnixListener,
}

// TODO: handle multiple clients
impl LocalAIServer {
    pub fn new(
        socket_path: &PathBuf,
        index_path: &PathBuf,
        model_cache_dir: &PathBuf,
        local_llm: bool,
        embedding_model_mode: EmbeddingModelMode,
    ) -> BackendResult<Self> {
        if socket_path.exists() {
            fs::remove_file(&socket_path)?;
        }
        let listener = UnixListener::bind(socket_path)?;
        let llama = match local_llm {
            true => {
                let llama = Llama::new_remote(
                    "bartowski/Meta-Llama-3-8B-Instruct-GGUF".to_string(),
                    "Meta-Llama-3-8B-Instruct-Q4_K_S.gguf".to_string(),
                    8192,
                    512,
                    8192,
                )?;
                Arc::new(Some(llama))
            }
            false => Arc::new(None),
        };
        let embedding_model = Arc::new(EmbeddingModel::new_remote(
            model_cache_dir,
            embedding_model_mode,
        )?);

        Ok(Self {
            socket_path: socket_path.to_string_lossy().to_string(),
            index_path: index_path.to_string_lossy().to_string(),
            llama,
            embedding_model,
            listener,
        })
    }

    fn try_send<T>(sender: mpsc::Sender<T>, msg: T) {
        match sender.send(msg) {
            Ok(_) => {}
            Err(e) => eprintln!("[LocalAIServer] failed to send message: {:#?}", e),
        }
    }

    fn handle_main_thread_messages(
        rx: mpsc::Receiver<Message>,
        index_path: &str,
        embedding_dim: &usize,
    ) {
        let embeddings_store = match EmbeddingsStore::new(index_path, embedding_dim) {
            Ok(store) => store,
            Err(e) => {
                eprintln!(
                    "[LocalAIServer] failed to create embeddings store: {:#?}",
                    e
                );
                return;
            }
        };
        loop {
            let msg = match rx.recv() {
                Ok(msg) => msg,
                Err(e) => {
                    eprintln!("[LocalAIServer] failed to receive message: {:#?}", e);
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
                Message::BatchAddEmbeddings(sender, ids, embeddings, size) => {
                    Self::try_send(sender, embeddings_store.batch_add(ids, &embeddings, size));
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

    // TODO: use single thread for embeddings store
    pub fn listen(&self) {
        println!("[LocalAIServer] listening on: {:#?}", self.socket_path);
        let (tx, rx) = mpsc::channel();

        let index_path = self.index_path.clone();
        let embedding_dim = self.embedding_model.get_embedding_dim().clone();

        std::thread::spawn(move || {
            Self::handle_main_thread_messages(rx, &index_path, &embedding_dim)
        });

        for stream in self.listener.incoming() {
            match stream {
                Ok(stream) => {
                    println!("[LocalAIServer] accepted new client");
                    let model = Arc::clone(&self.llama);
                    let embedding_model = Arc::clone(&self.embedding_model);
                    let tx = tx.clone();
                    std::thread::spawn(move || {
                        match handle_client(tx, &model, &embedding_model, stream) {
                            Ok(_) => {}
                            Err(e) => {
                                eprintln!("[LocalAIServer] failed to handle client: {:#?}", e);
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[LocalAIServer] failed to accept client: {:#?}", e);
                }
            }
        }
    }
}
