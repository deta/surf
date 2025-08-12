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
    data?: OasisSpace['data']
    value?: string // URL or command
    weight?: number
    score?: number
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon, DynamicIcon, type Icons } from '@deta/icons'
  import * as Command from '../Command'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let item: CMDMenuItem

  $: itemData = item.data

  const dispatch = createEventDispatcher<{ select: CMDMenuItem }>()

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
        return 'Context'
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
      {:else if item.type === 'space' && itemData}
        {#if $itemData?.imageIcon}
          <img src={$itemData?.imageIcon} alt="icon" class="w-4 h-4 flex-shrink-0 rounded-sm" />
        {:else if $itemData?.emoji}
          <span class="text-lg">{$itemData?.emoji}</span>
        {:else if $itemData?.colors}
          <div class="color-icon-wrapper w-fit h-fit flex-shrink-0">
            <DynamicIcon name="colors;;{$itemData?.colors}" />
          </div>
        {/if}
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
