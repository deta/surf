pub mod ai;
pub mod api;
pub mod store;
pub mod utils;
pub mod worker;

use neon::{prelude::ModuleContext, result::NeonResult};

#[derive(thiserror::Error, Debug)]
pub enum BackendError {
    #[error("IO error: {0}")]
    IOError(#[from] std::io::Error),
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    #[error("Chrono error: {0}")]
    ChronoError(#[from] chrono::ParseError),
    #[error("Reqwest error: {0}")]
    ReqwestError(#[from] reqwest::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Key-value store error: {0}")]
    KeyValueStoreError(#[from] crate::store::kv::KeyValueStoreError),
    #[error("LLM Error: {r#type}: {message}")]
    LLMClientError { r#type: String, message: String },
    #[error("LLM API Key Missing error")]
    LLMClientErrorAPIKeyMissing,
    #[error("LLM Bad Request error: {0}")]
    LLMClientErrorBadRequest(String),
    #[error("LLM Too Many Requests error")]
    LLMClientErrorTooManyRequests,
    #[error("LLM Unauthorized error")]
    LLMClientErrorUnauthorized,
    // TODO: fix this monstrosity
    #[error("LLM Quota Depleted error: {quotas}")]
    LLMClientErrorQuotasDepleted { quotas: serde_json::Value },
    #[error("RAG Empty Context error: {0}")]
    RAGEmptyContextError(String),
    #[error("Generic error: {0}")]
    GenericError(String),
    #[error("Multiple errors: {0:#?}")]
    MultipleErrors(Vec<BackendError>),
}

type BackendResult<T> = Result<T, BackendError>;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    api::register_exported_functions(&mut cx)?;
    Ok(())
}
