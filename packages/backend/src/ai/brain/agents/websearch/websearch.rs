use std::sync::Arc;

use super::prompt::prompt;
use super::tools::SearchEngineCaller;
use crate::ai::brain::agents::{context_manager::tools::AddUrlsTool, Agent, AgentConfig};
use crate::ai::brain::js_tools::JSToolRegistry;
use crate::ai::llm::client::LLMClient;

pub fn create_web_search_agent(
    client: Arc<LLMClient>,
    js_tool_registry: Arc<JSToolRegistry>,
) -> Agent {
    let system_prompt = prompt();

    let config = AgentConfig {
        name: "websearch_agent".to_string(),
        max_iterations: 3,
        system_prompt,
        fallback_to_text: true,
        retry_on_parse_error: true,
        write_status_to_io: true,
        write_final_response_to_io: false,
    };

    let mut agent = Agent::new(client, config);

    let search_engine_caller = Box::new(SearchEngineCaller::new(js_tool_registry));
    agent.add_tool(search_engine_caller);

    let add_urls_tool = Box::new(AddUrlsTool::new());
    agent.add_tool(add_urls_tool);
    agent
}
