use std::sync::Arc;

use crate::ai::brain::agents::context::ContextManager;
use crate::ai::brain::agents::io::AgentIO;
use crate::ai::brain::agents::tools::Tool;
use crate::ai::brain::js_tools::{JSToolRegistry, ToolName};
use crate::ai::llm::client::{CancellationToken, Model};
use crate::BackendResult;

pub struct MCPTool {
    name: String,
    description: String,
    server_id: String,
    input_schema: serde_json::Value,
    js_tool_registry: Arc<JSToolRegistry>,
}

impl MCPTool {
    pub fn new(
        name: String,
        description: String,
        server_id: String,
        input_schema: serde_json::Value,
        js_tool_registry: Arc<JSToolRegistry>,
    ) -> Self {
        Self { name, description, server_id, input_schema, js_tool_registry }
    }
}

impl Tool for MCPTool {
    fn name(&self) -> &str { &self.name }
    fn description(&self) -> &str { &self.description }
    fn execution_message(&self) -> Option<&str> { Some("Executing MCP tool...") }
    fn parameters_schema(&self) -> serde_json::Value { self.input_schema.clone() }

    fn execute(
        &self,
        parameters: serde_json::Value,
        _execution_id: String,
        _model: Model,
        _custom_key: Option<String>,
        io: &dyn AgentIO,
        _context_manager: &mut dyn ContextManager,
        _cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let result: String = self.js_tool_registry.execute_tool(
            &ToolName::ExecuteMCPTool,
            Some(vec![
                self.server_id.clone(),
                self.name.clone(),
                serde_json::to_string(&parameters)?
            ]),
        )?;
        io.write(&format!("<mcp_result>{}</mcp_result>", result))?;
        Ok(())
    }
}
