use std::collections::HashMap;

use super::MCPTool;

pub struct MCPToolRegistry {
    tools: HashMap<String, Box<MCPTool>>,
}

impl MCPToolRegistry {
    pub fn new() -> Self { Self { tools: HashMap::new() } }
    pub fn register_tool(&mut self, tool: MCPTool) { self.tools.insert(tool.name.clone(), Box::new(tool)); }
    pub fn get_tool(&self, name: &str) -> Option<&MCPTool> { self.tools.get(name).map(|b| b.as_ref()) }
    pub fn list_tools(&self) -> Vec<&MCPTool> { self.tools.values().map(|b| b.as_ref()).collect() }
}
