pub mod ai;
pub mod embeddings;
pub mod vision;
pub mod youtube;
pub mod llm;

mod local;
mod prompts;

pub const _MODULE_PREFIX: &str = "ai";
pub const _AI_API_ENDPOINT: &str = "v1/deta-os-ai";
