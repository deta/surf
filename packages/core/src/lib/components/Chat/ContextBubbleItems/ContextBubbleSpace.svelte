<script lang="ts">
  import { Icon } from '@horizon/icons'
  import ContextBubbleItemWrapper from './ContextBubbleItemWrapper.svelte'
  import SpaceIcon from '../../Atoms/SpaceIcon.svelte'
  import type { ContextItemSpace } from '@horizon/core/src/lib/service/ai/contextManager'

  export let item: ContextItemSpace
  export let additionalLabel: string | undefined = undefined
  export let loading: boolean = false

  $: label = item.label
</script>

<ContextBubbleItemWrapper {item} {additionalLabel} {loading} on:remove-item on:select on:retry>
  {#if loading}
    <Icon name="spinner" size="'1.2em" />
  {:else}
    <SpaceIcon folder={item.data} interactive={false} />
  {/if}

  <div slot="popover" class="p-4 space-y-2 min-w-48">
    <div class="text-gray-700 dark:text-gray-200 text-sm">Context</div>

    <div class="flex items-center gap-2">
      <div class="w-6 h-6">
        <SpaceIcon folder={item.data} interactive={false} />
      </div>

      <div class="text-gray-900 dark:text-gray-100 text-lg font-medium">{$label}</div>
    </div>
  </div>
</ContextBubbleItemWrapper>
