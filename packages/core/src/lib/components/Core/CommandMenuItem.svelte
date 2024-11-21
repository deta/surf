<script lang="ts" context="module">
  export type CMDMenuItem = {
    id: string
    label: string
    shortcut?: string
    description?: string
    type:
      | 'command'
      | 'tab'
      | 'suggestion'
      | 'suggestion-hostname'
      | 'google-search'
      | 'history'
      | 'resource'
      | 'space'
      | 'navigate'
      | 'general-search'
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
  import * as Command from '../Command'
  import ColorIcon from '../Atoms/ColorIcon.svelte'

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

  function getDescriptionFromType(type: CMDMenuItem['type']) {
    switch (type) {
      case 'command':
        return 'Action'
      case 'tab':
        return 'Tab'
      case 'suggestion':
      case 'suggestion-hostname':
        return 'Suggestion'
      case 'google-search':
        return 'Google Search'
      case 'history':
        return 'History'
      case 'resource':
        return 'Resource'
      case 'space':
        return 'Space'
      case 'navigate':
        return 'Navigate'
      case 'general-search':
        return 'Search the web'
      default:
        return ''
    }
  }

  function handleSelect() {
    dispatch('select', item)
  }
</script>

<Command.Item value={item.id || item.value || item.label} onSelect={handleSelect}>
  <div class="flex items-center justify-between gap-3 w-full group">
    <div class="flex items-center gap-2 flex-grow min-w-0">
      {#if item.iconUrl}
        <img src={item.iconUrl} alt="favicon" class="w-4 h-4 flex-shrink-0" />
      {:else if item.iconColors}
        <div class="color-icon-wrapper w-fit h-fit flex-shrink-0">
          <ColorIcon colors={item.iconColors} />
        </div>
      {:else}
        <Icon name={item.icon ?? 'arrow.right'} class="w-4 h-4 flex-shrink-0" />
      {/if}

      <span class="truncate flex-grow min-w-0">
        {item.label || item.value}
      </span>
    </div>

    {#if item.shortcut}
      <Command.Shortcut class="flex-shrink-0 bg-gray-100 rounded-lg p-1"
        >{item.shortcut}</Command.Shortcut
      >
    {/if}

    <Command.Description class="flex-shrink-0"
      >{item.description ?? getDescriptionFromType(item.type)}</Command.Description
    >
  </div>
</Command.Item>
