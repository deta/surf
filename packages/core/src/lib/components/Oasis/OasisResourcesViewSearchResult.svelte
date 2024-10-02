<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import Masonry from './MasonrySpace.svelte'
  import OasisResourceLoader from './OasisResourceLoader.svelte'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null
  export let isEverythingSpace: boolean
  export let isInSpace: boolean = false
  export let searchValue: Writable<string> | undefined
  export let resourcesBlacklistable: boolean = false
  export let interactive: boolean = true

  const log = useLogScope('OasisResourcesView')
  const dispatch = createEventDispatcher()
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

  export let scrollTop: number

  const handleScroll = (event: CustomEvent<{ scrollTop: number; viewportHeight: number }>) => {
    dispatch('scroll', { scrollTop: event.detail.scrollTop })
    scrollTop = event.detail.scrollTop
  }
</script>

<div class="wrapper">
  <div bind:this={scrollElement} class="content">
    {#if scrollElement}
      {#key $searchValue === ''}
        <Masonry
          items={$renderContents.map((item) => ({ id: item.id, data: item.resource }))}
          on:load-more={handleLoadChunk}
          on:scroll={handleScroll}
          on:wheel
          {searchValue}
          {isEverythingSpace}
          let:item
          let:renderingDone={handleRenderingDone}
        >
          <OasisResourceLoader
            resourceOrId={item.data ? item.data : item.id}
            {isInSpace}
            {resourcesBlacklistable}
            on:open
            on:open-and-chat
            on:remove
            on:load
            on:space-selected
            on:open-space-as-tab
            on:blacklist-resource
            on:whitelist-resource
            on:rendered={handleRenderingDone}
            {interactive}
          />
        </Masonry>
      {/key}
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  .header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5rem;
    padding: 0;
    padding-bottom: 0;
    position: absolute;
    top: 1rem;
    left: 0;
    right: 0;
    z-index: 10;
    will-change: transform, opacity;
    transform-origin: top center;
    width: 100%;
    /* height: calc(100vh - 400px); */
    pointer-events: none;
  }
  .content {
    height: 100%;
    overflow: auto;
    padding-top: 4rem;
  }
</style>
