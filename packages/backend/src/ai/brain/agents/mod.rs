pub mod context;
pub mod context_manager;
pub mod io;
pub mod surflet;
pub mod tools;
pub mod websearch;

use io::AgentIO;
use tools::{FunctionCall, Tool, ToolCall, ToolResult};

use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::instrument::WithSubscriber;

use crate::ai::brain::agents::context::ContextManager;
use crate::ai::brain::agents::io::StatusMessage;
use crate::ai::llm::client::{
    CancellationToken, ChatCompletionProvider, ChatCompletionStream, Model,
};
use crate::ai::llm::models::MessageRole;
use crate::BackendResult;
use crate::{ai::llm::models::Message, BackendError};

use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize)]
struct ToolCallRequest {
    name: String,
    parameters: serde_json::Value,
}

#[derive(Debug)]
enum LLMResponse {
    ToolCalls(Vec<ToolCall>),
    FinalResponse(String),
    ParseError(String),
}

#[allow(dead_code)]
#[derive(Debug)]
enum StreamingState {
    WaitingForTag,
    InFinalAnswer,
    InToolCall {
        tool_name: Option<String>,
        content: String,
    },
    InCitation {
        buffer: String,
    },
    Complete,
}

#[derive(Debug)]
enum CitationParseResult {
    Complete {
        context_id: Option<String>,
        cited_text: Option<String>,
        remaining: String,
    },
    Incomplete,
    Error(String),
}

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub name: String,
    pub max_iterations: usize,
    pub system_prompt: String,
    pub fallback_to_text: bool,
    pub retry_on_parse_error: bool,
    pub write_status_to_io: bool,
    pub write_final_response_to_io: bool,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            name: "Default Agent".to_string(),
            max_iterations: 3,
            system_prompt: "You are a helpful AI assistant that can use tools to complete tasks. When you need to use a tool, call it with the appropriate parameters. Continue using tools until the task is complete, then provide a final response.".to_string(),
            fallback_to_text: true,
            retry_on_parse_error: true,
            write_status_to_io: true,
            write_final_response_to_io: true,
        }
    }
}

#[derive(Debug)]
pub enum AgentResult {
    Success(String),
    MaxIterationsReached(String),
    Cancelled,
    Error(String),
}

pub struct Agent {
    client: Arc<dyn ChatCompletionProvider>,
    tools: HashMap<String, Box<dyn Tool>>,
    config: AgentConfig,
}

pub struct ExecuteConfig {
    pub execution_id: String,
    pub user_message: String,
    pub system_message_preamble: Option<String>,
    pub model: Model,
    pub custom_key: Option<String>,
    // allowed tool names
    pub allowed_tools: Option<HashSet<String>>,
}

impl Agent {
    pub fn new(client: Arc<dyn ChatCompletionProvider>, config: AgentConfig) -> Self {
        Self {
            client,
            tools: HashMap::new(),
            config,
        }
    }

    pub fn add_tool(&mut self, tool: Box<dyn Tool>) {
        let name = tool.name().to_string();
        self.tools.insert(name, tool);
    }

