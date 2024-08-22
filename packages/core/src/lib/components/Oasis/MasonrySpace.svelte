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
    searchDebounceTimer = setTimeout(updateGridAfterSearch, 3500)
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
    resizeInterval = setInterval(() => {
      handleRedraw()
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

    gridObserver.observe(gridContainer, { childList: true, subtree: true })
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
    items.forEach((item) => {
      const itemId = `item-${typeof item.id === 'object' ? item.id.id : item.id}`

      if (gridContainer) {
        const dom = gridContainer.querySelector(`[id='${itemId}']`) as HTMLElement

        if (dom) {
          item.dom = dom
          observeItemHeightChange(item)
        }
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
        ? 3 * window.innerHeight * (scrollVelocity.velocity / 4)
        : 3 * window.innerHeight

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

  function handleRedraw() {
    if (masonryGrid) {
      masonryGrid.handleResize()
      updateVisibleItems()
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
    gridContainer = document.getElementById(id as unknown as string) as HTMLElement
    masonryGrid = new MasonryGrid(gridContainer, isEverythingSpace)

    setupGridObserver()

    gridContainer?.addEventListener('scroll', updateVisibleItems)

    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(idleCallback)
    } else {
      setTimeout(idleCallback, 500)
    }

    // Add the event listener for resize
    window.addEventListener('resize', handleResize)
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
    window.removeEventListener('resize', handleResize)
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

<!-- <pre style="position: fixed; top: 0; left: 0; z-index: 10000">{JSON.stringify(
    renderContents.length,
    null,
    2
  )}</pre>
<pre style="position: fixed; top: 1rem; right: 8rem; z-index: 10000">{JSON.stringify(
    $gridItems.length,
    null,
    2
  )}</pre> -->

<div {id} class="masonry-grid" on:wheel={handleWheel}>
  {#each $gridItems as item, index (getUniqueKey(item, index))}
    <div
      data-vaul-no-drag
      class="item resource"
      id="item-{item.id}"
      class:visible={item.visible}
      style="left: {item.style?.left}; top: {item.style?.top}; height: {item.style?.height};"
      bind:this={item.dom}
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
    padding: 4rem;
    box-sizing: border-box;
    background: #f7f7f7;
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
    will-change: opacity, left, top, width, visility;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    height: fit-content !important;
    opacity: 0;
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

  @media (max-width: 800px) {
    .item {
      width: 100%;
    }
  }
  @media (min-width: 801px) and (max-width: 1100px) {
    .item {
      width: 49%;
    }
  }
  @media (min-width: 1101px) and (max-width: 1400px) {
    .item {
      width: 32%;
    }
  }
  @media (min-width: 1401px) and (max-width: 2000px) {
    .item {
      width: 23.5%;
    }
  }
  @media (min-width: 2001px) {
    .item {
      width: 18.4%;
    }
  }
</style>
