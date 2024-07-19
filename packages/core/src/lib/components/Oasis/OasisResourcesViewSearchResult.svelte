<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import InfiniteScroll from '../InfiniteScroll.svelte'
  import { DrawerContentMasonry } from '@horizon/drawer'
  import { useDebounce } from '../../utils/debounce'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import Masonry from './MasonrySpace.svelte'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null
  export let searchResults: Readable<ResourceSearchResultItem[]>

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 50
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => Promise<void>

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resources, renderLimit], ([resources, renderLimit]) => {
    return resources.slice(0, renderLimit)
  })

  const handleLoadChunk = (e: CustomEvent) => {
    const CHUNK_SIZE = e.detail

    if ($resources.length <= $renderContents.length) {
      return
    }

    renderLimit.update((limit) => limit + CHUNK_SIZE)
    console.log('bottom reached', $resources.length, $renderContents.length)
  }
</script>

<div class="wrapper">
  <div bind:this={scrollElement} class="content">
    {#key searchResults || scrollElement}
      <Masonry
        renderContents={$renderContents.map((item) => item.id)}
        on:load-more={handleLoadChunk}
        on:open
        on:remove
        >{$renderContents.length}
      </Masonry>
    {/key}

    <!-- <Masonry
      gridGap="2rem"
      colWidth="minmax(250px, 330px)"
      bind:refreshLayout={refreshContentLayout}
    >
      {#each $renderContents as item (item.id)}
        <DragResourceWrapper resource={item.resource} class="masonry-item">
          <ResourcePreviewClean
            resource={item.resource}
            selected={selected === item.id}
            on:load={handleItemLoad}
            on:click
            on:open
            on:remove
          />
        </DragResourceWrapper>
      {/each}
      <InfiniteScroll
        elementScroll={scrollElement}
        threshold={CHUNK_THRESHOLD}
        on:loadMore={handleLoadChunk}
      />
    </Masonry>-->
  </div>
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    padding-bottom: 0;
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .content {
    height: 100%;
    overflow: auto;
  }
</style>