    pub fn execute(
        &self,
        config: ExecuteConfig,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<AgentResult> {
        let system_messages = vec![Message::new_system(&self.build_system_prompt(
            config.system_message_preamble,
            config.allowed_tools,
            self.config.write_final_response_to_io,
        ))];

        let user_msg = Message::new_user(&config.user_message);
        let io_id = io.get_id();
        let mut tool_usage_history = Vec::new();

        for iteration in 0..self.config.max_iterations {
            if cancellation_token.is_cancelled() {
                tracing::info!("Agent execution cancelled");
                return Ok(AgentResult::Cancelled);
            }

            tracing::debug!(
                "Agent: {} iteration {}/{}",
                self.config.name,
                iteration + 1,
                self.config.max_iterations
            );

            // Build messages in order: system_message -> context_messages -> current_io_state -> tool_usage_history -> user_message
            let mut messages = vec![];
            messages.extend_from_slice(&system_messages);

            // Context messages (refetched each iteration as each iteration may change context through tool calls)
            let context_messages = context_manager.get_context(&io_id)?;
            for context_message in context_messages {
                messages.push(context_message);
            }

            // Current IO state which may change between iterations as well
            let current_io_state = io.read()?;
            if !current_io_state.trim().is_empty() {
                messages.push(Message::new_note(&current_io_state));
            }

            // Tool usage history (accumulated across iterations)
            messages.extend_from_slice(&tool_usage_history);

            // User message (always last)
            messages.push(user_msg.clone());

            let stream = self.client.create_streaming_chat_completion(
                messages,
                &config.model,
                config.custom_key.as_deref(),
                None, // No response format needed for XML
                cancellation_token.clone(),
            )?;

            let response = self.process_streaming_response_xml(stream, io, context_manager)?;

            tracing::debug!("Agent: {}, LLM Response: {}", self.config.name, response);

            match self.parse_xml_response(&response)? {
                LLMResponse::ToolCalls(tool_calls) => {
                    let mut tool_results = Vec::new();

                    for tool_call in tool_calls {
                        let result = self.execute_tool_call(
                            &tool_call,
                            config.execution_id.clone(),
                            config.model.clone(),
                            config.custom_key.clone(),
                            io,
                            context_manager,
                            cancellation_token.clone(),
                        )?;
                        tool_results.push(result);
                    }

                    // Add to persistent tool usage history
                    tool_usage_history.push(Message::new_assistant(&response));
                    for tool_result in tool_results {
                        tool_usage_history
                            .push(Message::new_tool(&tool_result.name, &tool_result.status));
                    }
                }
                LLMResponse::FinalResponse(final_response) => {
                    tracing::info!(
                        "Agent: {}, final response: {}",
                        self.config.name,
                        final_response
                    );
                    return Ok(AgentResult::Success(final_response));
                }
                LLMResponse::ParseError(raw_response) => {
                    if self.config.retry_on_parse_error
                        && iteration < self.config.max_iterations - 1
                    {
                        tracing::warn!(
                            "Parse error on iteration {}, retrying with correction prompt",
                            iteration + 1
                        );

                        // Add to tool usage history for retry
                        tool_usage_history.push(Message::new_assistant(&raw_response));
                        tool_usage_history.push(Message::new_user(
                            "I couldn't parse your previous response. Please provide your response using the specified XML format with proper <final_answer> or <tool_calls> tags."
                        ));
                        continue;
                    } else if self.config.fallback_to_text {
                        tracing::warn!("Parse error, falling back to text response");
                        io.write(&raw_response)?;
                        return Ok(AgentResult::Success(raw_response));
                    } else {
                        let error_msg = format!(
                            "Failed to parse LLM response after {} iterations: {}",
                            iteration + 1,
                            raw_response
                        );
                        return Ok(AgentResult::Error(error_msg));
                    }
                }
            }
        }

        // If we've exhausted all iterations without a final response
        Ok(AgentResult::Error(format!(
            "Agent exceeded maximum iterations ({})",
            self.config.max_iterations
        )))
    }

    fn process_streaming_response_xml(
        &self,
        mut stream: ChatCompletionStream,
        io: &dyn AgentIO,
        context_manager: &dyn ContextManager,
    ) -> BackendResult<String> {
        let mut full_response = String::new();
        let mut current_content = String::new();
        let mut state = StreamingState::WaitingForTag;

        loop {
            match stream.next() {
                Some(result) => match result {
                    Ok(chunk) => {
                        full_response.push_str(&chunk);
                        current_content.push_str(&chunk);

                        self.process_xml_chunk(
                            &mut current_content,
                            &mut state,
                            io,
                            context_manager,
                        )?;
                    }
                    Err(e) => {
                        tracing::error!("Error in streaming chunk: {}", e);
                        return Err(e);
                    }
                },
                None => break,
            }
        }

        Ok(full_response)
    }

    fn process_xml_chunk(
        &self,
        content: &mut String,
        state: &mut StreamingState,
        io: &dyn AgentIO,
        context_manager: &dyn ContextManager,
    ) -> BackendResult<()> {
        loop {
            match state {
                StreamingState::WaitingForTag => {
                    if let Some(start_pos) = content.find("<final_answer>") {
                        *state = StreamingState::InFinalAnswer;
                        // Keep everything after the opening tag
                        *content = content[start_pos + 14..].to_string();
                        // Continue processing in case there's immediate content
                        continue;
                    } else if content.contains("<tool_calls>") {
                        *state = StreamingState::InToolCall {
                            tool_name: None,
                            content: String::new(),
                        };
                        content.clear();
                        break;
                    } else if let Some(start_pos) = content.find("<citation>") {
                        *state = StreamingState::InCitation {
                            buffer: String::new(),
                        };
                        // Keep everything after the opening tag
                        *content = content[start_pos + 10..].to_string();
                        continue;
                    } else {
                        break;
                    }
                }
                StreamingState::InFinalAnswer => {
                    if let Some(end_pos) = content.find("</final_answer>") {
                        let final_content = &content[..end_pos];

                        if self.config.write_final_response_to_io && !final_content.is_empty() {
                            io.write(final_content)?;
                        }
                        *state = StreamingState::Complete;
                        content.clear();
                        break;
                    } else {
                        // Check for citation tags within final answer
                        if let Some(citation_start) = content.find("<citation>") {
                            // Write everything before citation
                            let before_citation = &content[..citation_start];
                            if self.config.write_final_response_to_io && !before_citation.is_empty()
                            {
                                io.write(before_citation)?;
                            }

                            // Switch to citation processing
                            *state = StreamingState::InCitation {
                                buffer: String::new(),
                            };
                            *content = content[citation_start + 10..].to_string();
                            continue;
                        } else {
                            // partial stream case for citations
                            if let Some(last_lt) = content.rfind('<') {
                                let safe_content = &content[..last_lt];
                                if self.config.write_final_response_to_io
                                    && !safe_content.is_empty()
                                {
                                    io.write(safe_content)?;
                                }
                                *content = content[last_lt..].to_string();
                            } else {
                                if self.config.write_final_response_to_io {
                                    io.write(content)?;
                                }
                                content.clear();
                            }
                            break;
                        }
                    }
                }
                StreamingState::InCitation { buffer } => {
                    buffer.push_str(content);

                    match self.try_parse_citation(buffer) {
                        CitationParseResult::Complete {
                            context_id,
                            cited_text,
                            remaining,
                        } => {
                            // We have a complete citation, process it
                            if let (Some(ctx_id), Some(text)) = (context_id, cited_text) {
                                match context_manager.get_citation(&io.get_id(), &ctx_id, &text) {
                                    Ok(citation_result) => {
                                        dbg!(&citation_result);
                                        if self.config.write_final_response_to_io {
                                            io.write(&citation_result)?;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to get citation: {}", e);
                                        if self.config.write_final_response_to_io {
                                            io.write(&text)?;
                                        }
                                    }
                                }
                            }
                            // Handle remaining content
                            *content = remaining;
                            *state = StreamingState::InFinalAnswer;
                            continue;
                        }
                        CitationParseResult::Incomplete => {
                            // Not enough data yet, wait for more
                            content.clear();
                            break;
                        }
                        CitationParseResult::Error(e) => {
                            tracing::warn!("Citation parse error: {}, falling back to raw text", e);
                            // Fall back to writing the raw buffer content
                            if self.config.write_final_response_to_io {
                                io.write(buffer)?;
                            }
                            *state = StreamingState::InFinalAnswer;
                            content.clear();
                            break;
                        }
                    }
                }
                StreamingState::InToolCall { .. } => {
                    if content.contains("</tool_calls>") {
                        *state = StreamingState::Complete;
                    }
                    content.clear();
                    break;
                }
                StreamingState::Complete => {
                    break;
                }
            }
        }

        Ok(())
    }

    fn try_parse_citation(&self, buffer: &str) -> CitationParseResult {
        if !buffer.contains("</citation>") {
            return CitationParseResult::Incomplete;
        }

        let citation_end = match buffer.find("</citation>") {
            Some(pos) => pos,
            None => return CitationParseResult::Incomplete,
        };

        let citation_xml = &buffer[..citation_end];
        let remaining = &buffer[citation_end + 11..]; // 11 = length of "</citation>"

        let wrapped_xml = format!("<root>{}</root>", citation_xml);

        let mut reader = Reader::from_str(&wrapped_xml);
        let mut buf = Vec::new();
        let mut context_id = None;
        let mut cited_text = None;
        let mut current_text = String::new();
        let mut in_context_id = false;
        let mut in_cited_text = false;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => match e.name().as_ref() {
                    b"context_id" => {
                        in_context_id = true;
                        current_text.clear();
                    }
                    b"cited_text" => {
                        in_cited_text = true;
                        current_text.clear();
                    }
                    _ => {}
                },
                Ok(Event::Text(e)) => {
                    if in_context_id || in_cited_text {
                        match e.unescape() {
                            Ok(text) => current_text.push_str(&text),
                            Err(e) => {
                                return CitationParseResult::Error(format!(
                                    "Text decode error: {}",
                                    e
                                ));
                            }
                        }
                    }
                }
                Ok(Event::End(e)) => match e.name().as_ref() {
                    b"context_id" => {
                        context_id = Some(current_text.clone());
                        in_context_id = false;
                        current_text.clear();
                    }
                    b"cited_text" => {
                        cited_text = Some(current_text.clone());
                        in_cited_text = false;
                        current_text.clear();
                    }
                    _ => {}
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    return CitationParseResult::Error(format!("XML parse error: {}", e));
                }
                _ => {}
            }
            buf.clear();
        }

        CitationParseResult::Complete {
            context_id,
            cited_text,
            remaining: remaining.to_string(),
        }
    }

