<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { derived, writable, type Readable } from 'svelte/store'
  import type { RenderableItem } from '../../types'

  export let items: Readable<RenderableItem[]>

  const INITIAL_ITEMS = 50
  const BATCH_SIZE = 10
  const LOAD_THRESHOLD = 800
  const PRELOAD_THRESHOLD = 1200

  const renderedItemsN = writable(INITIAL_ITEMS)

  let itemsCache: RenderableItem[] = []
  let lastItemsLength = 0
  let lastRenderedN = 0

  const renderedItems = derived([items, renderedItemsN], ([$items, $renderedItemsN]) => {
    if ($items.length !== lastItemsLength || $renderedItemsN !== lastRenderedN) {
      lastItemsLength = $items.length
      lastRenderedN = $renderedItemsN

      itemsCache = $items.slice(0, $renderedItemsN)
    }

    return itemsCache
  })

  let scrollContainer: HTMLElement
  let isLoading = false
  let scrollHandler: () => void
  let preloadTimeout: number | null = null

  function checkAndLoadMore() {
    if (!scrollContainer || isLoading) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer
    const remainingScroll = scrollHeight - scrollTop - clientHeight

    if (remainingScroll < PRELOAD_THRESHOLD) {
      loadMoreItems(BATCH_SIZE * 2)
    } else if (remainingScroll < LOAD_THRESHOLD) {
      loadMoreItems(BATCH_SIZE)
    }
  }

  function loadMoreItems(batchSize: number = BATCH_SIZE) {
    if (isLoading || $renderedItemsN >= $items.length) return

    isLoading = true

    requestAnimationFrame(() => {
      renderedItemsN.update((n) => Math.min(n + batchSize, $items.length))
      isLoading = false

      preloadTimeout = setTimeout(() => {
        checkAndLoadMore()
      }, 16) // ~60fps timing
    })
  }

  function throttledScrollHandler() {
    if (preloadTimeout) {
      clearTimeout(preloadTimeout)
      preloadTimeout = null
    }

    requestAnimationFrame(checkAndLoadMore)
  }

  onMount(() => {
    loadMoreItems(INITIAL_ITEMS)

    scrollHandler = throttledScrollHandler

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(checkAndLoadMore)
      })
      resizeObserver.observe(scrollContainer)

      return () => {
        scrollContainer.removeEventListener('scroll', scrollHandler)
        resizeObserver.disconnect()
        if (preloadTimeout) {
          clearTimeout(preloadTimeout)
        }
      }
    }
  })

  onDestroy(() => {
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', scrollHandler)
    }
    if (preloadTimeout) {
      clearTimeout(preloadTimeout)
    }
  })
</script>

<div
  class="lazyScroll-container"
  bind:this={scrollContainer}
  on:wheel={throttledScrollHandler}
  data-container
>
  <slot {renderedItems} />
</div>

<style lang="scss">
  .lazyScroll-container {
    content-visibility: auto;
    contain-intrinsic-size: auto 500px;

    position: absolute;
    overflow-y: auto;
    overflow-x: hidden;
    top: 0;
    width: 100%;
    height: 100%;

    will-change: transform;

    &::-webkit-scrollbar {
      width: 12px;
      height: 6px;
    }

    &::-webkit-scrollbar-track,
    &::-webkit-scrollbar-track-piece {
      background: transparent;
      border: none;
    }

    &::-webkit-scrollbar-corner {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      margin-top: 200px;
      background-color: light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2));
      border-radius: 10px;
      transition: background-color 0.2s linear;
      border: 3px solid transparent;
      background-clip: content-box;
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.3));
    }
  }
</style>
