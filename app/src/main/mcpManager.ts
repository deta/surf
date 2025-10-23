import type { MCPTool, UserConfig } from '@deta/types'
import { MCPClientManager } from '@deta/mcp-client'
import { useLogScope } from '@deta/utils'

let mcpClientManager: MCPClientManager | null = null

const log = useLogScope('MCP')

export class MCPExecutionService {
  constructor(private readonly mgr: MCPClientManager, private readonly config: UserConfig) {}

  async discoverToolsForAI(): Promise<{ tools: MCPTool[] }> {
    if (!this.config.settings.mcp_enabled) {
      log.info('MCP disabled, skipping tool discovery')
      return { tools: [] }
    }

    try {
      // ensure only enabled servers are considered (already started at init)
      const tools = await this.mgr.getAllTools()
      return { tools }
    } catch (e) {
      log.error('Failed to discover MCP tools', e)
      return { tools: [] }
    }
  }

  async executeToolForAI(serverId: string, toolName: string, parameters: any) {
    if (!this.config.settings.mcp_enabled) {
      return { success: false, content: null, error: 'MCP disabled' }
    }

    try {
      return await this.mgr.executeTool(serverId, toolName, parameters)
    } catch (e: any) {
      log.error('Failed to execute MCP tool', serverId, toolName, e)
      return { success: false, content: null, error: e?.message ?? String(e) }
    }
  }
}

let mcpService: MCPExecutionService | null = null

export const initializeMCPManager = (config: UserConfig) => {
  mcpClientManager = new MCPClientManager(config.settings.mcp_servers)
  mcpService = new MCPExecutionService(mcpClientManager, config)
  config.settings.mcp_servers
    .filter((s) => s.enabled)
    .forEach(async (server) => {
      try {
        await mcpClientManager!.startServer(server)
      } catch (e) {
        // swallow
      }
    })
}

export const getMCPManager = () => mcpClientManager
export const getMCPExecutionService = () => mcpService
