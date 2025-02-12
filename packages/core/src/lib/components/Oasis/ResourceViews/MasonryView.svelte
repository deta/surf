<script lang="ts" context="module">
  export interface MasonryItem {
    id: string
    data: any
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { useThrottle } from '@horizon/utils'

  import { selection } from '../utils/select'
  import { flip } from 'svelte/animate'
  import { expoOut } from 'svelte/easing'

  export let items: MasonryItem[] = []

  export let paddingInline: number = 46
  export let paddingBlock: number = 46
  export let gap: number = 21
  export let flipAnimate = false
  flipAnimate = false

  const LAZY_N = 6 // NOTE: seems to be the best working value from testing

  let renderedItemsN = 20
  $: renderedItems = [
    ...new Map(items.slice(0, renderedItemsN).map((item) => [item.id, item])).values()
  ]

  const scheduleLoad = () => {
    if (renderedItemsN > items.length) return

    // @ts-ignore - yes, this exists!
    scheduler.postTask(
      () => {
        renderedItemsN += LAZY_N
      },
      {
        priority: 'background'
      }
    )
  }
  const throttledScheduleLoad = useThrottle(scheduleLoad, 5)

  onMount(() => {
    throttledScheduleLoad()
  })

  const handleScroll = () => {
    throttledScheduleLoad()
  }
</script>

<div
  class="masonry-wrapper"
  style:--masonry-gap={gap}
  style:--masonry-padding-inline={paddingInline}
  style:--masonry-padding-block={paddingBlock}
>
  <div
    class="masonry-grid bg-[#f7f7f7] dark:bg-gray-900"
    on:wheel|passive={handleScroll}
    use:selection
    data-container
  >
    {#if flipAnimate}
      {#each renderedItems as item (item.id)}
        <div class="item" animate:flip={{ delay: 0, duration: 300, easing: expoOut }}>
          <slot item={{ id: item.id, data: item.data }}></slot>
        </div>
      {/each}
    {:else}
      {#each renderedItems as item, index (`${item.id}-${index}`)}
        <div class="item">
          <slot item={{ id: item.id, data: item.data }}></slot>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  :global([data-selectable].selected) {
    background-image: linear-gradient(
      to bottom right,
      rgba(0, 123, 255, 0.3),
      rgba(0, 123, 255, 0.2)
    );
    outline: 4px solid rgba(0, 123, 255, 0.4);
  }

  .masonry-wrapper {
    position: absolute;
    inset: 0;
    container-type: inline-size;
    container-name: masonry-wrapper;
  }

  .masonry-grid {
    contain: strict;
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;

    // NOTE: Using CSS Houdini Layout API -> Requires "CSSLayoutAPI" blink flag!
    display: layout(masonry);
    --padding-inline: var(--masonry-padding-inline, 0);
    --padding-block: var(--masonry-padding-block, 0);
    --gap: var(--masonry-gap, 0);
    --columns: 4;
  }
  .item {
    box-sizing: border-box;
    padding: 10px;
    transition:
      opacity 0s ease,
      width 0s ease,
      visibility 0.12s ease;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;

    width: 100% !important;
    height: auto;
  }

  .item:last-child {
    padding-bottom: 400px;
  }

  @container masonry-wrapper (max-width: 600px) {
    .masonry-grid {
      --columns: 1;
    }
  }

  @container masonry-wrapper (min-width: 601px) and (max-width: 900px) {
    .masonry-grid {
      --columns: 2;
    }
  }

  @container masonry-wrapper (min-width: 901px) and (max-width: 1200px) {
    .masonry-grid {
      --columns: 3;
    }
  }

  @container masonry-wrapper (min-width: 1201px) and (max-width: 1700px) {
    .masonry-grid {
      --columns: 4;
    }
  }

  @container masonry-wrapper (min-width: 1701px) {
    .masonry-grid {
      --columns: 5;
    }
  }
</style>
