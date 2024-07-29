<script lang="ts" context="module">
  export type CMDMenuItem = {
    id: string
    label: string
    shortcut?: string
    type: 'command' | 'tab' | 'suggestion' | 'google-search' | 'placeholder' | 'history'
    icon: string
    value?: string // URL or command
    weight?: number
    score?: number
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import * as Command from '../command'

  export let item: CMDMenuItem

  const dispatch = createEventDispatcher<{ select: CMDMenuItem }>()

  function getItemIcon(item: CMDMenuItem) {
    if (item.type === 'tab' || item.type === 'history') {
      return (
        item.icon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.url)}`
      )
    } else if (item.type === 'command') {
      return item.icon || 'command' // Default icon for commands
    } else if (item.type === 'google-search' || item.type === 'suggestion') {
      return 'search' // Icon for Google search and suggestions
    }
    return 'arrow.right' // Default icon for other types
  }

  function handleSelect() {
    dispatch('select', item)
  }
</script>

<Command.Item value={item.id || item.value || item.label} onSelect={handleSelect}>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      {#if item.type === 'tab' || item.type === 'history'}
        <img src={getItemIcon(item)} alt="favicon" class="w-4 h-4" />
      {:else}
        <Icon name={getItemIcon(item)} class="w-4 h-4" />
      {/if}
      <span class="truncate max-w-prose">
        {item.label || item.value}
      </span>
    </div>
    {#if item.shortcut}
      <Command.Shortcut>{item.shortcut}</Command.Shortcut>
    {/if}
  </div>
</Command.Item>
