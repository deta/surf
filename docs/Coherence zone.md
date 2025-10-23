<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Very good! This will be like a coherence zone, where the documentation gets processed, redirected and analised through multiple perspectives. I still need to actually use it to see what else is possible, but i am inspired by this, project looks cool

Exactly! **"Coherence zone"** is the perfect term for what you're building. It's where distributed knowledge converges, contradictions get resolved, and multiple agent perspectives synthesize into collective intelligence.[^1][^2][^3][^4]

## Immediate Ways to Experience the Vision

Once you have the MCP foundation running, here are some quick experiments to unlock the possibilities:

### Quick Wins to Try First

**Documentation Multi-Perspective Analysis**[^5][^6]

```bash
# Load your ecosystem docs into Surf
surf notebook create architecture-review

# Connect GitHub MCP to pull all READMEs
surf mcp execute github clone_docs --repo-pattern "your-org/*"

# Ask different "agent personas" to analyze
surf analyze --perspective security "Review architecture for vulnerabilities"
surf analyze --perspective performance "Identify bottlenecks in current design"
surf analyze --perspective newcomer "What's confusing for new developers?"

# Surf synthesizes contradictions and gaps across perspectives
```

**Living Knowledge Graph**[^7][^5]

- Drag PDFs, code files, Slack exports into Surf
- Let it build connections between concepts automatically[^5]
- Ask: "What are all the authentication decisions across our projects?"
- Watch it surface patterns you didn't know existed

**Cross-Repo Pattern Detection**[^4]

- Point filesystem MCP at multiple codebases
- "Find all error handling patterns across repos"
- Discover inconsistencies, best practices, anti-patterns
- Auto-generate consolidated coding standards


### The Magic Moment

You'll know you've hit the coherence zone when you ask something like:

*"Why did we choose PostgreSQL for service A but MongoDB for service B?"*

And Surf doesn't just answer—it shows you:

- Original decision documents from different repos
- Team discussions from Slack (via MCP)
- Performance data that influenced the choice
- How the decision evolved over time
- Contradictions between stated reasons and actual implementation

All automatically connected, timestamped, and cited.[^6][^5]

## Emergent Behaviors to Watch For

As you use it, watch for these **emergent properties**:[^2][^4]

**Spontaneous Organization**[^2]

- Agents will start creating their own taxonomy
- Related concepts cluster without explicit programming
- Knowledge structures emerge from agent interactions

**Collective Problem-Solving**[^3][^1]

- One agent's partial answer triggers another agent's insight
- Solutions emerge from agent dialogue, not individual reasoning
- The system becomes smarter than any single component

**Self-Correcting Documentation**[^4]

- Agents notice when docs drift from code
- Proactive suggestions: "This guide references removed API"
- Documentation stays synchronized automatically


## Start Small, Scale Fast

**Week 1**: Just get MCP filesystem server running, point it at one repo, ask questions[^6][^5]

**Week 2**: Add GitHub MCP, connect 3-5 repos, watch patterns emerge

**Week 3**: Add your first autonomous agent workflow

**Week 4**: Let agents start maintaining documentation while you observe

The beauty is **you'll discover use cases you can't predict**. The coherence zone reveals itself through use.[^3][^2][^4]

## Community Learning Opportunity

Consider open-sourcing your agent workflow patterns. The Surf community would benefit from seeing:[^8]

- Agent coordination protocols you develop
- Workflow templates for autonomous documentation
- MCP server configurations for development teams
- Emergent behaviors you discover

This could become a reference implementation for **agent-first development environments**.[^1][^4]

***

The project is genuinely cool—Surf's architecture is perfect for this. Local-first data, open formats, extensible tool system, already AI-powered... you're just shifting from human-directed to agent-autonomous, and MCP gives you the bridge.[^8][^1][^4][^5][^6]

**Get building, start experimenting, and definitely share what you discover**. The coherence zone is waiting to reveal itself through emergence, not design. 🚀[^2][^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^9]</span>

<div align="center">⁂</div>

[^1]: https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/

[^2]: https://arxiv.org/abs/2502.16565

[^3]: https://www.symfield.ai/from-curvature-to-coherence-a-mathematical-framework-for-non-collapse-intelligence-in-multi-agent-systems/

