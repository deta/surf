<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import OasisResourceLoader from './OasisResourceLoader.svelte'
  import { RedBlackTree } from './masonry/index'
  import type { Item, ScrollVelocity } from './masonry/types'
  import Folder from '../Browser/Folder.svelte'

  export let renderContents: Item[] | string[] = []
  export let id: Date
  export let isEverythingSpace: boolean
  export let showResourceSource: boolean = false
  export let newTabOnClick: boolean = false

  let prevItemLength = 0
  let masonryGrid: MasonryGrid
  let resizeObserverDebounce: NodeJS.Timeout
  let resizedItems = new Set<Item>()
  let scrollVelocity: ScrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }

  let updateQueue: Item[] = []
  let isUpdating = false
  let created: Date
  let itemsLoaded: boolean = false

  const BATCH_SIZE = 10
  const UPDATE_INTERVAL = 16
  const TIME_TILL_ACTIVATION = 2000

  // Convert items into a writable store
  const itemsStore = writable<Item[]>([])

  // Subscribe to the items store to get the latest value
  let items: Item[] = []
  itemsStore.subscribe((value) => {
    items = value
  })

  const gridItems = writable<Item[]>([])

  $: if (renderContents) {
    const diffItems = {
      added: [],
      removed: []
    }

    diffItems.removed = items.filter((item) => !renderContents.includes(item.id))

    diffItems.added = renderContents
      .filter((id) => !items.some((item) => item.id === id))
      .map((id) => ({ id }))

    console.log('xxx-Diff Items:', diffItems, new Date(), renderContents)

    if (renderContents.length > prevItemLength) {
      queueUpdate(renderContents.slice(prevItemLength))
    } else if (renderContents.length < prevItemLength || diffItems.removed.length > 0) {
      console.log('Before Removal - items:', items)
      console.log('Before Removal - renderContents:', renderContents)

      updateItems(diffItems)

      tick().then(() => {
        queueUpdate($gridItems)

        const gridContainer = document.getElementById(id as unknown as string)

        observeItems(gridContainer)
        updateVisibleItems()
      })
    }

    if ($gridItems.length < renderContents.length) {
      console.warn('[Masonry.svelte] Not rendering all search results.')
    }

    prevItemLength = renderContents.length
  }

  function queueUpdate(newData: Item[]) {
    updateQueue.push(...newData)
    if (!isUpdating) {
      isUpdating = true
      requestAnimationFrame(processUpdateQueue)
    }
  }

  async function processUpdateQueue() {
    const startTime = performance.now()
    const batch = updateQueue.splice(0, BATCH_SIZE)

    if (batch.length > 0) {
      await updateGridBatch(batch)
    }

    const endTime = performance.now()
    const elapsedTime = endTime - startTime

    if (updateQueue.length > 0) {
      const delay = Math.max(0, UPDATE_INTERVAL - elapsedTime)
      setTimeout(() => requestAnimationFrame(processUpdateQueue), delay)
    } else {
      isUpdating = false
      const gridContainer = document.getElementById(id as unknown as string)
      updateVisibleItems()
      await tick()
      observeItems(gridContainer)
    }
  }

  async function updateGridBatch(batch: Item[]) {
    const existingIds = new Set(items.map((item) => item.id))
    const incomingIds = new Set(batch.map((item) => item.id))
    const newItems = batch.filter((item) => !existingIds.has(item.id))

    for (const item of newItems) {
      addItem(item)
      await tick() // Allow the DOM to update
    }
  }

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400

  const dispatch = createEventDispatcher()

  class MasonryGrid {
    container: HTMLElement
    columnCount: number
    gapPercentage: number
    columnWidth: number
    items: Item[]
    minHeight: number
    maxHeight: number
    tree: RedBlackTree
    columnNodes: any[]

    constructor(container: HTMLElement) {
      this.container = container
      this.columnCount = this.getColumnCount()
      this.gapPercentage = 2 // 2% gap (1% on each side)
      this.columnWidth = (100 - this.gapPercentage * (this.columnCount - 1)) / this.columnCount
      this.items = []
      this.minHeight = 50
      this.maxHeight = 450
      this.tree = new RedBlackTree()
      this.columnNodes = []

      this.initializeColumns()

      window.addEventListener('resize', () => this.handleResize())
    }

    getColumnCount(): number {
      const width = window.innerWidth
      if (width < 800) return 1
      if (width < 1100) return 2
      if (width < 1400) return 3
      if (width < 2000) return 4
      return 5
    }

    initializeColumns() {
      this.tree = new RedBlackTree()
      this.columnNodes = []
      for (let i = 0; i < this.columnCount; i++) {
        this.columnNodes.push(this.tree.insert(i, 0))
      }
    }

    reinitializeGrid(items: Item[]): Item[] {
      this.initializeColumns()

      items.sort((a, b) => parseInt(a.style?.top || '0') - parseInt(b.style?.top || '0'))

      items.forEach((item) => {
        const height = item.dom?.classList.contains('space')
          ? item.dom.offsetHeight
          : parseInt(item.style?.height || '0')

        const shortestColumn = this.tree.findMin()
        const columnIndex = shortestColumn.column
        const top = shortestColumn.height
        const left = columnIndex * (this.columnWidth + this.gapPercentage)

        const PADDING_TOP = 0

        const itemStyle = {
          left: `${left}%`,
          top: `${top + PADDING_TOP}px`,
          height: `${height}px`,
          width: `${this.columnWidth}%`
        }

        item.style = itemStyle

        const newHeight = top + height + 44
        const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
        if (updatedNode) {
          this.columnNodes[columnIndex] = updatedNode
        }

        if (item.dom) {
          item.dom.style.visibility = 'visible'
        }
      })

      return items
    }

    addItem(item: Item): Item | null {
      const height = this.getRandomHeight()
      const shortestColumn = this.tree.findMin()
      if (!shortestColumn) return null
      const columnIndex = shortestColumn.column
      const top = shortestColumn.height
      const left = columnIndex * (this.columnWidth + this.gapPercentage)

      const itemStyle = {
        left: `${left}%`,
        top: `${top}px`,
        height: `${height}px`,
        width: `${this.columnWidth}%`,
        background: 'blue'
      }

      const newHeight = top + height + 10 // 10px vertical gap
      const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
      if (updatedNode) {
        this.columnNodes[columnIndex] = updatedNode
      }

      return { ...item, style: itemStyle, dom: null }
    }

    handleResize() {
      const newColumnCount = this.getColumnCount()
      if (newColumnCount !== this.columnCount) {
        this.columnCount = newColumnCount
        this.columnWidth = (100 - this.gapPercentage * (this.columnCount - 1)) / this.columnCount
        this.initializeColumns()
        this.reinitializeGrid(this.items)
      }
    }

    getRandomHeight(): number {
      return (
        Math.floor(Math.random() * (this.maxHeight - this.minHeight + 1)) + this.minHeight + 200
      )
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
      const updatedItems = masonryGrid.reinitializeGrid(items)
      gridItems.set(updatedItems)
      resizedItems.clear()
      updateVisibleItems()
    }
  }

  onMount(async () => {
    created = new Date()
    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement
    masonryGrid = new MasonryGrid(gridContainer)

    gridContainer?.addEventListener('scroll', updateVisibleItems)

    updateVisibleItems()
    await tick()
    observeItems(gridContainer)
  })

  onDestroy(() => {
    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement
    if (gridContainer) {
      gridContainer.removeEventListener('scroll', updateVisibleItems)
    }
    window.removeEventListener('resize', () => masonryGrid.handleResize())
  })

  function observeItems(gridContainer: HTMLElement | null) {
    items.forEach((item) => {
      const itemId = `item-${typeof item.id === 'object' ? item.id.id : item.id}`

      if (gridContainer) {
        const dom = gridContainer.querySelector(`#${itemId}`) as HTMLElement

        if (dom) {
          item.dom = dom
          observeItemHeightChange(item)
        }
      }
    })
  }

  function addItem(incomingItem: Item | null = null) {
    const newItem = incomingItem
      ? transformIncomingData(incomingItem)
      : { id: items.length + 1, content: `Item ${items.length + 1}` }
    const placedItem = masonryGrid.addItem(newItem)
    if (placedItem) {
      itemsStore.update((current) => [...current, placedItem])
      gridItems.update((current) => [...current, placedItem])
    }

    updateVisibleItems()
  }

  function updateItems(diffItems: any) {
    // Remove items
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

    // Add items
    diffItems.added.forEach((newItem) => {
      itemsStore.update((current) => {
        current.push(newItem)
        return current
      })
      gridItems.update((current) => [...current, newItem])
    })
  }

  function updateVisibleItems() {
    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement
    const scrollTop = gridContainer.scrollTop
    const viewportHeight = gridContainer.clientHeight

    dispatch('scroll', { scrollTop, viewportHeight })

    gridItems.update((currentItems) =>
      currentItems.map((item) => {
        const itemTop = parseInt(item.style?.top || '0')
        const itemHeight = parseInt(item.style?.height || '0')
        const itemBottom = itemTop + itemHeight

        return {
          ...item,
          visible:
            itemBottom > scrollTop - UPPER_OVERSHOOT_BOUND &&
            itemTop < scrollTop + viewportHeight + LOWER_OVERSHOOT_BOUND
        }
      })
    )

    const now = new Date().getTime()
    const lastUpdateTime = new Date(created).getTime()
    const timeDifference = now - lastUpdateTime

    if (timeDifference > TIME_TILL_ACTIVATION && isBottomReached()) {
      handleBottomReached()
    }
  }

  function isBottomReached(): boolean {
    const BUFFER =
      scrollVelocity.velocity > 10
        ? 3 * window.innerHeight * (scrollVelocity.velocity / 4)
        : 3 * window.innerHeight

    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement

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

  function calculateItemsToLoad(velocity: number): number {
    const MIN_ITEMS = 1
    const MAX_ITEMS = 10
    const VELOCITY_FACTOR = 1

    let items = Math.round(Math.log(velocity * VELOCITY_FACTOR + 1) * 10)

    return Math.max(MIN_ITEMS, Math.min(items, MAX_ITEMS))
  }

  const handleWheel = (e: WheelEvent) => {
    const gridContainer = document.getElementById(id as unknown as string) as HTMLElement
    const scrollTop = gridContainer.scrollTop

    dispatch('wheel', { event: e, scrollTop })
  }
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

<!-- <pre style="position: fixed; top: 0; left: 0">{JSON.stringify(renderContents.length, null, 2)}</pre>
<pre style="position: fixed; top: 1rem; right: 8rem; z-index: 10000">{JSON.stringify(
    $gridItems.length,
    null,
    2
  )}</pre> -->

<div {id} data-vaul-no-drag class="masonry-grid" on:wheel={handleWheel}>
  {#each $gridItems as item}
    {#key item.id}
      {#if typeof item.id.name !== 'undefined'}
        <div
          class="item space"
          id="item-{item.id.id}"
          style="left: {item.style?.left}; top: {item.style?.top};"
        >
          <div class="item-details" bind:this={item.dom}>
            <Folder folder={item.id} selected={false} on:space-selected on:open-space-as-tab />
          </div>
        </div>
      {:else}
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
            />
          </div>
        </div>
      {/if}
    {/key}
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
