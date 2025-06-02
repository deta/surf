<script lang="ts">
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
  import { isEmpty } from 'lodash'
  import { startingClass } from '../../utils/dom'

  export let contextManager: ContextManager
  export let layout: 'floaty' | 'bottom' = 'bottom'

  const contextItems = contextManager.items

  $: items = $contextItems.filter((item) => item.visibleValue).slice(0, 10)

  const DELAY = 30
</script>

<div
  class="flex items-center h-fit relative overflow-x-auto overflow-y-visible {layout} pr-4"
  style="overflow-clip-margin: 2px;"
  class:isEmpty={isEmpty(items)}
>
  {#each items as item, i (item.id)}
    {@const idx = i}
    {#if item instanceof ContextItemSpace}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleSpace {item} on:remove-item on:select on:retry />
      </div>
    {:else if item instanceof ContextItemScreenshot}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleImage {item} on:remove-item on:select on:retry />
      </div>
    {:else if item instanceof ContextItemResource}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleResource {item} on:remove-item on:select on:retry />
      </div>
    {:else if item instanceof ContextItemPageTab}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubblePageTab {item} on:remove-item on:select on:retry />
      </div>
    {:else if item instanceof ContextItemActiveTab}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleActiveTab {item} on:remove-item on:select on:retry />
      </div>
    {:else if item instanceof ContextItemActiveSpaceContext}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleActiveContext {item} on:remove-item on:select on:retry />
      </div>
    {:else}
      <div
        class="bubble-wrapper"
        style="--i: {i};--delay: {(idx + 0) * DELAY}ms;"
        use:startingClass={{}}
      >
        <ContextBubbleBasic {item} on:remove-item on:select on:retry />
      </div>
    {/if}
  {/each}
</div>

<style lang="scss">
  .relative::-webkit-scrollbar {
    display: none;
  }

  .floaty .bubble-wrapper {
    &:global(._starting) {
      opacity: 0 !important;
      --offset-x: -1px;
      --offset-y: -4px;
    }
  }
  .bottom .bubble-wrapper {
    &:global(._starting) {
      opacity: 0 !important;
      --offset-x: -1px;
      --offset-y: 4px;
    }
  }

  .bubble-wrapper {
    transition-property: transform, opacity;
    transition-duration: 123ms;
    transition-delay: var(--delay, 0ms);
    transition-timing-function: ease-out;

    --scale: 1;
    --offset-x: 0px;
    --offset-y: 0px;

    opacity: 1;
    flex-shrink: 0;
    border-radius: 16px;

    transform-origin: left center;
    transform: translate(var(--offset-x), var(--offset-y)) scale(var(--scale));

    &:hover {
      z-index: 999;
      --offset-y: -0.5px;
    }
  }
</style>
