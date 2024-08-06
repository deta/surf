pub mod embeddings;
pub mod handlers;
pub mod llm;
pub mod server;

use crate::server::server::LocalAIServer;
use std::path::Path;

#[derive(thiserror::Error, Debug)]
pub enum BackendError {
    #[error("IO error: {0}")]
    IOError(#[from] std::io::Error),
    #[error("Llama context error: {0}")]
    LlamaContextError(#[from] llama_cpp::LlamaContextError),
    #[error("Llama load error: {0}")]
    LlamaLoadError(#[from] llama_cpp::LlamaLoadError),
    #[error("Llama tokenization error: {0}")]
    LlamaTokenizationError(#[from] llama_cpp::LlamaTokenizationError),
    #[error("Cxx exception: {0}")]
    CxxError(#[from] cxx::Exception),
    #[error("Serde json error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),
    #[error("Mspc send error: {0}")]
    MspcSendError(#[from] std::sync::mpsc::SendError<crate::server::message::Message>),
    #[error("Mspc recv error: {0}")]
    MspcRecvError(#[from] std::sync::mpsc::RecvError),
    #[error("Generic error: {0}")]
    GenericError(String),
}

pub type BackendResult<T> = Result<T, BackendError>;

// TODO: handle kill signal gracefully
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <root_path> <local_llm_mode>", args[0]);
        std::process::exit(1);
    }
    let root_path = Path::new(&args[1]);
    let socket_path = Path::join(root_path, "sffs-ai.sock");
    let index_path = Path::join(root_path, "index.usearch");
    let model_cache_dir = Path::join(root_path, "fastembed-cache");
    let local_llm_mode = match args[2].as_str() {
        "true" => true,
        "false" => false,
        _ => {
            eprintln!(
                "Bad local_llm_mode: {:#?}, only allowed 'true' or 'false'",
                args[2]
            );
            std::process::exit(1);
        }
    };
    println!(
        "[LocalAIServer]: started with socket_path: {:#?}, local_llm_mode: {:#?}",
        socket_path, local_llm_mode
    );
    let server =
        LocalAIServer::new(&socket_path, &index_path, &model_cache_dir, local_llm_mode).unwrap();
    server.listen();
}
