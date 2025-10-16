use super::io::AgentIO;
use crate::{
    ai::{
        brain::agents::context::ContextManager,
        llm::client::{CancellationToken, Model},
    },
    BackendResult,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
#[error("Tool error")]
pub struct ToolError;

pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn execution_message(&self) -> Option<&str>;
    fn parameters_schema(&self) -> serde_json::Value;

    fn execute(
        &self,
        parameters: serde_json::Value,
        execution_id: String,
        model: Model,
        custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<()>;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub r#type: String, // "function"
    pub function: FunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolResult {
    pub role: String,
    pub name: String,
    pub status: String, // "success" or "error: {error}", // TODO: use enum?
}