    fn build_system_prompt(
        &self,
        preamble: Option<String>,
        allowed_tools: Option<HashSet<String>>,
        user_facing_final_answer: bool,
    ) -> String {
        let preamble_text = preamble.unwrap_or_default();

        let base_instructions = format!(
            r#"{base_prompt}

The user is editing a main note/document that also tracks your progress and tool outputs. This helps you understand what has been accomplished and what still needs to be done. Pay attention to the document to avoid repeating actions and build upon previous work.

As the user is in a note/document, only provide information that should be put into the document in the <final_answer> tag.

{preamble_text}

"#,
            base_prompt = self.config.system_prompt,
            preamble_text = preamble_text
        );

        // Determine final answer instructions based on the flag
        let final_answer_instructions = if user_facing_final_answer {
            "Your final answer to the user goes here. 
ALWAYS USE HTML TAGS FOR FORMATTING!"
        } else {
            "Keep this brief - just indicate completion (e.g., 'I'm done')"
        };

        if self.tools.is_empty() {
            return format!(
                r#"{base_instructions}

RESPONSE FORMAT:
You must respond using XML tags in one of these formats:

For final responses:

<final_answer>

{final_answer_instructions}

</final_answer>

For tool calls:
<tool_calls>
<tool name="tool_name">
{{"param": "value", "another_param": "value"}}
</tool>
<tool name="another_tool_name">
{{"param": "value"}}
</tool>
</tool_calls>

IMPORTANT:
- Always use the XML format shown above
- Use <final_answer> when the task is complete{formatting_note}
- Use <tool_calls> when you need to execute tools, YOU CAN'T USE THE SAME TOOL TWICE IN A SINGLE ITERATION
- Tool parameters must be valid JSON objects
- You can call multiple tools by including multiple <tool> elements within <tool_calls>
- Citations should reference context message IDs and include the specific text being cited"#,
                final_answer_instructions = final_answer_instructions,
                formatting_note = if user_facing_final_answer {
                    ", ALWAYS USE HTML TAGS FOR FORMATTING!"
                } else {
                    ""
                }
            );
        }

        let tools_description = self.create_tools_description(allowed_tools);

        format!(
            r#"{base_instructions}

AVAILABLE TOOLS:
{tools_description}

RESPONSE FORMAT:
You must respond using XML tags in one of these formats:

For final responses:
<final_answer>
{final_answer_instructions}

</final_answer>

For tool calls:
<tool_calls>
<tool name="tool_name">
{{"param": "value", "another_param": "value"}}
</tool>
<tool name="another_tool_name">
{{"param": "value"}}
</tool>
</tool_calls>


IMPORTANT:
- Always use the XML format shown above
- Use <final_answer> when the task is complete{formatting_note}
- Use <tool_calls> when you need to execute tools, YOU CAN'T USE THE SAME TOOL TWICE IN A SINGLE ITERATION
- Tool parameters must be valid JSON objects within the <tool> tags
- You can call multiple tools by including multiple <tool> elements within <tool_calls>
- Citations should reference context message IDs and include the specific text being cited"#,
            tools_description = tools_description,
            final_answer_instructions = final_answer_instructions,
            formatting_note = if user_facing_final_answer {
                ", ALWAYS USE HTML TAGS FOR FORMATTING!"
            } else {
                ""
            }
        )
    }

