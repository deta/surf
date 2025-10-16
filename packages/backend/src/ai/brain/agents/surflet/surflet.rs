use super::prompt::prompt;
use crate::ai::{
    brain::{
        agents::{surflet::tools::SurfletCreator, Agent, AgentConfig},
        js_tools::JSToolRegistry,
    },
    llm::client::LLMClient,
};
use std::sync::Arc;

pub fn create_surflet_agent(
    client: Arc<LLMClient>,
    js_tool_registry: Arc<JSToolRegistry>,
) -> Agent {
    let system_prompt = prompt();

    let config = AgentConfig {
        name: "surflet_agent".to_string(),
        max_iterations: 2,
        system_prompt,
        fallback_to_text: false,
        retry_on_parse_error: true,
        write_status_to_io: true,
        write_final_response_to_io: false,
    };
    let mut agent = Agent::new(client, config);

    let surflet_creator_tool = SurfletCreator::new(js_tool_registry);
    agent.add_tool(Box::new(surflet_creator_tool));

    agent
}
