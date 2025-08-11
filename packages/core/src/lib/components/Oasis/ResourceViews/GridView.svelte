<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { ContextViewDensity } from '@deta/types'
  import type { RenderableItem } from '../../../types'

  export let items: Readable<RenderableItem[]>
  export let density: ContextViewDensity | undefined = undefined // Allow specific override if needed
</script>

<div class="grid-view" data-density={density}>
  <div class="grid-content bg-[#F7F9FB] dark:bg-gray-900">
    {#each $items as item, index (`${item.id}-${index}`)}
      <div class="item">
        <slot {item}></slot>
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

  .grid-view {
    container-type: inline-size;
    container-name: grid-view;
  }

  .grid-content {
    display: grid;
    gap: 2.75ch;
    padding: 3.5ch;
    padding-bottom: 7em;
    grid-template-columns: repeat(var(--columns, 3), minmax(20ch, 1fr));
  }
  .item {
    box-sizing: border-box;

    width: 100% !important;
    height: 100% !important;
    aspect-ratio: 1 / 1;
    justify-self: stretch;
  }

  .grid-content:last-child {
    padding-bottom: 400px;
  }

  @container grid-view (max-width: 600px) {
    .grid-content {
      --columns: var(--density-xs-columns);
    }
  }
  @container grid-view (min-width: 601px) and (max-width: 900px) {
    .grid-content {
      --columns: var(--density-sm-columns);
    }
  }
  @container grid-view (min-width: 901px) and (max-width: 1200px) {
    .grid-content {
      --columns: var(--density-md-columns);
    }
  }
  @container grid-view (min-width: 1201px) and (max-width: 1700px) {
    .grid-content {
      --columns: var(--density-lg-columns);
    }
  }
  @container grid-view (min-width: 1701px) {
    .grid-content {
      --columns: var(--density-xl-columns);
    }
  }

  :global([data-density='compact'] .grid-content) {
    --density-xs-columns: 2;
    --density-sm-columns: 3;
    --density-md-columns: 4;
    --density-lg-columns: 5;
    --density-xl-columns: 6;
  }
  :global([data-density='cozy'] .grid-content) {
    --density-xs-columns: 1;
    --density-sm-columns: 2;
    --density-md-columns: 3;
    --density-lg-columns: 4;
    --density-xl-columns: 5;
  }
  :global([data-density='comfortable'] .grid-content) {
    --density-xs-columns: 1;
    --density-sm-columns: 2;
    --density-md-columns: 2;
    --density-lg-columns: 3;
    --density-xl-columns: 4;
  }
  :global([data-density='spacious'] .grid-content) {
    --density-xs-columns: 1;
    --density-sm-columns: 1;
    --density-md-columns: 2;
    --density-lg-columns: 2;
    --density-xl-columns: 3;
  }
</style>