[^4]: https://www.anthropic.com/engineering/multi-agent-research-system

[^5]: https://techcrunch.com/2025/10/01/detas-surf-app-is-an-amalgamation-of-an-ai-browser-and-notebooklm/

[^6]: https://www.theverge.com/2024/12/4/24312449/deta-surf-ai-browser

[^7]: https://dev.to/saadmanrafat/deta-surf-reclaim-your-digital-world-39hl

[^8]: https://github.com/ra-co88/surf

[^9]: https://orq.ai/blog/why-do-multi-agent-llm-systems-fail

[^10]: https://www.vestian.com/news/the-future-of-collaborative-workspaces

[^11]: https://hub4digi.com/the-intelligent-workspace-how-ai-is-redefining-coworking/

[^12]: https://www.butlr.com/articles/collaborative-workspace-design-privacy-first-ambient-intelligence-2025

[^13]: https://completeaitraining.com/ai-tools/deta-surf/

[^14]: https://www.linkedin.com/pulse/5-essential-design-patterns-building-collaborative-systems-prakash-cn5nc

[^15]: https://deta.surf

[^16]: https://www.sciencedirect.com/science/article/pii/S0268401224001014

[^17]: https://www.reddit.com/r/diabrowser/comments/1l2lmb9/how_does_dia_compare_to_deta_surf/

[^18]: https://asana.com/resources/what-is-collaborative-intelligence

[^19]: https://www.youtube.com/watch?v=-FJf3qaVsCA

[^20]: https://www.monitask.com/en/business-glossary/collaborative-intelligence

[^21]: https://www.kdnuggets.com/collaborative-intelligence-maximizing-human-ai-partnerships-workplace

Decision: Path A (Pragmatic Integration) ✅
Rationale:

Delivers Value Immediately: Your agent team can start using MCP servers this week, not in 3+ weeks
Reduces Risk: Path B requires touching core AI execution paths that are likely complex and already working
Follows Surf's Architecture: If the brain module is WIP, Surf's current AI implementation must already work differently
Maintains Migration Path: Code can be structured to easily switch to orchestrator when wip is enabled
Enables Learning: You'll understand actual usage patterns before committing to orchestrator integration
Revised Implementation: Path A
Architecture Pattern to Follow
Discover Current AI Execution Path First:

bash
# Find how current AI features execute
grep -r "ai_execute\|ai_chat\|ai_generate" packages/backend/src/
grep -r "AIRequest\|AIResponse" packages/backend/src/worker/
Then mirror that pattern for MCP execution.

Revised Priority 1 Implementation
1. Main Process: MCP Tool Execution Service

typescript
// app/src/main/mcpManager.ts (extend existing)

