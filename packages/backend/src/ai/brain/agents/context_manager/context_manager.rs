use std::sync::Arc;

use super::prompt::prompt;
use crate::ai::brain::agents::context_manager::tools::{
    AddResourcesTool, AddUrlsTool, PopulateContextContentTool,
};
use crate::ai::brain::agents::{Agent, AgentConfig};
use crate::ai::llm::client::LLMClient;

pub fn create_context_manager_agent(client: Arc<LLMClient>) -> Agent {
    let system_prompt = prompt();

    let config = AgentConfig {
        name: "context_manager_agent".to_string(),
        max_iterations: 3,
        system_prompt,
        fallback_to_text: true,
        retry_on_parse_error: true,
        write_status_to_io: true,
        write_final_response_to_io: false,
    };

    let mut agent = Agent::new(client, config);

    let populate_tool = Box::new(PopulateContextContentTool::new());
    agent.add_tool(populate_tool);

    let add_resources_tool = Box::new(AddResourcesTool::new());
    agent.add_tool(add_resources_tool);

    /*
    let add_ursl_tool = Box::new(AddUrlsTool::new());
    agent.add_tool(add_ursl_tool);
    */

    agent
}
