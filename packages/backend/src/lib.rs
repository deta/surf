pub mod backend;
pub mod store;

use neon::{prelude::ModuleContext, result::NeonResult};

#[derive(thiserror::Error, Debug)]
pub enum BackendError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    #[error("Chrono error: {0}")]
    ChronoError(#[from] chrono::ParseError),
    #[error("Generic error: {0}")]
    GenericError(String),
}

type BackendResult<T> = Result<T, BackendError>;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    backend::register_exported_functions(&mut cx)?;
    store::register_exported_functions(&mut cx)?;
    Ok(())
}
