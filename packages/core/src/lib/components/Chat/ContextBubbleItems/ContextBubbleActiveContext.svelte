<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import {
    type ContextItemActiveSpaceContext,
    ContextItemSpace
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleSpace from './ContextBubbleSpace.svelte'
  import ContextBubbleItemPlaceholder from './ContextBubbleItemPlaceholder.svelte'

  export let item: ContextItemActiveSpaceContext

  $: activeItem = item.item

  const dispatch = createEventDispatcher<{ 'remove-item': string }>()

  const handleRemove = () => {
    dispatch('remove-item', item.id)
  }
</script>

{#key $activeItem?.id}
  {#if $activeItem instanceof ContextItemSpace}
    <ContextBubbleSpace
      item={$activeItem}
      additionalLabel="Active Context"
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else}
    <ContextBubbleItemPlaceholder
      id={item.id}
      icon="circle-dot"
      additionalLabel="Active Context"
      on:remove-item={handleRemove}
    />
  {/if}
{/key}
