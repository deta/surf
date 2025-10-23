# MCP Integration in Surf

## Overview
Surf now supports the Model Context Protocol (MCP), enabling connections to external tools and data sources via standard MCP servers. MCP tools become available to the AI across features: chat, smart notes, and surflets.

## Adding MCP Servers

Open Settings → AI → MCP Servers to configure servers. Enabled servers start automatically on launch.

### Popular Servers

#### Filesystem Server
- Install: npm install -g @modelcontextprotocol/server-filesystem
- Example config:
  - Command: mcp-filesystem
  - Args: ["--root", "/"]
  - Transport: stdio
- Tools: read_file, write_file, list_directory, ...

#### GitHub Server
- Requires a GitHub token in env
- Command: mcp-github
- Env: GITHUB_TOKEN=...
- Transport: stdio
- Tools: create_pr, list_issues, search_code, ...

#### Postgres Server
- Command: mcp-postgres
- Env: DATABASE_URL=...
- Transport: stdio
- Tools: query, list_tables, describe_table, ...

### Custom Servers

#### Stdio Transport
- Set Command + Args + Env
- Transport: stdio

#### SSE Transport
- Set URL and optional headers via Env
- Transport: sse

## Import from Claude Desktop

1. Locate claude_desktop_config.json
   - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%\Claude\claude_desktop_config.json
2. In Surf Settings → AI → MCP Servers, click Import Config
3. Select your config file
4. Review imported servers and enable as needed

## Export Configuration
Use Export to save MCP configuration compatible with Claude Desktop format.

## Troubleshooting
- If a server fails to start, verify the command is on PATH and env vars are set.
- For SSE servers, verify the URL is reachable and CORS headers allow SSE.
- Check server logs where applicable; Surf shows connection status updates.