    fn create_tools_description(&self, allowed_tools: Option<HashSet<String>>) -> String {
        self.tools
            .values()
            .map(|tool| {
                if let Some(allowed) = &allowed_tools {
                    if !allowed.contains(tool.name()) {
                        return String::new();
                    }
                }
                format!(
                    "- {}: {}\n  Parameters: {}",
                    tool.name(),
                    tool.description(),
                    tool.parameters_schema()
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    fn parse_xml_response(&self, response: &str) -> BackendResult<LLMResponse> {
        // First, try to extract final answer
        if let Some(final_answer) = self.extract_xml_content(response, "final_answer") {
            if !final_answer.trim().is_empty() {
                return Ok(LLMResponse::FinalResponse(final_answer));
            }
        }

        // Then, try to extract tool calls
        if let Some(tool_calls_content) = self.extract_xml_content(response, "tool_calls") {
            let tool_calls = self.parse_tool_calls(&tool_calls_content)?;
            if !tool_calls.is_empty() {
                return Ok(LLMResponse::ToolCalls(tool_calls));
            }
        }

        // If no valid XML found, return parse error
        Ok(LLMResponse::ParseError(response.to_string()))
    }

    fn extract_xml_content(&self, response: &str, tag_name: &str) -> Option<String> {
        let start_tag = format!("<{}>", tag_name);
        let end_tag = format!("</{}>", tag_name);

        if let Some(start_pos) = response.find(&start_tag) {
            let content_start = start_pos + start_tag.len();
            if let Some(end_pos) = response[content_start..].find(&end_tag) {
                let content = &response[content_start..content_start + end_pos];
                return Some(content.to_string());
            }
        }
        None
    }

    fn parse_tool_calls(&self, tool_calls_content: &str) -> BackendResult<Vec<ToolCall>> {
        let mut tool_calls_map: HashMap<String, ToolCall> = HashMap::new();
        let mut reader = Reader::from_str(tool_calls_content);

        let mut buf = Vec::new();
        let mut current_tool_name: Option<String> = None;
        let mut current_tool_content = String::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    if e.name().as_ref() == b"tool" {
                        // Extract tool name from attributes
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"name" {
                                    current_tool_name = Some(
                                        std::str::from_utf8(&attr.value)
                                            .map_err(|e| {
                                                BackendError::GenericError(format!(
                                                    "Invalid UTF-8 in tool name: {}",
                                                    e
                                                ))
                                            })?
                                            .to_string(),
                                    );
                                    break;
                                }
                            }
                        }
                        current_tool_content.clear();
                    }
                }
                Ok(Event::Text(e)) => {
                    if current_tool_name.is_some() {
                        current_tool_content.push_str(&String::from_utf8_lossy(&e.into_inner()))
                    }
                }
                Ok(Event::End(e)) => {
                    if e.name().as_ref() == b"tool" {
                        if let Some(tool_name) = current_tool_name.take() {
                            if !self.tools.contains_key(&tool_name) {
                                tracing::warn!("Tool '{}' not found in available tools", tool_name);
                                continue;
                            }

                            let tool_call = ToolCall {
                                r#type: "function".to_string(),
                                function: FunctionCall {
                                    name: tool_name.clone(),
                                    arguments: current_tool_content.trim().to_string(),
                                },
                            };

                            // Insert or replace - last write wins
                            tool_calls_map.insert(tool_name, tool_call);
                        }
                        current_tool_content.clear();
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("Error parsing XML tool calls: {}", e);
                    break;
                }
                _ => {}
            }
            buf.clear();
        }

        // Convert HashMap values to Vec, preserving insertion order is not guaranteed
        // If you need to preserve order, consider using IndexMap instead
        let tool_calls: Vec<ToolCall> = tool_calls_map.into_values().collect();

        Ok(tool_calls)
    }

