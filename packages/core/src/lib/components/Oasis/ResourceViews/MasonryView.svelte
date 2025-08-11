<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { ContextViewDensity } from '@deta/types'
  import type { RenderableItem } from '../../../types'

  export let items: Readable<RenderableItem[]>

  export let paddingInline: number = 46
  export let paddingBlock: number = 46
  export let gap: number = 21
  export let density: ContextViewDensity | undefined = undefined // Allow specific override if needed
</script>

<div
  class="masonry-view"
  data-density={density}
  style:--masonry-gap={gap}
  style:--masonry-padding-inline={paddingInline}
  style:--masonry-padding-block={paddingBlock}
>
  <!--     on:wheel|passive={handleScroll} -->
  <div class="masonry-grid bg-[#F7F9FB] dark:bg-gray-900">
    {#each $items as item, index (`${item.id}-${index}`)}
      <div class="item">
        <slot item={{ id: item.id, type: item.type, data: item.data }}></slot>
      </div>
    {/each}
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

  .masonry-view {
    container-type: inline-size;
    container-name: masonry-view;
  }

  .masonry-grid {
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

  @container masonry-view (max-width: 600px) {
    .masonry-grid {
      --columns: var(--density-xs-columns);
    }
  }
  @container masonry-view (min-width: 601px) and (max-width: 900px) {
    .masonry-grid {
      --columns: var(--density-sm-columns);
    }
  }
  @container masonry-view (min-width: 901px) and (max-width: 1200px) {
    .masonry-grid {
      --columns: var(--density-md-columns);
    }
  }
  @container masonry-view (min-width: 1201px) and (max-width: 1700px) {
    .masonry-grid {
      --columns: var(--density-lg-columns);
    }
  }
  @container masonry-view (min-width: 1701px) {
    .masonry-grid {
      --columns: var(--density-xl-columns);
    }
  }

  :global([data-density='compact'] .masonry-grid) {
    --density-xs-columns: 2;
    --density-sm-columns: 3;
    --density-md-columns: 4;
    --density-lg-columns: 5;
    --density-xl-columns: 6;
  }
  :global([data-density='cozy'] .masonry-grid) {
    --density-xs-columns: 1;
    --density-sm-columns: 2;
    --density-md-columns: 3;
    --density-lg-columns: 4;
    --density-xl-columns: 5;
  }
  :global([data-density='comfortable'] .masonry-grid) {
    --density-xs-columns: 1;
    --density-sm-columns: 2;
    --density-md-columns: 2;
    --density-lg-columns: 3;
    --density-xl-columns: 4;
  }
  :global([data-density='spacious'] .masonry-grid) {
    --density-xs-columns: 1;
    --density-sm-columns: 1;
    --density-md-columns: 2;
    --density-lg-columns: 2;
    --density-xl-columns: 3;
  }
</style>
