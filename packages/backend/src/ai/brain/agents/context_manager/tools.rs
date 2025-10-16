use crate::{
    ai::{
        brain::agents::{context::ContextManager, io::AgentIO, Tool},
        llm::client::{CancellationToken, Model},
    },
    BackendResult,
};
use serde_json::json;

/*
pub struct RemoveContextMessagesTool {}

impl RemoveContextMessagesTool {
    pub fn new() -> Self {
        Self {}
    }
}

#[derive(serde::Deserialize)]
pub struct RemoveContextMessagesArgs {
    context_ids: Vec<String>,
}

impl Tool for RemoveContextMessagesTool {
    fn name(&self) -> &str {
        "remove_context_messages"
    }

    fn description(&self) -> &str {
        "Removes specified context messages from the current context"
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Filtering your context...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "context_ids": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Array of context message IDs to remove"
                }
            },
            "required": ["context_ids"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        _execution_id: String,
        _model: Model,
        _custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        _cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: RemoveContextMessagesArgs = serde_json::from_value(parameters)?;
        context_manager.remove_context_messages(&io.get_id(), &args.context_ids)?;
        Ok(())
    }
}
*/

pub struct PopulateContextContentTool {}

impl PopulateContextContentTool {
    pub fn new() -> Self {
        Self {}
    }
}

#[derive(serde::Deserialize)]
pub struct PopulateContextContentArgs {
    message_ids: Vec<String>,
}

impl Tool for PopulateContextContentTool {
    fn name(&self) -> &str {
        "populate_context_content"
    }

    fn description(&self) -> &str {
        "Populates the content for specified context messages by loading from the database"
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Fetching additional context...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "message_ids": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Array of message IDs to populate with content"
                }
            },
            "required": ["message_ids"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        _execution_id: String,
        _model: Model,
        _custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        _cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: PopulateContextContentArgs = serde_json::from_value(parameters)?;
        context_manager.populate_context_content(&io.get_id(), &args.message_ids)?;
        Ok(())
    }
}

pub struct AddResourcesTool {}

impl AddResourcesTool {
    pub fn new() -> Self {
        Self {}
    }
}

#[derive(serde::Deserialize)]
pub struct AddResourcesArgs {
    resource_ids: Vec<String>,
}

impl Tool for AddResourcesTool {
    fn name(&self) -> &str {
        "add_resources"
    }

    fn description(&self) -> &str {
        "Adds specified resource IDs to the current context"
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Adding additional resources to your context...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "resource_ids": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Array of resource IDs to add to the context"
                }
            },
            "required": ["resource_ids"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        _execution_id: String,
        _model: Model,
        _custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        _cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: AddResourcesArgs = serde_json::from_value(parameters)?;
        context_manager.add_resources(&io.get_id(), &args.resource_ids)?;
        Ok(())
    }
}

pub struct AddUrlsTool {}

impl AddUrlsTool {
    pub fn new() -> Self {
        Self {}
    }
}

#[derive(serde::Deserialize)]
pub struct AddUrlsArgs {
    urls: Vec<String>,
}

impl Tool for AddUrlsTool {
    fn name(&self) -> &str {
        "add_urls"
    }

    fn description(&self) -> &str {
        "Adds specified URLs to the current context. It scrapes the url and gets the content and adds it to the context."
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Processing search results...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "urls": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Array of URLs to add to the context"
                }
            },
            "required": ["urls"]
        })
    }

    fn execute(
        &self,
        parameters: serde_json::Value,
        _execution_id: String,
        _model: Model,
        _custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        _cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: AddUrlsArgs = serde_json::from_value(parameters)?;
        context_manager.add_urls(&io.get_id(), &args.urls)?;
        Ok(())
    }
}
