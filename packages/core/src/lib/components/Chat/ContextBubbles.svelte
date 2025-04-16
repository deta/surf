<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte'
  import { spring } from 'svelte/motion'

  import ContextBubbleImage from './ContextBubbleItems/ContextBubbleImage.svelte'
  import ContextBubbleResource from './ContextBubbleItems/ContextBubbleResource.svelte'
  import ContextBubbleSpace from './ContextBubbleItems/ContextBubbleSpace.svelte'
  import {
    ContextItemActiveSpaceContext,
    ContextItemActiveTab,
    ContextItemPageTab,
    ContextItemResource,
    ContextItemScreenshot,
    ContextItemSpace,
    ContextManager
  } from '@horizon/core/src/lib/service/ai/contextManager'
  import ContextBubbleActiveTab from '@horizon/core/src/lib/components/Chat/ContextBubbleItems/ContextBubbleActiveTab.svelte'
  import ContextBubbleActiveContext from '@horizon/core/src/lib/components/Chat/ContextBubbleItems/ContextBubbleActiveContext.svelte'
  import ContextBubblePageTab from '@horizon/core/src/lib/components/Chat/ContextBubbleItems/ContextBubblePageTab.svelte'
  import ContextBubbleBasic from '@horizon/core/src/lib/components/Chat/ContextBubbleItems/ContextBubbleBasic.svelte'

  export let contextManager: ContextManager

  const contextItems = contextManager.items
  const containerWidth = spring(220, { stiffness: 0.2, damping: 0.7 })

  $: items = $contextItems.filter((item) => item.visibleValue).slice(0, 10)

  let isInitialized = false

  $: pillProperties = spring(
    items.map((_, index) => ({
      x: index * 30,
      y: getSubtleVerticalOffset(),
      rotate: getSubtleRotation(),
      borderRadius: 9,
      textOpacity: 0,
      textBlur: 10,
      textX: -20
    })),
    { stiffness: 0.5, damping: 0.8 }
  )

  async function initializePositions() {
    await tick()
    pillProperties.set(
      items.map((_, index) => ({
        x: index * 30,
        y: getSubtleVerticalOffset(),
        rotate: getSubtleRotation(),
        borderRadius: 9,
        textOpacity: 0,
        textBlur: 10,
        textX: -20
      }))
    )
  }

  function getSubtleVerticalOffset() {
    return (Math.random() * 2 - 1) * 2.5 + 8
  }

  function getSubtleRotation() {
    return 0
  }

  async function resetAnimation() {
    await initializePositions()
  }

  onMount(async () => {
    await initializePositions()
    isInitialized = true
  })

  afterUpdate(async () => {
    if (isInitialized && items.length !== $pillProperties.length) {
      await resetAnimation()
    }
  })
</script>

<div class="relative w-full h-fit" role="none">
  <div
    class="flex items-center -space-x-3 h-fit relative"
    style="width: {$containerWidth}px; min-width: 100%;"
  >
    {#each items as item (item.id)}
      {#if item instanceof ContextItemSpace}
        <ContextBubbleSpace
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if item instanceof ContextItemScreenshot}
        <ContextBubbleImage
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if item instanceof ContextItemResource}
        <ContextBubbleResource
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if item instanceof ContextItemPageTab}
        <ContextBubblePageTab
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if item instanceof ContextItemActiveTab}
        <ContextBubbleActiveTab
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else if item instanceof ContextItemActiveSpaceContext}
        <ContextBubbleActiveContext
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {:else}
        <ContextBubbleBasic
          {item}
          pillProperties={$pillProperties[items.findIndex((p) => p?.id === item?.id)] ?? {}}
          on:remove-item
          on:select
          on:retry
        />
      {/if}
    {/each}
  </div>
</div>

<style lang="scss">
  .relative::-webkit-scrollbar {
    display: none;
  }
</style>
