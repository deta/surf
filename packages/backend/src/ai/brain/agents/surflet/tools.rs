use serde_json::json;
use std::sync::Arc;

use crate::ai::brain::agents::{AgentIO, ContextManager, Tool};
use crate::ai::brain::js_tools::{JSToolRegistry, ToolName};
use crate::ai::llm::client::{CancellationToken, Model};
use crate::BackendResult;

#[allow(dead_code)]
pub struct SurfletCreator {
    js_tool_registry: Arc<JSToolRegistry>,
}

#[allow(dead_code)]
impl SurfletCreator {
    pub fn new(js_tool_registry: Arc<JSToolRegistry>) -> Self {
        Self { js_tool_registry }
    }

    // TODO: use a random id as well to correlate query & results
    fn format_surflet_query(name: &str, prompt: &str) -> String {
        format!(
            "<answer>
                <surflet data-name=\"{}\" data-prompt=\"{}\"></surflet>
             </answer>",
            name, prompt
        )
    }
}

#[derive(serde::Deserialize)]
pub struct SurfletArgs {
    name: String,
    prompt: String,
}

#[derive(serde::Deserialize)]
pub struct SurfletDoneCallbackResult {
    status: String,
}

impl Tool for SurfletCreator {
    fn name(&self) -> &str {
        "surflet_creator"
    }

    fn description(&self) -> &str {
        "Creates a surflet with the given name and prompt"
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Creating a Surflet...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name of the surflet to create"
                },
                "prompt": {
                    "type": "string",
                    "description": "The prompt describing what the surflet should do"
                }
            },
            "required": ["name", "prompt"]
        })
    }

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
        let args: SurfletArgs = serde_json::from_value(parameters)?;

        let name = args.name;
        let prompt = args.prompt;

        io.write("<sources></sources>")?;
        io.write(&Self::format_surflet_query(&name, &prompt))?;

        // _result mainly to tell `execute_tool` how to parse the result, we can ignore
        let _result: SurfletDoneCallbackResult = self
            .js_tool_registry
            .execute_tool(&ToolName::SurfletDoneCallback, Some(vec![name, prompt]))?;

        Ok(())
    }
}
