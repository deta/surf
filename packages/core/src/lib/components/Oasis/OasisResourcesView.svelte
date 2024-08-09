<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import Masonry from './MasonrySpace.svelte'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import { useDebounce } from '../../utils/debounce'

  export let resourceIds: Readable<string[]>
  export let selected: string | null = null
  export let showResourceSource: boolean = false
  export let useMasonry: boolean = true

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 40
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => void

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resourceIds, renderLimit], ([resourceIds, renderLimit]) => {
    return resourceIds.slice(0, renderLimit)
  })

  const handleLoadChunk = () => {
    log.debug('Load more chunk...', $renderLimit, $resourceIds.length)
    if ($resourceIds.length <= $renderContents.length) {
      return
    }

    renderLimit.update((limit) => limit + CHUNK_SIZE)
  }
</script>

<div class="wrapper">
  {#if useMasonry}
    <div bind:this={scrollElement} class="content">
      {#key scrollElement}
        <Masonry
          renderContents={$renderContents}
          isEverythingSpace={false}
          {showResourceSource}
          on:load-more={handleLoadChunk}
          on:open
          on:remove
          on:new-tab
          id={new Date()}
        ></Masonry>
      {/key}
    </div>
  {:else}
    <div class="content flex flex-wrap gap-16 pt-[100px]">
      {#each $renderContents as resourceId (resourceId)}
        <div class="max-w-[420px] w-full">
          <OasisResourceLoader
            id={resourceId}
            showSource={showResourceSource}
            on:click
            on:open
            on:remove
            on:load
            on:new-tab
          />
        </div>
      {/each}
    </div>
  {/if}
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

  .go-back {
    position: absolute;
    top: 2rem;
    left: 2rem;
    z-index: 1000;
  }
</style>
