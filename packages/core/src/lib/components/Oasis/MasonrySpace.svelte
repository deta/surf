<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import { useLogScope } from '@horizon/utils'

  import { MasonryGrid } from './masonry/index'
  import type { Item, RenderItem, ScrollVelocity } from './masonry/types'
  import { selection, selectedItems, selectedItemIds, deselectAll } from './utils/select'

  export let items: Item[] = []
  export let isEverythingSpace: boolean
  export let searchValue: Writable<string> | undefined

  const log = useLogScope('MasonrySpace')

  let isUpdatingVisibleItems = false
  let updateVisibleItemsRequestId: number | null = null

  let masonryGrid: MasonryGrid
  let gridContainer: HTMLElement
  let resizeObserverDebounce: NodeJS.Timeout
  let resizedItems = new Set<RenderItem>()
  let scrollVelocity: ScrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }

  const INITIAL_BATCH_SIZE = 10
  let batchSize = INITIAL_BATCH_SIZE

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400

  const gridItems = writable<RenderItem[]>([])

  const dispatch = createEventDispatcher<{
    wheel: { event: WheelEvent; scrollTop: number }
    scroll: { scrollTop: number; viewportHeight: number }
    'load-more': number
  }>()

  async function updateGridBatch(batch: Item[]) {
    const existingIds = new Set(renderItems.map((item) => item.id))
    const newItems = batch.filter((item) => !existingIds.has(item.id))

    for (const item of newItems) {
      addItem(item)
      await tick()
    }
  }

  function observeItemHeightChange(item: RenderItem) {
    const observer = new ResizeObserver(() => {
      const wrapper =
        item.dom?.querySelector('.resource-preview') || item.dom?.querySelector('.folder-wrapper')
      if (wrapper) {
        const height = (wrapper as HTMLElement).offsetHeight
        if (item.style) {
          item.style.height = `${height}px`
          resizedItems.add(item)
        }

        clearTimeout(resizeObserverDebounce)
        resizeObserverDebounce = setTimeout(reinitializeGridAfterResize, 20)
      }
    })
    const element = item.dom?.querySelector('.wrapper')
    if (element) {
      observer.observe(element)
    }

    return () => {
      observer.disconnect()
    }
  }

  function updateVisibleItems() {
    if (!gridContainer || isUpdatingVisibleItems) return

    isUpdatingVisibleItems = true

    if (updateVisibleItemsRequestId !== null) {
      cancelAnimationFrame(updateVisibleItemsRequestId)
    }

    updateVisibleItemsRequestId = requestAnimationFrame(() => {
      const scrollTop = gridContainer.scrollTop
      const viewportHeight = gridContainer.clientHeight

      dispatch('scroll', { scrollTop, viewportHeight })

      isUpdatingVisibleItems = false
      updateVisibleItemsRequestId = null

      if (isBottomReached()) {
        handleBottomReached()
      }
    })
  }

  function calculateItemsToLoad(velocity: number): number {
    if (velocity <= 0) {
      return 0
    }

    const MIN_ITEMS = 1
    const MAX_ITEMS = 100
    const VELOCITY_FACTOR = 45

    let items = Math.round(Math.log(velocity * VELOCITY_FACTOR + 1))

    return Math.max(MIN_ITEMS, Math.min(items, MAX_ITEMS))
  }

  function isBottomReached(): boolean {
    const BUFFER =
      scrollVelocity.velocity > 10
        ? 3 * gridContainer.clientHeight * (scrollVelocity.velocity / 4)
        : 3 * gridContainer.clientHeight

    if (!gridContainer) {
      throw new Error('[MasonrySpace:isBottomReached()] Grid Container not found')
    }

    return (
      gridContainer.scrollHeight - gridContainer.scrollTop <= gridContainer.clientHeight + BUFFER
    )
  }

  function handleBottomReached() {
    const itemsToLoad = calculateItemsToLoad(scrollVelocity.velocity)
    dispatch('load-more', itemsToLoad)
  }

  const handleWheel = (e: WheelEvent) => {
    const scrollTop = gridContainer.scrollTop

    dispatch('wheel', { event: e, scrollTop })
  }

  function getUniqueKey(item: RenderItem, index: number) {
    return `${item.id}-${index}`
  }

  onMount(async () => {
    gridContainer?.addEventListener('scroll', updateVisibleItems)
  })

  onDestroy(() => {
    if (gridContainer) {
      gridContainer.removeEventListener('scroll', updateVisibleItems)
    }
    deselectAll()
  })
</script>

<svelte:window
  on:wheel={(event) => {
    const newScrollTop = gridContainer?.scrollTop
    const newTimestamp = event.timeStamp

    if (scrollVelocity !== undefined && newScrollTop) {
      const deltaY = newScrollTop - scrollVelocity.scrollTop
      const deltaT = newTimestamp - scrollVelocity.timestamp
      scrollVelocity.velocity = deltaY / deltaT
    }

    scrollVelocity = {
      scrollTop: newScrollTop,
      timestamp: newTimestamp,
      velocity: scrollVelocity ? scrollVelocity.velocity : 0
    }
  }}
/>

<div class="masonry-wrapper">
  <div
    class="masonry-grid bg-[#f7f7f7] dark:bg-gray-900"
    on:wheel={handleWheel}
    bind:this={gridContainer}
    use:selection
    data-container
  >
    {#each items as item, index (getUniqueKey(item, index))}
      <div class="item">
        <slot item={{ id: item.id, data: item.data }}></slot>
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

  .masonry-wrapper {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    container-type: inline-size;
    container-name: masonry-wrapper;
  }

  .masonry-grid {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;

    // NOTE: Using CSS Houdini Layout API -> Requires "CSSLayoutAPI" chrome flag!
    display: layout(masonry);
    --padding: 30;
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

  @container masonry-wrapper (max-width: 600px) {
    .masonry-grid {
      --columns: 1;
    }
  }

  @container masonry-wrapper (min-width: 601px) and (max-width: 900px) {
    .masonry-grid {
      --columns: 2;
    }
  }

  @container masonry-wrapper (min-width: 901px) and (max-width: 1200px) {
    .masonry-grid {
      --columns: 3;
    }
  }

  @container masonry-wrapper (min-width: 1201px) and (max-width: 1700px) {
    .masonry-grid {
      --columns: 4;
    }
  }

  @container masonry-wrapper (min-width: 1701px) {
    .masonry-grid {
      --columns: 5;
    }
  }
</style>
