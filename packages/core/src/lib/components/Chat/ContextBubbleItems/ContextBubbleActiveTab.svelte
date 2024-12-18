<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { type PillProperties } from './ContextBubbleItemWrapper.svelte'
  import {
    ContextItemResource,
    ContextItemSpace,
    type ContextItemActiveTab
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleSpace from './ContextBubbleSpace.svelte'
  import ContextBubbleResource from './ContextBubbleResource.svelte'
  import ContextBubbleItemPlaceholder from './ContextBubbleItemPlaceholder.svelte'

  export let item: ContextItemActiveTab
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
  {#if $activeItem instanceof ContextItemSpace}
    <ContextBubbleSpace
      item={$activeItem}
      {pillProperties}
      additionalLabel="Active Tab"
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else if $activeItem instanceof ContextItemResource}
    <ContextBubbleResource
      item={$activeItem}
      {pillProperties}
      additionalLabel="Active Tab"
      on:remove-item={handleRemove}
      on:select
      on:retry
    />
  {:else}
    <ContextBubbleItemPlaceholder
      id={item.id}
      {pillProperties}
      additionalLabel="No Active Tab"
      on:remove-item={handleRemove}
    />
  {/if}
{/key}
