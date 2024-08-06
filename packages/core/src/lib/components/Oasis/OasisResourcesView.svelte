<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import Masonry from './MasonrySpace.svelte'

  export let resourceIds: Readable<string[]>
  export let selected: string | null = null
  export let showResourceSource: boolean = false

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 40
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => Promise<void>

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
  <div bind:this={scrollElement} class="content">
    {#key scrollElement}
      <Masonry
        renderContents={$renderContents}
        {showResourceSource}
        on:load-more={handleLoadChunk}
        on:open
        on:remove
        on:new-tab
        id={new Date()}
      ></Masonry>
    {/key}
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
