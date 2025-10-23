import type { MCPServerConfig, MCPTool, MCPToolResult } from './types'
import { createClient, StdioClientTransport, SSEClientTransport } from '@modelcontextprotocol/sdk/client'

export class MCPClientManager {
  private servers = new Map<string, ReturnType<typeof createClient>>()
  private serverConfigs = new Map<string, MCPServerConfig>()

  constructor(initialServers: MCPServerConfig[] = []) {
    initialServers.forEach((s) => this.serverConfigs.set(s.id, s))
  }

  setServers(configs: MCPServerConfig[]) {
    this.serverConfigs.clear()
    configs.forEach((c) => this.serverConfigs.set(c.id, c))
  }

  async startServer(server: MCPServerConfig | string) {
    const cfg = typeof server === 'string' ? this.serverConfigs.get(server) : server
    if (!cfg) throw new Error('Server not found')
    if (this.servers.has(cfg.id)) return

    if (cfg.transport === 'stdio') {
      const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env
      })
      const client = createClient({ name: 'surf', version: '0.1.0' }, { capabilities: {} }, transport)
      await client.connect()
      this.servers.set(cfg.id, client)
    } else if (cfg.transport === 'sse') {
      if (!cfg.url) throw new Error('SSE URL required')
      const transport = new SSEClientTransport({ url: cfg.url, headers: cfg.env as any })
      const client = createClient({ name: 'surf', version: '0.1.0' }, { capabilities: {} }, transport)
      await client.connect()
      this.servers.set(cfg.id, client)
    }
  }

  async stopServer(serverId: string) {
    const client = this.servers.get(serverId)
    if (client) {
      await client.close()
      this.servers.delete(serverId)
    }
  }

  async restartServer(serverId: string) {
    await this.stopServer(serverId)
    const cfg = this.serverConfigs.get(serverId)
    if (!cfg) throw new Error('Server not found')
    await this.startServer(cfg)
  }

  listServers(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values())
  }

  async getServerTools(serverId: string): Promise<MCPTool[]> {
    const client = this.servers.get(serverId)
    if (!client) throw new Error('Server not running')
    const tools = await client.listTools()
    return tools.tools.map((t) => ({
      serverId,
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? { type: 'object' }
    }))
  }

  async getAllTools(): Promise<MCPTool[]> {
    const entries = Array.from(this.servers.keys())
    const all: MCPTool[] = []
    for (const id of entries) {
      try {
        const tools = await this.getServerTools(id)
        all.push(...tools)
      } catch {}
    }
    return all
  }

  async executeTool(serverId: string, toolName: string, parameters: any): Promise<MCPToolResult> {
    const client = this.servers.get(serverId)
    if (!client) throw new Error('Server not running')
    try {
      const result = await client.callTool({ name: toolName, arguments: parameters })
      return { success: true, content: result }
    } catch (err: any) {
      return { success: false, content: null, error: err?.message ?? String(err) }
    }
  }
}
