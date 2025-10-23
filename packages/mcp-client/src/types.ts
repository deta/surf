export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  transport: 'stdio' | 'sse'
  enabled: boolean
  url?: string
}

export interface MCPTool {
  serverId: string
  name: string
  description: string
  inputSchema: any
}

export interface MCPToolResult {
  success: boolean
  content: any
  error?: string
}
