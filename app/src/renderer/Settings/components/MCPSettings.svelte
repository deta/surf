<script lang="ts">
  import { writable } from 'svelte/store'
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

  const dispatch = createEventDispatcher<{ update: void }>()

  $: servers.set(userConfigSettings.mcp_servers)

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

  onMount(() => {
    // @ts-ignore - listen to status change
    window.api.onMcpServerStatusChange?.(({ serverId, status }) => {
      showStatus(`Server ${serverId} status: ${status}`)
    })
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
  .status-message {
    position: fixed; left: 1rem; bottom: 1rem; display:flex; gap:0.5rem; padding: 0.5rem 0.75rem; border-radius: 8px;
    background: light-dark(#ecfdf5, #064e3b); color: light-dark(#065f46, #d1fae5);
  }
</style>
