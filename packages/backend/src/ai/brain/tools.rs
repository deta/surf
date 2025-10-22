use serde_json::json;

use crate::ai::brain::agents::context::ContextManager;
use crate::ai::brain::agents::{io::AgentIO, tools::Tool, Agent};
use crate::ai::brain::agents::{AgentResult, ExecuteConfig};
use crate::ai::brain::prompts::current_time_prompt;
use crate::ai::llm::client::{CancellationToken, Model};
use crate::{BackendError, BackendResult};

pub const WEBSEARCH_AGENT_TOOL_NAME: &str = "websearch_agent_tool";
pub const SURFLET_AGENT_TOOL_NAME: &str = "surflet_agent_tool";
pub const CONTEXT_MANAGEMENT_TOOL_NAME: &str = "context_management_tool";

// WebSearch Agent Tool
pub struct WebSearchAgentTool {
    agent: Agent,
}

impl WebSearchAgentTool {
    pub fn new(agent: Agent) -> Self {
        Self { agent }
    }
}

#[derive(serde::Deserialize)]
pub struct WebSearchArgs {
    query: String,
}

impl Tool for WebSearchAgentTool {
    fn name(&self) -> &str {
        WEBSEARCH_AGENT_TOOL_NAME
    }

    fn description(&self) -> &str {
        "Calls the WebSearch Agent to search for current/recent information or topics beyond knowledge cutoff"
    }

    fn execution_message(&self) -> Option<&str> {
        None
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Specific, detailed search terms for the web search"
                },
            },
            "required": ["query"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        execution_id: String,
        model: Model,
        custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: WebSearchArgs = serde_json::from_value(parameters)?;

        // Execute the websearch agent with the query
        eprintln!("Executing WebSearch Agent with query: {}", args.query);

        let config = ExecuteConfig {
            user_message: args.query,
            execution_id,
            model,
            custom_key: custom_key,
            system_message_preamble: Some(current_time_prompt()),
            allowed_tools: None,
        };
        let result = self
            .agent
            .execute(config, io, context_manager, cancellation_token)?;
        match result {
            AgentResult::Success(_response) => Ok(()),
            AgentResult::MaxIterationsReached(response) => Err(BackendError::GenericError(
                format!("WebSearch agent max iterations reached: {}", response),
            )),
            AgentResult::Cancelled => Err(BackendError::CancelledError),
            AgentResult::Error(error) => Err(BackendError::GenericError(format!(
                "WebSearch agent error: {}",
                error
            ))),
        }
    }
}

// Surflet Agent Tool
pub struct SurfletAgentTool {
    agent: Agent,
}

impl SurfletAgentTool {
    pub fn new(agent: Agent) -> Self {
        Self { agent }
    }
}

#[derive(serde::Deserialize)]
pub struct SurfletArgs {
    name: String,
    prompt: String,
    resource_id: Option<String>,
}

impl Tool for SurfletAgentTool {
    fn name(&self) -> &str {
        SURFLET_AGENT_TOOL_NAME
    }

    fn description(&self) -> &str {
        "Calls the Surflet Agent to create interactive apps, games, visualizations, and tools"
    }

    fn execution_message(&self) -> Option<&str> {
        None
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "User-friendly name for the app/surflet"
                },
                "prompt": {
                    "type": "string",
                    "description": "User request for the surflet"
                },
                "resource_id": {
                    "type": "string",
                    "description": "Optional existing resource ID for updates to existing apps"
                }
            },
            "required": ["name", "prompt"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        execution_id: String,
        model: Model,
        custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: SurfletArgs = serde_json::from_value(parameters)?;

        // Format the message for the surflet agent
        let message = if let Some(resource_id) = args.resource_id {
            format!(
                "Update surflet '{}' (ID: {}) with: {}",
                args.name, resource_id, args.prompt
            )
        } else {
            format!("Create surflet '{}': {}", args.name, args.prompt)
        };

        let config = ExecuteConfig {
            user_message: message,
            execution_id,
            model,
            custom_key,
            system_message_preamble: Some(current_time_prompt()),
            allowed_tools: None,
        };
        let result = self
            .agent
            .execute(config, io, context_manager, cancellation_token)?;
        match result {
            AgentResult::Success(_response) => Ok(()),
            AgentResult::MaxIterationsReached(response) => Err(BackendError::GenericError(
                format!("Surflet agent max iterations reached: {}", response),
            )),
            AgentResult::Cancelled => Err(BackendError::CancelledError),
            AgentResult::Error(error) => Err(BackendError::GenericError(format!(
                "Surflet agent error: {}",
                error
            ))),
        }
    }
}

pub struct ContextManagementTool {
    agent: Agent,
}

impl ContextManagementTool {
    pub fn new(agent: Agent) -> Self {
        Self { agent }
    }
}

#[derive(serde::Deserialize)]
pub struct ContextManagementArgs {
    task: String,
}

impl Tool for ContextManagementTool {
    fn name(&self) -> &str {
        CONTEXT_MANAGEMENT_TOOL_NAME
    }

    fn description(&self) -> &str {
        "Calls the Context Management Agent to handle context operations like organizing, filtering, or analyzing context messages"
    }

    fn execution_message(&self) -> Option<&str> {
        None
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Specific context management task or query to execute"
                },
            },
            "required": ["task"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        execution_id: String,
        model: Model,
        custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: ContextManagementArgs = serde_json::from_value(parameters)?;

        let execute_config = ExecuteConfig {
            user_message: args.task,
            execution_id,
            model,
            custom_key,
            system_message_preamble: None,
            allowed_tools: None,
        };
        let result = self
            .agent
            .execute(execute_config, io, context_manager, cancellation_token)?;

        match result {
            AgentResult::Success(_response) => Ok(()),
            AgentResult::MaxIterationsReached(response) => {
                Err(BackendError::GenericError(format!(
                    "Context Management agent max iterations reached: {}",
                    response
                )))
            }
            AgentResult::Cancelled => Err(BackendError::CancelledError),
            AgentResult::Error(error) => Err(BackendError::GenericError(format!(
                "Context Management agent error: {}",
                error
            ))),
        }
    }
}
