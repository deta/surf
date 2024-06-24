pub mod ai;
pub mod backend;
// pub mod embeddings;
pub mod store;
pub mod vision;

use neon::{prelude::ModuleContext, result::NeonResult};

#[derive(thiserror::Error, Debug)]
pub enum BackendError {
    #[error("IO error: {0}")]
    IOError(#[from] std::io::Error),
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    #[error("Chrono error: {0}")]
    ChronoError(#[from] chrono::ParseError),
    // #[error("RustBert error: {0}")]
    // RustBertError(#[from] rust_bert::RustBertError),
    #[error("Reqwest error: {0}")]
    ReqwestError(#[from] reqwest::Error),
    #[error("Generic error: {0}")]
    GenericError(String),
}

type BackendResult<T> = Result<T, BackendError>;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    backend::register_exported_functions(&mut cx)?;
    store::register_exported_functions(&mut cx)?;
    ai::register_exported_functions(&mut cx)?;
    Ok(())
}