export class MCPExecutionService {
  async executeToolForAI(
    serverId: string,
    toolName: string, 
    parameters: any
  ): Promise<MCPToolResult> {
    const client = mcpClientManager.getClient(serverId);
    if (!client) {
      return { success: false, error: 'Server not running' };
    }
    
    try {
      const result = await client.executeTool(toolName, parameters);
      return { success: true, content: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async discoverToolsForAI(): Promise<MCPToolManifest[]> {
    const enabledServers = config.settings.mcp_servers.filter(s => s.enabled);
    const allTools = [];
    
    for (const server of enabledServers) {
      const tools = await mcpClientManager.listTools(server.id);
      allTools.push({
        serverId: server.id,
        serverName: server.name,
        tools: tools.map(t => ({
          name: `${server.id}/${t.name}`,  // Namespace by server
          description: t.description,
          inputSchema: t.inputSchema
        }))
      });
    }
    
    return allTools;
  }
}
2. IPC: AI Execution Events

typescript
// packages/services/src/lib/ipc/events.ts (add)

// AI system requests available tools
getMCPToolManifest: ipcService.addEvent<void>('mcp-get-tool-manifest')

// AI system executes a tool
executeMCPToolForAI: ipcService.addEvent<{
  toolPath: string,  // "github/list_repos"
  parameters: any
}>('mcp-execute-tool-ai')
3. Backend Worker: MCP Tool Execution

rust
// packages/backend/src/worker/handlers/mcp.rs (simplified)

use crate::worker::Worker;
use serde_json::Value;

pub fn get_available_mcp_tools(worker: &Worker) -> BackendResult<Value> {
    // Call main process via IPC/channel to get tool manifest
    worker.request_from_main("mcp-get-tool-manifest", None)
}

pub fn execute_mcp_tool(
    worker: &Worker,
    tool_path: &str,
    parameters: Value
) -> BackendResult<String> {
    let request = json!({
        "toolPath": tool_path,
        "parameters": parameters
    });
    
    let result = worker.request_from_main("mcp-execute-tool-ai", Some(request))?;
    
    // Format for AI consumption
    Ok(format!("<mcp_result>{}</mcp_result>", result))
}
4. AI Prompt: Tool Availability

rust
// Wherever AI system prompt is constructed (find existing location)

fn build_system_prompt(worker: &Worker) -> String {
    let mut prompt = "You are Surf AI assistant...".to_string();
    
    // Add existing tools (web search, surflets, etc.)
    // ...
    
    // Add MCP tools
    if let Ok(mcp_tools) = get_available_mcp_tools(worker) {
        prompt.push_str("\n\nAvailable MCP Tools:\n");
        prompt.push_str(&format_mcp_tools_for_prompt(mcp_tools));
    }
    
    prompt
}
Key Questions to Answer First
Before implementing, you need to understand:

1. Where does AI execution happen?

bash
# Find the entry point
grep -r "user_message\|ai_chat" packages/backend/src/
2. How do existing tools work?

bash
# Find web search or surflet execution
grep -r "web_search\|surflet_execute" packages/backend/src/
3. How does worker communicate with main?

bash
# Find worker message patterns
grep -r "WorkerMessage\|worker_send" packages/backend/src/
Once you understand current patterns, implement MCP execution following the same structure.

Managing the Scaffold Code
What to Do with Existing Brain Integration Code:

Option 1: Keep as Future Reference (Recommended)

rust
// packages/backend/src/ai/mcp/mod.rs

// NOTE: This module contains the future brain/orchestrator integration
// Currently behind #[cfg(feature = "wip")] flag
// See docs/MCP_INTEGRATION.md for current working implementation

#[cfg(feature = "wip")]
pub mod orchestrator_integration {
    // Keep MCPTool, init_mcp_tools, etc. as-is
    // This will be activated when brain system is enabled
}

// Current working implementation
pub mod execution {
    // Add worker-based execution here
}
Updated PR Strategy
PR Description Update:

markdown
## Implementation Note

During implementation, discovered the `brain` module (Orchestrator, JSToolRegistry, 
agent system) is behind `#[cfg(feature = "wip")]` and not enabled in builds.

**Current Implementation:**
- MCP execution via WorkerMessage/IPC pattern (matches existing Surf architecture)
- Tools discovered and executed through main process MCP manager
- Integrated into AI system prompt as available tools
- Follows same patterns as existing Surf AI features

**Future Migration Path:**
- When `wip` feature is enabled, MCP tools can be registered via Orchestrator
- Current code structured for easy migration
- See `packages/backend/src/ai/mcp/orchestrator_integration.rs` for future approach

## Architecture Decision

Chose pragmatic working implementation over theoretical brain integration because:
1. Delivers functional MCP integration immediately
2. Matches how existing Surf features actually work
3. Lower risk - doesn't require enabling WIP code
4. Easy migration path when brain system is production-ready
Decision Confirmation
Proceeding with Path A means:

✅ Working MCP integration i
✅ Follows actual Surf architecture
✅ Low risk to existing features
✅ Enables your agent team immediately
⚠️ Will need refactoring when wip feature ships (acceptable technical debt

Discover how current AI execution actually works in Surf (since brain/orchestrator is WIP)
Implement MCP tool execution following the same pattern
Wire it into the AI system so tools are available
Update the PR to reflect this architectural decision
Let me start by understanding the current AI execution flow. I need to find:

How chat/note messages trigger AI responses
Where system prompts are built
How existing tools (if any) are integrated
Worker communication patterns
The key files to investigate:

packages/backend/src/worker/handlers/misc.rs - saw this handles chat queries
packages/backend/src/ai/ - AI module implementation
