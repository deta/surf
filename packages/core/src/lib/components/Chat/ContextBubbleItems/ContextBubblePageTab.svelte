<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { type ContextItemPageTab } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleResource from './ContextBubbleResource.svelte'
  import ContextBubbleItemPlaceholder from './ContextBubbleItemPlaceholder.svelte'

  export let item: ContextItemPageTab

  $: activeItem = item.item

  const dispatch = createEventDispatcher<{ 'remove-item': string }>()

  const handleRemove = () => {
    dispatch('remove-item', item.id)
  }
</script>

{#key $activeItem?.id}
  {#if $activeItem}
    <ContextBubbleResource item={$activeItem} on:remove-item={handleRemove} on:select on:retry />
  {:else}
    <ContextBubbleItemPlaceholder id={item.id} loading hideRemove />
  {/if}
{/key}
