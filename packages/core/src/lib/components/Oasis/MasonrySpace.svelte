<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import type { Writable } from 'svelte/store'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import { MasonryGrid } from './masonry/index'
  import type { Item, ScrollVelocity } from './masonry/types'

  export let renderContents: Item[] | string[] = []
  export let id: Date
  export let isEverythingSpace: boolean
  export let showResourceSource: boolean = false
  export let newTabOnClick: boolean = false
  export let searchValue: Writable<string> | undefined

  let prevItemLength = 0
  let prevRenderContents = []

  let isUpdatingVisibleItems = false
  let updateVisibleItemsRequestId: number | null = null
  let resizeInterval: number | null = null
  let resizeObserver = new ResizeObserver(() => {
    handleResize()
  })

  let masonryGrid: MasonryGrid
  let gridContainer: HTMLElement
  let resizeObserverDebounce: NodeJS.Timeout
  let resizedItems = new Set<Item>()
  let scrollVelocity: ScrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }
  let gridObserver: MutationObserver

  let updateQueue: Item[] = []
  let created: Date
  let searchDebounceTimer: number
  let isProcessingQueue = false
  let itemsLoaded: boolean = false

  let renderedItems = 0

  const idleCallback = () => {
    observeItems(gridContainer)
    updateVisibleItems()
  }

  const INITIAL_BATCH_SIZE = 10
  let batchSize = INITIAL_BATCH_SIZE

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400

  let globallyAddedItems = 0

  const itemsStore = writable<Item[]>([])
  const gridItems = writable<Item[]>([])

  const dispatch = createEventDispatcher()

  let items: Item[] = []
  itemsStore.subscribe((value) => {
    items = value
  })

  $: if ($searchValue) {
    clearTimeout(searchDebounceTimer)
    renderedItems = 0
    searchDebounceTimer = setTimeout(updateGridAfterSearch, 500)
  }

  $: if (renderContents && !arraysEqual(renderContents, prevRenderContents)) {
    prevRenderContents = [...renderContents]

    const diffItems = {
      added: [],
      removed: []
    }

    diffItems.removed = items.filter((item) => !renderContents.includes(item.id))
    diffItems.added = renderContents
      .filter((id) => !items.some((item) => item.id === id))
      .map((id) => ({ id }))

    if (diffItems.added.length > 0 || diffItems.removed.length > 0) {
      if (renderContents.length > prevItemLength) {
        queueUpdate(renderContents.slice(prevItemLength))
      } else if (renderContents.length < prevItemLength || diffItems.removed.length > 0) {
        updateItems(diffItems)
        queueUpdate($gridItems)
      }

      globallyAddedItems += diffItems.added.length
      prevItemLength = renderContents.length
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

  function setItemDom(node: HTMLElement, item: Item) {
    if (item && typeof item === 'object') {
      item.dom = node
      observeItemHeightChange(item)
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
        queueUpdate($gridItems)
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
    const existingIds = new Set(items.map((item) => item.id))
    const newItems = batch.filter((item) => !existingIds.has(item.id))

    for (const item of newItems) {
      addItem(item)
      await tick()
    }
  }

  function transformIncomingData(data: any): Item {
    return {
      id: data
    }
  }

  function observeItemHeightChange(item: Item) {
    const observer = new ResizeObserver(() => {
      const wrapper =
        item.dom?.querySelector('.resource-preview') || item.dom?.querySelector('.folder-wrapper')
      if (wrapper) {
        const height = wrapper.offsetHeight
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
  }

  function reinitializeGridAfterResize() {
    if (resizedItems.size > 0) {
      const skipSort = $searchValue !== ''
      const updatedItems = masonryGrid.reinitializeGrid(items, skipSort)
      gridItems.set(updatedItems)
      resizedItems.clear()
      updateVisibleItems()
    }
  }

  function addItem(incomingItem: Item | null = null) {
    try {
      const newItem = incomingItem
        ? transformIncomingData(incomingItem)
        : { id: items.length + 1, content: `Item ${items.length + 1}` }
      const placedItem = masonryGrid.addItem(newItem)
      if (placedItem) {
        itemsStore.update((current) => [...current, placedItem])
        gridItems.update((current) => [...current, placedItem])
      }
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  function updateItems(diffItems: any) {
    diffItems.removed.forEach((item) => {
      const itemIndex = items.findIndex((i) => i.id === item.id)
      if (itemIndex !== -1) {
        itemsStore.update((current) => {
          current.splice(itemIndex, 1)
          return current
        })
        gridItems.update((current) => current.filter((_, i) => i !== itemIndex))
      }
    })

    diffItems.added.forEach((newItem) => {
      itemsStore.update((current) => {
        current.push(newItem)
        return current
      })
      gridItems.update((current) => [...current, newItem])
    })
  }

  function observeItems(gridContainer: HTMLElement | null) {
    if (!gridContainer) return

    items.forEach((item) => {
      if (!item) return // Skip if item is undefined

      const itemId = typeof item.id === 'object' ? item.id.id : item.id
      if (itemId === undefined) return // Skip if itemId is undefined

      const dom = gridContainer.querySelector(`[id='item-${itemId}']`) as HTMLElement

      if (dom) {
        if (typeof item === 'object') {
          item.dom = dom
          observeItemHeightChange(item)
        } else {
          console.warn(`Item with id ${itemId} is not an object`)
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
      const updatedItems = []

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
      masonryGrid.reinitializeGrid(items)
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

  function getUniqueKey(item: Item, index: number) {
    return `${item.id}-${index}`
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  onMount(async () => {
    created = new Date()
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
    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement
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

    // Remove the event listener for resize
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })
</script>

<svelte:window
  on:wheel={(event) => {
    const gridContainer = document.getElementById(id)
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

<div {id} class="masonry-grid" on:wheel={handleWheel} bind:this={gridContainer}>
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
        <OasisResourceLoader
          id={item.id}
          showSource={showResourceSource}
          {newTabOnClick}
          on:click
          on:open
          on:remove
          on:load
          on:new-tab
          on:rendered={handleItemRendered}
        />
      </div>
    </div>
  {/each}
</div>

<style>
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

  .debug {
    position: fixed;
    bottom: 0.5rem;
    right: 0.5rem;
    border-radius: 4px;
    background: black;
    color: white;
    padding: 10px;
    z-index: 1000;
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
