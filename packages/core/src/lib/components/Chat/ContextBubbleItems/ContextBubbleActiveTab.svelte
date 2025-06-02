<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import {
    ContextItemResource,
    ContextItemSpace,
    type ContextItemActiveTab
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleSpace from './ContextBubbleSpace.svelte'
  import ContextBubbleResource from './ContextBubbleResource.svelte'
  import ContextBubbleItemPlaceholder from './ContextBubbleItemPlaceholder.svelte'

  export let item: ContextItemActiveTab

  $: activeItem = item.item
  $: loading = item.loading

  const dispatch = createEventDispatcher<{ 'remove-item': string }>()

  const handleRemove = () => {
    dispatch('remove-item', item.id)
  }
</script>

{#key $activeItem?.id}
  {#if $activeItem instanceof ContextItemSpace}
    <ContextBubbleSpace
      item={$activeItem}
      additionalLabel="Active Tab"
      loading={$loading}
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else if $activeItem instanceof ContextItemResource}
    <ContextBubbleResource
      item={$activeItem}
      additionalLabel="Active Tab"
      loading={$loading}
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else}
    <ContextBubbleItemPlaceholder
      id={item.id}
      loading={$loading}
      additionalLabel={$loading ? 'Active Tab' : 'No Active Tab'}
      on:remove-item={handleRemove}
    />
  {/if}
{/key}
