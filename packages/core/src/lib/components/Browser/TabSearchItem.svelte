<script lang="ts" context="module">
  export type CMDMenuItem = {
    id: string
    label: string
    shortcut?: string
    description?: string
    type: 'command' | 'tab' | 'suggestion' | 'google-search' | 'history' | 'resource' | 'space'
    icon?: Icons
    iconUrl?: string
    iconColors?: [string, string]
    value?: string // URL or command
    weight?: number
    score?: number
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon, type Icons } from '@horizon/icons'
  import * as Command from '../command'
  import ColorIcon from '../Drawer/ColorIcon.svelte'

  export let item: CMDMenuItem

  const dispatch = createEventDispatcher<{ select: CMDMenuItem }>()

  //   function getItemIcon(item: CMDMenuItem) {
  //     if (item.type === 'tab' || item.type === 'history') {
  //       return (
  //         item.icon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.value!)}`
  //       )
  //     } else if (item.type === 'command') {
  //       return item.icon || 'command' // Default icon for commands
  //     } else if (item.type === 'google-search' || item.type === 'suggestion') {
  //       return 'search' // Icon for Google search and suggestions
  //     }
  //     return 'arrow.right' // Default icon for other types
  //   }

  function handleSelect() {
    dispatch('select', item)
  }
</script>

<Command.Item value={item.id || item.value || item.label} onSelect={handleSelect}>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      {#if item.iconUrl}
        <img src={item.iconUrl} alt="favicon" class="w-4 h-4" />
      {:else if item.iconColors}
        <ColorIcon colors={item.iconColors} class="w-4 h-4" />
      {:else}
        <Icon name={item.icon ?? 'arrow.right'} class="w-4 h-4" />
      {/if}

      <span class="truncate max-w-prose">
        {item.label || item.value}
      </span>
    </div>

    {#if item.shortcut}
      <Command.Shortcut>{item.shortcut}</Command.Shortcut>
    {/if}

    {#if item.description}
      <Command.Description>{item.description}</Command.Description>
    {/if}
  </div>
</Command.Item>
