<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import Masonry from './MasonrySpace.svelte'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null
  export let searchResults: Readable<ResourceSearchResultItem[]>

  const log = useLogScope('OasisResourcesView')
  // const dispatch = createEventDispatcher<{ click: string }>()

  const CHUNK_SIZE = 40
  const MAXIMUM_CHUNK_SIZE = 20
  const CHUNK_THRESHOLD = 300

  let scrollElement: HTMLDivElement
  let refreshContentLayout: () => Promise<void>

  const renderLimit = writable(CHUNK_SIZE)

  const renderContents = derived([resources, renderLimit], ([resources, renderLimit]) => {
    return resources.slice(0, renderLimit)
  })

  const handleLoadChunk = (e: CustomEvent) => {
    if ($renderContents.length === 0) {
      renderLimit.set($resources.length)
      return
    }

    if ($resources.length <= $renderContents.length) {
      return
    }
    const CHUNK_SIZE = e.detail

    renderLimit.update((limit) => limit + CHUNK_SIZE)
  }
</script>

<div class="wrapper">
  <div bind:this={scrollElement} class="content">
    {#key scrollElement}
      <Masonry
        renderContents={$renderContents.map((item) => item.id)}
        on:load-more={handleLoadChunk}
        on:open
        on:remove
        on:load
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
