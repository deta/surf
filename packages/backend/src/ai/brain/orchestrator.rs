use std::sync::Arc;

use crate::ai::brain::agents::context::ContextManager;
use crate::ai::brain::agents::context_manager::context_manager::create_context_manager_agent;
use crate::ai::brain::agents::io::AgentIO;
use crate::ai::brain::agents::surflet::surflet::create_surflet_agent;
use crate::ai::brain::agents::websearch::tools::SearchEngineCaller;
use crate::ai::brain::agents::AgentResult;
use crate::ai::brain::agents::{Agent, AgentConfig, ExecuteConfig};
use crate::ai::brain::js_tools::JSToolRegistry;
use crate::ai::brain::prompts::{current_time_prompt, lead_agent_prompt};
use crate::ai::brain::tools::ContextManagementTool;
use crate::ai::llm::client::{CancellationToken, LLMClient, Model};
use crate::{BackendError, BackendResult};

use super::tools::SurfletAgentTool;

#[allow(dead_code)]
pub struct Orchestrator {
    api_base: String,
    api_key: String,
    llm_client: Arc<LLMClient>,
    model: Model,
    lead_agent: Option<Agent>,
    js_tool_registry: Arc<JSToolRegistry>,
}

impl Orchestrator {
    pub fn new(
        api_base: String,
        api_key: String,
        default_model: Model,
        js_tool_registry: Arc<JSToolRegistry>,
    ) -> BackendResult<Self> {
        let llm_client = LLMClient::new(api_base.clone(), api_key.clone()).map_err(|e| {
            BackendError::GenericError(
                format!("failed to create new llm client: {:?}", e).to_string(),
            )
        })?;

        let llm_client = Arc::new(llm_client);

        let lead_config = AgentConfig {
            name: "Lead Agent".to_string(),
            max_iterations: 10,
            system_prompt: lead_agent_prompt(),
            fallback_to_text: true,
            retry_on_parse_error: true,
            write_status_to_io: true,
            write_final_response_to_io: true,
        };
        let lead_agent = Agent::new(llm_client.clone(), lead_config);
        let mut orc = Self {
            api_base,
            api_key,
            model: default_model,
            llm_client,
            lead_agent: Some(lead_agent),
            js_tool_registry,
        };
        orc.init_web_search_agent()?;
        orc.init_surflet_agent()?;
        orc.init_context_manager_agent()?;
        Ok(orc)
    }

    // right now we're shortcutting to only the search engine tool directly
    pub fn init_web_search_agent(&mut self) -> BackendResult<()> {
        /* TODO: use the actual agent later
        let client = Arc::clone(&self.llm_client);
        let websearch_agent = create_web_search_agent(client, Arc::clone(&self.js_tool_registry));
        let websearch_tool = Box::new(WebSearchAgentTool::new(websearch_agent));
        */
        if let Some(ref mut lead_agent) = self.lead_agent {
            let websearch_tool =
                Box::new(SearchEngineCaller::new(Arc::clone(&self.js_tool_registry)));
            lead_agent.add_tool(websearch_tool);
        }
        Ok(())
    }

    pub fn init_context_manager_agent(&mut self) -> BackendResult<()> {
        let context_manager_agent = create_context_manager_agent(Arc::clone(&self.llm_client));
        let context_manager_tool = Box::new(ContextManagementTool::new(context_manager_agent));
        if let Some(ref mut lead_agent) = self.lead_agent {
            lead_agent.add_tool(context_manager_tool);
        }
        Ok(())
    }

    pub fn init_surflet_agent(&mut self) -> BackendResult<()> {
        let surflet_agent = create_surflet_agent(
            Arc::clone(&self.llm_client),
            Arc::clone(&self.js_tool_registry),
        );
        let surflet_tool = Box::new(SurfletAgentTool::new(surflet_agent));
        if let Some(ref mut lead_agent) = self.lead_agent {
            lead_agent.add_tool(surflet_tool);
        }
        Ok(())
    }

    pub fn create_agent(&self, name: String, system_prompt: String) -> Agent {
        let config = AgentConfig {
            name,
            max_iterations: 3,
            system_prompt,
            fallback_to_text: true,
            retry_on_parse_error: true,
            write_status_to_io: true,
            write_final_response_to_io: true,
        };
        Agent::new(self.llm_client.clone(), config)
    }

    pub fn get_llm_client(&self) -> Arc<LLMClient> {
        Arc::clone(&self.llm_client)
    }

    // TODO: should we take an execution id?
    pub fn execute_lead_agent(
        &self,
        mut config: ExecuteConfig,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<String> {
        let agent = self
            .lead_agent
            .as_ref()
            .ok_or_else(|| BackendError::GenericError("Lead agent not configured".to_string()))?;

        config.system_message_preamble = Some(current_time_prompt());
        let result = agent.execute(config, io, context_manager, cancellation_token)?;
        match result {
            AgentResult::Success(response) => Ok(response),
            AgentResult::MaxIterationsReached(response) => {
                Ok(format!("Max iterations reached: {}", response))
            }
            AgentResult::Cancelled => Err(BackendError::CancelledError),
            AgentResult::Error(error) => Err(BackendError::GenericError(format!(
                "Agent error: {}",
                error
            ))),
        }
    }
}
