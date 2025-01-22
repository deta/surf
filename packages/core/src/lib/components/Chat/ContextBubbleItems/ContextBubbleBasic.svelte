<script lang="ts">
  import ContextBubbleItemWrapper, { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import {
    ContextItemIconTypes,
    type ContextItem
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import { Icon } from '@horizon/icons'

  export let item: ContextItem
  export let pillProperties: PillProperties
  export let additionalLabel: string | undefined = undefined

  $: label = item.label
  $: icon = item.icon
</script>

<ContextBubbleItemWrapper
  {item}
  {pillProperties}
  {additionalLabel}
  on:remove-item
  on:select
  on:retry
>
  {#if $icon.type === ContextItemIconTypes.ICON}
    <Icon name={$icon.data} size="20px" />
  {/if}

  <div slot="popover" class="p-4 space-y-2 min-w-48">
    <div class="text-gray-700 dark:text-gray-200 text-sm">Context</div>

    <div class="flex items-center gap-2">
      {#if $icon.type === ContextItemIconTypes.ICON}
        <Icon name={$icon.data} size="20px" />
      {/if}

      <div class="text-gray-900 dark:text-gray-100 text-lg font-medium">{$label}</div>
    </div>
  </div>
</ContextBubbleItemWrapper>
