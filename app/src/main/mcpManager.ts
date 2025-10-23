import type { UserConfig } from '@deta/types'
import { MCPClientManager } from '@deta/mcp-client'

let mcpClientManager: MCPClientManager | null = null

export const initializeMCPManager = (config: UserConfig) => {
  mcpClientManager = new MCPClientManager(config.settings.mcp_servers)
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
