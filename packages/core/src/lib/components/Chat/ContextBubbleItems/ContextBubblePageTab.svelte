<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import { type ContextItemPageTab } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleResource from './ContextBubbleResource.svelte'
  import ContextBubbleItemPlaceholder from './ContextBubbleItemPlaceholder.svelte'

  export let item: ContextItemPageTab
  export let pillProperties: PillProperties

  $: label = item.label
  $: icon = item.icon
  $: activeItem = item.item

  const dispatch = createEventDispatcher<{ 'remove-item': string }>()

  const handleRemove = () => {
    dispatch('remove-item', item.id)
  }
</script>

{#key $activeItem?.id}
  {#if $activeItem}
    <ContextBubbleResource
      item={$activeItem}
      {pillProperties}
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else}
    <ContextBubbleItemPlaceholder {pillProperties} id={item.id} loading hideRemove />
  {/if}
{/key}
