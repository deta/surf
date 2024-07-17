<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import InfiniteScroll from '../InfiniteScroll.svelte'
  import { DrawerContentMasonry } from '@horizon/drawer'
  import { useDebounce } from '../../utils/debounce'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import DragResourceWrapper from './DragResourceWrapper.svelte'
  import Masonry from './MasonryTest.svelte'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 100
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => Promise<void>

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resources, renderLimit], ([resources, renderLimit]) => {
    return resources.slice(0, renderLimit)
  })

  const debouncedRefreshLayout = useDebounce(() => {
    refreshContentLayout()
  }, 500)

  const handleLoadChunk = (e: CustomEvent) => {
    console.log('yyyy', e.detail)

    log.debug('Load more chunk...')
    if ($resources.length <= $renderContents.length) {
      return
    }

    renderLimit.update(
      (limit) => limit + (e.detail > 10 ? CHUNK_SIZE * (e.detail / 10) : CHUNK_SIZE)
    )
    // debouncedRefreshLayout()
  }

  const handleItemLoad = () => {
    debouncedRefreshLayout()
  }
</script>

<div class="wrapper">
  <div bind:this={scrollElement} class="content">
    {#if $renderContents.length > 0}
      <Masonry renderContents={$renderContents} on:load-more={handleLoadChunk}
        >{$renderContents.length}</Masonry
      >
    {/if}

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
