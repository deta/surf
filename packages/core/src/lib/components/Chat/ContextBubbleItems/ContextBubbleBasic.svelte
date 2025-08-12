<script lang="ts">
  import ContextBubbleItemWrapper from './ContextBubbleItemWrapper.svelte'
  import { ContextItemTypes } from '@horizon/core/src/lib/service/ai/contextManager'
  import {
    ContextItemIconTypes,
    type ContextItem
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { Icon } from '@deta/icons'

  export let item: ContextItem
  export let additionalLabel: string | undefined = undefined

  $: label = item.label
  $: icon = item.icon

  $: if (item.type === ContextItemTypes.WIKIPEDIA) {
    additionalLabel = 'Wikipedia Search'
  } else if (item.type === ContextItemTypes.BROWSING_HISTORY) {
    additionalLabel = 'Browsing History'
  }
</script>

<ContextBubbleItemWrapper {item} {additionalLabel} on:remove-item on:select on:retry>
  {#if $icon.type === ContextItemIconTypes.ICON}
    <Icon name={$icon.data} size="20px" />
  {:else if $icon.type === ContextItemIconTypes.IMAGE}
    <img src={$icon.data} alt="icon" class="w-5 h-5 flex-shrink-0" />
  {/if}

  <div slot="popover" class="p-4 space-y-2 min-w-48">
    <div class="text-gray-700 dark:text-gray-200 text-sm">Context</div>

    <div class="flex items-center gap-2">
      {#if $icon.type === ContextItemIconTypes.ICON}
        <Icon name={$icon.data} size="20px" />
      {:else if $icon.type === ContextItemIconTypes.IMAGE}
        <img src={$icon.data} alt="icon" class="w-5 h-5 flex-shrink-0" />
      {/if}

      <div class="text-gray-900 dark:text-gray-100 text-lg font-medium">{$label}</div>
    </div>
  </div>
</ContextBubbleItemWrapper>
