<script lang="ts">
  import { derived, writable, type Readable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import type { Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'
  import type { ResourceSearchResultItem } from '../../service/resources'
  import Masonry from './MasonrySpace.svelte'
  import SpacesView from './SpacesView.svelte'
  import BrowserHomescreen from '../Browser/BrowserHomescreen.svelte'
  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../service/history'
  import { Motion, type MotionConfig } from './masonry/motion'

  export let resources: Readable<ResourceSearchResultItem[]>
  export let selected: string | null = null
  export let isEverythingSpace: boolean
  export let showResourceSource: boolean = false
  export let newTabOnClick: boolean = false
  export let searchValue: Writable<string> | undefined

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
          renderContents={$renderContents.map((item) => item.id)}
          {showResourceSource}
          {newTabOnClick}
          on:load-more={handleLoadChunk}
          on:open
          on:remove
          on:load
          on:space-selected
          on:open-space-as-tab
          on:scroll={handleScroll}
          on:wheel
          id={new Date()}
          {searchValue}
          {isEverythingSpace}
        ></Masonry>
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
