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

  let prevItems: Item[] = []
  let isUpdatingVisibleItems = false
  let updateVisibleItemsRequestId: number | null = null
  let resizeInterval: ReturnType<typeof setInterval> | null = null

  let masonryGrid: MasonryGrid
  let gridContainer: HTMLElement
  let resizeObserverDebounce: NodeJS.Timeout
  let resizedItems = new Set<RenderItem>()
  let scrollVelocity: ScrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }
  let gridObserver: MutationObserver

  let updateQueue: Item[] = []
  let searchDebounceTimer: ReturnType<typeof setTimeout>
  let isProcessingQueue = false

  let renderedItems = 0

  const idleCallback = () => {
    observeItems(gridContainer)
    updateVisibleItems()
  }

  const INITIAL_BATCH_SIZE = 10
  let batchSize = INITIAL_BATCH_SIZE

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400

  const itemsStore = writable<RenderItem[]>([])
  const gridItems = writable<RenderItem[]>([])

  const dispatch = createEventDispatcher<{
    wheel: { event: WheelEvent; scrollTop: number }
    scroll: { scrollTop: number; viewportHeight: number }
    'load-more': number
  }>()
  const resizeObserver = new ResizeObserver(() => {
    handleResize()
  })

  let renderItems: RenderItem[] = []
  itemsStore.subscribe((value) => {
    renderItems = value
  })

  $: if ($searchValue) {
    clearTimeout(searchDebounceTimer)
    renderedItems = 0
    searchDebounceTimer = setTimeout(updateGridAfterSearch, 500)
  }

  $: if (items && !arraysEqual(items, prevItems)) {
    prevItems = [...items]

    const removed = renderItems.filter(
      (renderItem) => !items.some((item) => item.id === renderItem.id)
    )
    const added = items.filter(
      (item) => !renderItems.some((renderItem) => renderItem.id === item.id)
    )

    if (removed.length > 0) {
      removeItems(removed)
    }

    if (added.length > 0) {
      queueUpdate(added)
    }
  }

  async function updateGridAfterSearch() {
    await tick()
    if (gridContainer) {
      observeItems(gridContainer)
      updateVisibleItems()
    }

    // Clear any existing interval
    if (resizeInterval) {
      clearInterval(resizeInterval)
    }

    // Start a new interval
    resizeInterval = setInterval(async () => {
      await handleRedraw()
    }, 500)

    // Set a timeout to clear the interval after 10 seconds
    setTimeout(() => {
      if (resizeInterval) {
        clearInterval(resizeInterval)
        resizeInterval = null
      }
    }, 10000)
  }

  async function updateGridAfterResize() {
    await tick()
    if (gridContainer) {
      observeItems(gridContainer)
      updateVisibleItems()
    }
  }

  function setItemDom(node: HTMLElement, item: RenderItem) {
    if (!item || typeof item !== 'object') {
      return
    }

    item.dom = node
    const unobserve = observeItemHeightChange(item)

    return {
      destroy() {
        unobserve()
      }
    }
  }

  function setupGridObserver() {
    if (gridObserver) {
      gridObserver.disconnect()
    }

    gridObserver = new MutationObserver((mutations) => {
      let childrenChanged = false
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          childrenChanged = true
          break
        }
      }

      if (childrenChanged) {
        queueUpdate($gridItems.map((item) => ({ id: item.id, data: item.data })))
      }
    })

    if (gridObserver && gridContainer) {
      gridObserver.observe(gridContainer, { childList: true, subtree: true })
    }
  }

  function queueUpdate(newData: Item[]) {
    updateQueue.unshift(...newData)
    if (!isProcessingQueue) {
      isProcessingQueue = true
      queueMicrotask(processUpdateQueue)
    }
  }

  async function processUpdateQueue() {
    const startTime = performance.now()

    while (updateQueue.length > 0 && performance.now() - startTime < 16) {
      const batch = updateQueue.splice(0, batchSize)
      await updateGridBatch(batch)
    }

    if (updateQueue.length > 0) {
      queueMicrotask(processUpdateQueue)
    } else {
      isProcessingQueue = false
      await tick()
      if (gridContainer) {
        observeItems(gridContainer)
        updateVisibleItems()
      }
    }
  }

  async function updateGridBatch(batch: Item[]) {
    const existingIds = new Set(renderItems.map((item) => item.id))
    const newItems = batch.filter((item) => !existingIds.has(item.id))

    for (const item of newItems) {
      addItem(item)
      await tick()
    }
  }

  function transformIncomingData(data: any): RenderItem {
    return {
      id: data
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

  function reinitializeGridAfterResize() {
    if (resizedItems.size > 0) {
      const skipSort = $searchValue !== ''
      const updatedItems = masonryGrid.reinitializeGrid(renderItems, skipSort)
      gridItems.set(updatedItems)
      resizedItems.clear()
      updateVisibleItems()
    }
  }

  function addItem(incomingItem: Item) {
    try {
      const placedItem = masonryGrid.addItem(incomingItem)
      if (placedItem) {
        itemsStore.update((current) => [...current, placedItem])
        gridItems.update((current) => [...current, placedItem])
      }
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  function removeItems(items: RenderItem[]) {
    items.forEach((item) => {
      const itemIndex = renderItems.findIndex((i) => i.id === item.id)
      if (itemIndex !== -1) {
        itemsStore.update((current) => {
          current.splice(itemIndex, 1)
          return current
        })
        gridItems.update((current) => current.filter((_, i) => i !== itemIndex))
      }
    })
  }

  function observeItems(gridContainer: HTMLElement | null) {
    if (!gridContainer) return

    renderItems.forEach((item) => {
      if (!item) return // Skip if item is undefined

      const itemId = item.id
      if (itemId === undefined) return // Skip if itemId is undefined

      const dom = gridContainer.querySelector(`[id='item-${itemId}']`) as HTMLElement

      if (dom) {
        if (typeof item === 'object') {
          item.dom = dom
          observeItemHeightChange(item)
        } else {
          console.warn(`RenderItem with id ${itemId} is not an object`)
        }
      } else {
        console.warn(`DOM element for item ${itemId} not found`)
      }
    })
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

      const startTime = performance.now()
      const updatedItems: Array<RenderItem & { visible?: boolean; rendered?: boolean }> = []

      for (let i = 0; i < $gridItems.length; i++) {
        const item = $gridItems[i]
        if (!item.style) {
          updatedItems.push(item)
          continue
        }

        const itemTop = parseInt(item.style.top || '0')
        const itemHeight = parseInt(item.style.height || '0')
        const itemBottom = itemTop + itemHeight

        updatedItems.push({
          ...item,
          visible:
            itemBottom > scrollTop - UPPER_OVERSHOOT_BOUND &&
            itemTop < scrollTop + viewportHeight + LOWER_OVERSHOOT_BOUND,
          rendered: true
        })

        if (i % 50 === 0 && performance.now() - startTime > 16) {
          updateVisibleItemsRequestId = requestAnimationFrame(() => {
            gridItems.set(updatedItems.concat($gridItems.slice(i + 1)))
            isUpdatingVisibleItems = false

            if (isBottomReached()) {
              handleBottomReached()
            }
          })
          return
        }
      }

      gridItems.set(updatedItems)
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

  function handleItemRendered() {
    renderedItems++
    if (renderedItems === $gridItems.length) {
      updateGrid()
    }
  }

  async function updateGrid() {
    await tick()
    if (gridContainer && masonryGrid) {
      masonryGrid.reinitializeGrid(renderItems)
      updateVisibleItems()
    }
  }

  async function handleRedraw() {
    if (masonryGrid) {
      await tick()
      masonryGrid.handleResize()
      updateGridAfterResize()
    }
  }

  function handleResize() {
    masonryGrid.handleResize()
    updateGridAfterResize()
  }

  function getUniqueKey(item: RenderItem, index: number) {
    return `${item.id}-${index}`
  }

  function arraysEqual(a: any[], b: any[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  onMount(async () => {
    masonryGrid = new MasonryGrid(gridContainer, isEverythingSpace)

    setupGridObserver()

    gridContainer?.addEventListener('scroll', updateVisibleItems)

    // This is needed for initial load. We need to wait for the resources to load
    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(idleCallback)
    } else {
      setTimeout(idleCallback, 500)
    }

    // Start a new interval. This interval will redraw the grid every 500ms
    // instead of waiting for the resources to load. This is way faster initially.
    // This is needed for all other types of spaces
    resizeInterval = setInterval(async () => {
      // console.log('Redrawing grid')
      await handleRedraw()
    }, 500)

    // Set a timeout to clear the interval after 10 seconds
    setTimeout(() => {
      if (resizeInterval) {
        clearInterval(resizeInterval)
        resizeInterval = null
      }
    }, 10000)

    if (gridContainer) {
      resizeObserver.observe(gridContainer)
    }
  })

  onDestroy(() => {
    if (gridContainer) {
      gridContainer.removeEventListener('scroll', updateVisibleItems)
    }
    if (gridObserver) {
      gridObserver.disconnect()
    }

    // Clear the interval if it's still running
    if (resizeInterval) {
      clearInterval(resizeInterval)
    }

    if (updateVisibleItemsRequestId !== null) {
      cancelAnimationFrame(updateVisibleItemsRequestId)
    }

    deselectAll()

    // Remove the event listener for resize
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
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

<div
  class="masonry-grid"
  on:wheel={handleWheel}
  bind:this={gridContainer}
  use:selection
  data-container
>
  {#each $gridItems as item, index (getUniqueKey(item, index))}
    <div
      data-vaul-no-drag
      class="item resource"
      id="item-{item.id}"
      class:visible={item.visible}
      style="left: {item.style?.left}; top: {item.style?.top}; height: {item.style?.height};"
      use:setItemDom={item}
    >
      <div class="item-details">
        <slot item={{ id: item.id, data: item.data }} renderingDone={handleItemRendered}></slot>
      </div>
    </div>
  {/each}
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

  .masonry-grid {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    background: #f7f7f7;
    container-type: inline-size;
    container-name: masonry-grid;
  }
  .item {
    position: absolute;
    box-sizing: border-box;
    padding: 10px;
    transition:
      opacity 0s ease,
      left 0s ease,
      top 0s ease,
      width 0s ease,
      visibility 0.12s ease;
    will-change: opacity, left, top, width, visibility;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    height: fit-content !important;
    opacity: 0;
    width: 100%;
    visibility: visible;
  }

  .item:last-child {
    padding-bottom: 400px;
  }

  .item-details {
    font-size: 0.8em;
    margin-top: 5px;
    width: 100%;
  }
  .item.visible {
    opacity: 1;
  }

  @container masonry-grid (max-width: 600px) {
    .item {
      width: 92%;
    }
  }
  @container masonry-grid (min-width: 601px) and (max-width: 900px) {
    .item {
      width: 45%;
    }
  }
  @container masonry-grid (min-width: 901px) and (max-width: 1200px) {
    .item {
      width: 32%;
    }
  }
  @container masonry-grid (min-width: 1201px) and (max-width: 1800px) {
    .item {
      width: 23.5%;
    }
  }
  @container masonry-grid (min-width: 1801px) {
    .item {
      width: 19%;
    }
  }
</style>
