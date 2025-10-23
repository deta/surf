<script lang="ts">
  import { writable, get } from 'svelte/store'
  import type { MCPServerConfig, MCPTool, UserSettings } from '@deta/types'
  import { Button, FormField, Expandable, openDialog } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { generateID } from '@deta/utils'
  import { createEventDispatcher, onMount } from 'svelte'

  export let userConfigSettings: UserSettings

  const servers = writable<MCPServerConfig[]>([])
  const selectedServer = writable<string | null>(null)
  const isEditing = writable<boolean>(false)
  const statusMessage = writable<string>('')
  const tools = writable<Record<string, MCPTool[]>>({})

  const manifest = writable<MCPTool[]>([])
  const manifestFetched = writable(false)
  const manifestError = writable<string | null>(null)
  const isFetchingManifest = writable(false)
  const selectedManifestTool = writable('')
  const payloadInput = writable('{}')
  const sampleOutput = writable('')
  const sampleError = writable<string | null>(null)
  const sampleRunning = writable(false)

  const dispatch = createEventDispatcher<{ update: void }>()

  $: servers.set(userConfigSettings.mcp_servers)

  const encodeToolKey = (tool: MCPTool) => `${tool.serverId}::${tool.name}`

  const showStatus = (msg: string) => {
    statusMessage.set(msg)
    setTimeout(() => statusMessage.set(''), 3000)
  }

  const handleSave = () => {
    userConfigSettings.mcp_servers = $servers
    dispatch('update')
  }

  const handleAddServer = async () => {
    const newServer: MCPServerConfig = {
      id: generateID(),
      name: 'New Server',
      command: '',
      args: [],
      env: {},
      transport: 'stdio',
      enabled: false
    }
    servers.update((s) => [...s, newServer])
    selectedServer.set(newServer.id)
    isEditing.set(true)
    handleSave()
  }

  const handleUpdateServer = (id: string, updates: Partial<MCPServerConfig>) => {
    servers.update((s) => s.map((server) => (server.id === id ? { ...server, ...updates } : server)))
    handleSave()
  }

  const handleDeleteServer = async (id: string) => {
    const { closeType: confirmed } = await openDialog({
      icon: 'trash',
      title: 'Delete MCP Server',
      message: 'This cannot be undone.',
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    servers.update((s) => s.filter((server) => server.id !== id))
    if ($selectedServer === id) selectedServer.set(null)
    handleSave()
  }

  const handleTestConnection = async (id: string) => {
    // @ts-ignore
    const result = await window.api.testMCPServer(id)
    showStatus(result?.success ? 'Connected successfully' : result?.error || 'Failed to connect')
  }

  const refreshTools = async (id: string) => {
    // @ts-ignore
    const discovered = await window.api.listMCPTools(id)
    tools.update((t) => ({ ...t, [id]: discovered ?? [] }))
  }

  const handleStartServer = async (id: string) => {
    // @ts-ignore
    await window.api.startMCPServer(id)
    await refreshTools(id)
  }
  const handleStopServer = async (id: string) => {
    // @ts-ignore
    await window.api.stopMCPServer(id)
  }

  const handleTryMCP = async (silent = false) => {
    manifestError.set(null)
    sampleError.set(null)
    if (!userConfigSettings.mcp_enabled) {
      manifest.set([])
      manifestFetched.set(false)
      selectedManifestTool.set('')
      if (!silent) showStatus('Enable MCP to discover tools')
      return
    }

    if (typeof window.api?.getMCPToolManifest !== 'function') {
      manifestError.set('Manifest API unavailable in this build.')
      return
    }

    isFetchingManifest.set(true)
    try {
      // @ts-ignore
      const result = await window.api.getMCPToolManifest()
      const toolsList: MCPTool[] = result?.tools ?? []
      manifest.set(toolsList)
      manifestFetched.set(true)
      if (toolsList.length > 0) {
        selectedManifestTool.set(encodeToolKey(toolsList[0]))
        if (!silent) showStatus(`Found ${toolsList.length} MCP tool${toolsList.length === 1 ? '' : 's'}`)
      } else {
        selectedManifestTool.set('')
        if (!silent) showStatus('No MCP tools available yet')
      }
    } catch (error: any) {
      manifestError.set(error?.message ?? String(error))
      manifestFetched.set(false)
      if (!silent) showStatus('Failed to load MCP tools')
    } finally {
      isFetchingManifest.set(false)
    }
  }

  const handleRunSample = async () => {
    sampleError.set(null)
    sampleOutput.set('')

    if (!userConfigSettings.mcp_enabled) {
      sampleError.set('Enable MCP before running a tool.')
      return
    }

    if (typeof window.api?.executeMCPToolForAI !== 'function') {
      sampleError.set('Tool execution API unavailable in this build.')
      return
    }

    const selection = get(selectedManifestTool)
    if (!selection) {
      sampleError.set('Select a tool to execute.')
      return
    }

    const [serverId, ...toolParts] = selection.split('::')
    const toolName = toolParts.join('::')
    if (!serverId || !toolName) {
      sampleError.set('Invalid tool selection.')
      return
    }

    let payload: any = {}
    const payloadText = get(payloadInput)
    if (payloadText?.trim()) {
      try {
        payload = JSON.parse(payloadText)
      } catch (error) {
        sampleError.set('Payload must be valid JSON.')
        return
      }
    }

    sampleRunning.set(true)
    try {
      // @ts-ignore
      const result = await window.api.executeMCPToolForAI(serverId, toolName, payload)
      sampleOutput.set(JSON.stringify(result, null, 2))
      showStatus(result?.success ? 'Tool executed successfully' : result?.error ?? 'Tool execution failed')
    } catch (error: any) {
      sampleError.set(error?.message ?? String(error))
    } finally {
      sampleRunning.set(false)
    }
  }

  onMount(() => {
    if (userConfigSettings.mcp_enabled) {
      handleTryMCP(true)
    }

    // @ts-ignore - listen to status change
    const statusUnsub = window.api.onMcpServerStatusChange?.(({ serverId, status }) => {
      showStatus(`Server ${serverId} status: ${status}`)
    })

    // @ts-ignore - keep manifest in sync when tools are discovered elsewhere
    const toolsUnsub = window.api.onMcpToolsDiscovered?.(({ tools: discovered }) => {
      const discoveredTools: MCPTool[] = discovered ?? []
      manifest.set(discoveredTools)
      manifestFetched.set(true)
      if (discoveredTools.length === 0) {
        selectedManifestTool.set('')
      } else {
        const current = get(selectedManifestTool)
        if (!current) {
          selectedManifestTool.set(encodeToolKey(discoveredTools[0]))
        }
      }
    })

    return () => {
      statusUnsub?.()
      toolsUnsub?.()
    }
  })
</script>

<div class="dev-wrapper">
  <div class="w-full flex items-center justify-between">
    <h2 class="text-xl font-medium">Model Context Protocol (MCP)</h2>
    <div class="flex items-center gap-2">
      <FormField
        label="Enable MCP"
        type="checkbox"
        value={userConfigSettings.mcp_enabled}
        on:save={(e) => {
          userConfigSettings.mcp_enabled = e.detail
          dispatch('update')
        }}
      />
      <Button size="sm" onclick={handleAddServer}>
        <Icon name="add" />
        Add Server
      </Button>
    </div>
  </div>

  {#if !userConfigSettings.mcp_enabled}
    <div class="info-banner warning">
      <Icon name="alert.circle" />
      <span>MCP is disabled. Enable it above to let Surf's AI use your configured tools.</span>
    </div>
  {:else if $manifestError}
    <div class="info-banner danger">
      <Icon name="x.circle" />
      <span>Failed to load MCP tools: {$manifestError}</span>
    </div>
  {:else if $manifestFetched && $manifest.length === 0}
    <div class="info-banner info">
      <Icon name="info" />
      <span>No MCP tools are available yet. Start a server or click “Fetch Tools” below to refresh.</span>
    </div>
  {/if}

  <div class="try-mcp">
    <div class="try-header">
      <div>
        <h3>Quick MCP Test</h3>
        <p class="hint">Fetch the manifest and invoke a tool directly from settings.</p>
      </div>
      <div class="controls">
        <Button size="sm" kind="secondary" onclick={() => handleTryMCP()} disabled={$isFetchingManifest}>
          <Icon name="refresh-ccw" class:spin={$isFetchingManifest} />
          {$isFetchingManifest ? 'Fetching…' : 'Fetch Tools'}
        </Button>
        <Button
          size="sm"
          onclick={handleRunSample}
          disabled={$sampleRunning || !$manifest.length || !userConfigSettings.mcp_enabled}
          title={userConfigSettings.mcp_enabled ? '' : 'Enable MCP to run a tool'}
        >
          <Icon name="play" class:spin={$sampleRunning} />
          {$sampleRunning ? 'Running…' : 'Run Selected Tool'}
        </Button>
      </div>
    </div>

    {#if userConfigSettings.mcp_enabled && $manifest.length > 0}
      <div class="sample-form">
        <label for="mcp-tool-select">Tool</label>
        <select id="mcp-tool-select" bind:value={$selectedManifestTool}>
          <option value="">Select a tool…</option>
          {#each $manifest as tool}
            <option value={encodeToolKey(tool)}>{tool.serverId} — {tool.name}</option>
          {/each}
        </select>
        <label for="mcp-payload">Payload (JSON)</label>
        <textarea id="mcp-payload" rows="5" bind:value={$payloadInput}></textarea>
      </div>
    {/if}

    {#if $sampleError}
      <p class="sample-error">{$sampleError}</p>
    {/if}
    {#if $sampleOutput}
      <pre class="sample-output">{$sampleOutput}</pre>
    {/if}
  </div>

  {#if $servers.length === 0}
    <p class="no-servers">No MCP servers configured. Add a server to get started.</p>
  {:else}
    <div class="server-grid">
      {#each $servers as server}
        <div class="server-card" class:active={$selectedServer === server.id} on:click={() => selectedServer.set(server.id)}>
          <div class="header">
            <span class="name">{server.name}</span>
            <span class="badge">{server.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div class="meta">{server.transport.toUpperCase()}</div>
          <div class="actions">
            <Button size="xs" onclick={(e) => (e.stopPropagation(), handleStartServer(server.id))}>Start</Button>
            <Button size="xs" onclick={(e) => (e.stopPropagation(), handleStopServer(server.id))}>Stop</Button>
            <Button size="xs" onclick={(e) => (e.stopPropagation(), handleTestConnection(server.id))}>Test</Button>
            <Button size="xs" kind="danger" onclick={(e) => (e.stopPropagation(), handleDeleteServer(server.id))}>
              <Icon name="trash" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if $selectedServer}
  {#each $servers.filter((s) => s.id === $selectedServer) as server}
    <div class="dev-wrapper">
      <h3 class="text-lg font-medium">Server Details</h3>
      <div class="provider-config">
        <FormField label="Name" value={server.name} on:save={(e) => handleUpdateServer(server.id, { name: e.detail })} />
        <FormField label="Command" value={server.command} on:save={(e) => handleUpdateServer(server.id, { command: e.detail })} />
        <FormField label="Args (comma-separated)" value={(server.args ?? []).join(', ')} on:save={(e) => handleUpdateServer(server.id, { args: e.detail.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
        <FormField label="Transport" value={server.transport} on:save={(e) => handleUpdateServer(server.id, { transport: e.detail })} />
        {#if server.transport === 'sse'}
          <FormField label="SSE URL" value={server.url ?? ''} on:save={(e) => handleUpdateServer(server.id, { url: e.detail })} />
        {/if}
        <FormField label="Enabled" type="checkbox" value={server.enabled} on:save={(e) => handleUpdateServer(server.id, { enabled: e.detail })} />
      </div>

      <Expandable title="Available Tools" expanded={false}>
        <div class="tools-list">
          {#await refreshTools(server.id)}
            <p>Loading tools…</p>
          {:then}
            {#if ($tools[server.id] || []).length === 0}
              <p>No tools discovered.</p>
            {:else}
              <ul>
                {#each ($tools[server.id] || []) as tool}
                  <li><strong>{tool.name}</strong> — {tool.description}</li>
                {/each}
              </ul>
            {/if}
          {/await}
        </div>
      </Expandable>
    </div>
  {/each}
{/if}

{#if $statusMessage}
  <div class="status-message">
    <Icon name="check.circle" />
    <span>{$statusMessage}</span>
  </div>
{/if}

<style lang="scss">
  .server-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
  }
  .server-card {
    padding: 0.75rem;
    border-radius: 10px;
    border: 1px solid light-dark(rgba(0,0,0,0.07), rgba(255,255,255,0.07));
    background: light-dark(#fff, rgba(255,255,255,0.06));
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    .header { display:flex; align-items:center; justify-content:space-between; }
    .name { font-weight: 600; }
    .badge { font-size: 12px; opacity: 0.7; }
    .meta { font-size: 12px; opacity: 0.6; }
    .actions { display:flex; gap: 0.35rem; }
    &.active { outline: 2px solid var(--accent, #6d82ff); }
  }
  .no-servers { opacity: 0.7; }
  .info-banner {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    font-size: 0.95rem;
  }
  .info-banner.warning {
    background: light-dark(#fef3c7, rgba(250, 204, 21, 0.15));
    color: light-dark(#92400e, #fde68a);
  }
  .info-banner.info {
    background: light-dark(#e0f2fe, rgba(14, 165, 233, 0.15));
    color: light-dark(#075985, #bae6fd);
  }
  .info-banner.danger {
    background: light-dark(#fee2e2, rgba(248, 113, 113, 0.15));
    color: light-dark(#991b1b, #fecaca);
  }
  .try-mcp {
    margin-top: 1.25rem;
    border: 1px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: light-dark(#fafafa, rgba(255, 255, 255, 0.04));
  }
  .try-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .try-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
  .try-mcp .hint { font-size: 0.9rem; opacity: 0.75; margin: 0.2rem 0 0; }
  .try-mcp .controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .sample-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .sample-form select,
  .sample-form textarea {
    width: 100%;
    border: 1px solid light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    padding: 0.5rem 0.65rem;
    background: transparent;
    color: inherit;
    font-family: inherit;
  }
  .sample-error {
    font-size: 0.9rem;
    color: light-dark(#b91c1c, #fca5a5);
  }
  .sample-output {
    background: light-dark(#0f172a, rgba(255, 255, 255, 0.06));
    color: light-dark(#f8fafc, #f8fafc);
    padding: 0.75rem;
    border-radius: 10px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
    font-size: 0.85rem;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .status-message {
    position: fixed; left: 1rem; bottom: 1rem; display:flex; gap:0.5rem; padding: 0.5rem 0.75rem; border-radius: 8px;
    background: light-dark(#ecfdf5, #064e3b); color: light-dark(#065f46, #d1fae5);
  }
</style>
</style>
