use serde_json::json;
use std::sync::Arc;

use crate::ai::brain::agents::io::StatusMessage;
use crate::ai::brain::agents::{AgentIO, ContextManager, Tool};
use crate::ai::brain::js_tools::{JSToolRegistry, ToolName};
use crate::ai::llm::client::{CancellationToken, Model};
use crate::BackendResult;

pub const SEARCH_ENGINE_CALLER_TOOL_NAME: &str = "search_engine_caller";

#[allow(dead_code)]
pub struct SearchEngineCaller {
    js_tool_registry: Arc<JSToolRegistry>,
}

#[allow(dead_code)]
impl SearchEngineCaller {
    pub fn new(js_tool_registry: Arc<JSToolRegistry>) -> Self {
        Self { js_tool_registry }
    }

    // TODO: use a random id as well to correlate query & results
    fn format_web_query(query: &str) -> String {
        format!(
            "<answer>
                <websearch data-query=\"{}\"></websearch>
             </answer>",
            query
        )
    }
}

#[derive(serde::Deserialize)]
pub struct SearchArgs {
    query: String,
    max_results: Option<u32>,
}

#[allow(dead_code)]
#[derive(serde::Deserialize)]
struct SearchEngineResult {
    title: Option<String>,
    url: Option<String>,
    content: Option<String>,
}

impl Tool for SearchEngineCaller {
    fn name(&self) -> &str {
        SEARCH_ENGINE_CALLER_TOOL_NAME
    }

    fn description(&self) -> &str {
        "Calls a web search engine and returns the search results"
    }

    fn execution_message(&self) -> Option<&str> {
        Some("Searching the web...")
    }

    fn parameters_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to use in the web search engine"
                },
                "max_results": {
                    "type": "integer",
                    "description": "The maximum number of search results to return",
                    "default": 5
                }
            },
            "required": ["query"]
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
        cancellation_token: CancellationToken,
    ) -> BackendResult<()> {
        let args: SearchArgs = serde_json::from_value(parameters)?;

        let query = args.query;
        io.write("<sources></sources>")?;
        io.write(&Self::format_web_query(&query))?;

        // TODO: should we put the results in the context manager automatically
        // or should the orchestrator handle that?
        // _result mainly to tell `excute_tool` how to parse the result
        let results: Vec<SearchEngineResult> = self
            .js_tool_registry
            .execute_tool(&ToolName::SearchDoneCallback, Some(vec![query]))?;

        for result in results {
            if let Some(url) = result.url {
                if cancellation_token.is_cancelled() {
                    return Ok(());
                }

                let short_url = if url.len() > 30 {
                    format!("{}...", &url[..27])
                } else {
                    url.clone()
                };
                io.write_status(StatusMessage::new_status(&format!(
                    "Processing '{}'",
                    short_url
                )))?;
                match context_manager.add_url(&io.get_id(), &url) {
                    Ok(_) => {}
                    Err(e) => {
                        io.write_status(StatusMessage::new_error(&format!(
                            "Failed to process '{}': {}",
                            short_url, e
                        )))?;
                    }
                }
            }
        }
        Ok(())
    }
}