    fn execute_tool_call(
        &self,
        tool_call: &ToolCall,
        execution_id: String,
        model: Model,
        custom_key: Option<String>,
        io: &dyn AgentIO,
        context_manager: &mut dyn ContextManager,
        cancellation_token: CancellationToken,
    ) -> BackendResult<ToolResult> {
        let tool = self.tools.get(&tool_call.function.name).ok_or_else(|| {
            BackendError::GenericError(format!("Tool '{}' not found", tool_call.function.name))
        })?;

        let parameters: serde_json::Value =
            match serde_json::from_str(&tool_call.function.arguments) {
                Ok(params) => params,
                Err(parse_error) => {
                    tracing::warn!(
                        "Failed to parse tool arguments: {}, error: {}",
                        tool_call.function.arguments,
                        parse_error
                    );
                    io.write(&format!(
                        "⚠️ Failed to parse arguments for {}: {}",
                        tool_call.function.name, parse_error
                    ))?;
                    return Ok(ToolResult {
                        role: MessageRole::Assistant.to_string(),
                        name: tool_call.function.name.clone(),
                        status: format!("Error: Invalid parameters - {}", parse_error),
                    });
                }
            };

        tracing::debug!("Executing tool: {}", tool_call.function.name);
        tracing::debug!("Parameters: {}", parameters);

        let mut status = "Success".to_string();

        if self.config.write_status_to_io {
            if let Some(exec_msg) = tool.execution_message() {
                io.write_status(StatusMessage::new_status(exec_msg))?;
            }
        }

        match tool.execute(
            parameters,
            execution_id,
            model,
            custom_key,
            io,
            context_manager,
            cancellation_token,
        ) {
            Ok(_) => {
                tracing::info!("Tool '{}' executed successfully", tool_call.function.name);
            }
            Err(e) => {
                tracing::error!("Error executing tool '{}': {}", tool_call.function.name, e);
                status = format!("Error: {}", e);
            }
        }

        Ok(ToolResult {
            role: MessageRole::Assistant.to_string(),
            name: tool_call.function.name.clone(),
            status,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::llm::{client::CancellationToken, models::Message};
    use serde_json::json;
    use std::sync::Arc;
    use tokio;

    // Mock tool for testing
    #[derive(Debug)]
    struct MockTool {
        name: String,
        description: String,
        should_fail: bool,
    }

    impl MockTool {
        fn new(name: &str, description: &str) -> Self {
            Self {
                name: name.to_string(),
                description: description.to_string(),
                should_fail: false,
            }
        }
    }

    impl Tool for MockTool {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            &self.description
        }

        fn execution_message(&self) -> Option<&str> {
            Some("Executing mock tool...")
        }

        fn parameters_schema(&self) -> serde_json::Value {
            json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The query parameter"
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
            _context_manager: &mut dyn ContextManager,
            _cancellation_token: CancellationToken,
        ) -> BackendResult<()> {
            if self.should_fail {
                return Err(BackendError::GenericError(
                    "Tool execution failed".to_string(),
                ));
            }

            let query = parameters
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("default");

            io.write(&format!("Executing {} with query: {}", self.name, query))?;
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_xml_tool_call_parsing() {
        let agent = create_test_agent(vec![], None);

        let response = r#"<tool_calls>
<tool name="search">
{"query": "test query", "limit": 10}
</tool>
</tool_calls>"#;

        match agent.parse_xml_response(response).unwrap() {
            LLMResponse::ToolCalls(calls) => {
                assert_eq!(calls.len(), 1);
                assert_eq!(calls[0].function.name, "search");
                let args: serde_json::Value =
                    serde_json::from_str(&calls[0].function.arguments).unwrap();
                assert_eq!(args["query"], "test query");
                assert_eq!(args["limit"], 10);
            }
            _ => panic!("Expected tool calls"),
        }
    }

    #[tokio::test]
    async fn test_xml_final_answer_parsing() {
        let agent = create_test_agent(vec![], None);

        let response = r#"<final_answer>
This is the final answer to the user's question.
</final_answer>"#;

        match agent.parse_xml_response(response).unwrap() {
            LLMResponse::FinalResponse(answer) => {
                assert_eq!(
                    answer.trim(),
                    "This is the final answer to the user's question."
                );
            }
            _ => panic!("Expected final response"),
        }
    }

    #[tokio::test]
    async fn test_xml_multiple_tool_calls() {
        let agent = create_test_agent(vec![], None);

        let response = r#"<tool_calls>
<tool name="search">
{"query": "first query"}
</tool>
<tool name="process">
{"data": "some data"}
</tool>
</tool_calls>"#;

        match agent.parse_xml_response(response).unwrap() {
            LLMResponse::ToolCalls(calls) => {
                assert_eq!(calls.len(), 2);
                assert_eq!(calls[0].function.name, "search");
                assert_eq!(calls[1].function.name, "process");
            }
            _ => panic!("Expected tool calls"),
        }
    }

    #[tokio::test]
    async fn test_xml_final_answer_with_citation() {
        let agent = create_test_agent(vec![], None);

        let response = r#"<final_answer>
This is some text with a citation <citation>
<context_id>msg123</context_id>
<cited_text>important information</cited_text>
</citation> and more text after.
</final_answer>"#;

        match agent.parse_xml_response(response).unwrap() {
            LLMResponse::FinalResponse(answer) => {
                assert!(answer.contains("citation"));
                assert!(answer.contains("msg123"));
                assert!(answer.contains("important information"));
            }
            _ => panic!("Expected final response"),
        }
    }

    // Helper function for tests
    fn create_test_agent(responses: Vec<String>, config: Option<AgentConfig>) -> Agent {
        let config = config.unwrap_or_default();
        Agent::new(Arc::new(MockLLMClient::new(responses)), config)
    }

    // Note: MockLLMClient would need to be updated to implement streaming
    struct MockLLMClient {
        responses: Vec<String>,
        current_response: std::sync::Mutex<usize>,
    }

    impl MockLLMClient {
        fn new(responses: Vec<String>) -> Self {
            Self {
                responses,
                current_response: std::sync::Mutex::new(0),
            }
        }
    }

    impl ChatCompletionProvider for MockLLMClient {
        fn create_chat_completion(
            &self,
            _messages: Vec<Message>,
            _model: &Model,
            _custom_key: Option<&str>,
            _response_format: Option<serde_json::Value>,
        ) -> BackendResult<String> {
            let mut current = self.current_response.lock().unwrap();
            if *current < self.responses.len() {
                let response = self.responses[*current].clone();
                *current += 1;
                Ok(response)
            } else {
                Ok(r#"<final_answer>Final response</final_answer>"#.to_string())
            }
        }

        fn create_streaming_chat_completion(
            &self,
            _messages: Vec<Message>,
            _model: &Model,
            _custom_key: Option<&str>,
            _response_format: Option<serde_json::Value>,
            _cancellation_token: CancellationToken,
        ) -> BackendResult<ChatCompletionStream> {
            // Mock streaming implementation would be needed here
            unimplemented!("Mock streaming implementation needed for tests")
        }
    }
}
