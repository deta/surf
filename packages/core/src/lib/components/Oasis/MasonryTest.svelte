<script>
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { onMount, tick, createEventDispatcher } from 'svelte'

  export let renderContents

  const UPPER_OVERSHOOT_BOUND = 1400
  const LOWER_OVERSHOOT_BOUND = 1400

  const dispatch = createEventDispatcher()

  $: if (renderContents) {
    tick().then(() => {
      updateGrid(renderContents)
    })
  }

  class Node {
    constructor(column, height) {
      this.column = column
      this.height = height
      this.left = null
      this.right = null
      this.parent = null
      this.color = 'red'
    }
  }

  class RedBlackTree {
    constructor() {
      this.root = null
      this.NIL = new Node(-1, Infinity)
      this.NIL.color = 'black'
    }

    insert(column, height) {
      let node = new Node(column, height)
      node.left = this.NIL
      node.right = this.NIL

      let y = null
      let x = this.root

      while (x !== this.NIL && x !== null) {
        y = x
        if (node.height < x.height) {
          x = x.left
        } else {
          x = x.right
        }
      }

      node.parent = y
      if (y === null) {
        this.root = node
      } else if (node.height < y.height) {
        y.left = node
      } else {
        y.right = node
      }

      this.fixInsert(node)
      return node
    }

    fixInsert(k) {
      while (k.parent && k.parent.color === 'red') {
        if (k.parent === k.parent.parent.left) {
          let u = k.parent.parent.right
          if (u && u.color === 'red') {
            k.parent.color = 'black'
            u.color = 'black'
            k.parent.parent.color = 'red'
            k = k.parent.parent
          } else {
            if (k === k.parent.right) {
              k = k.parent
              this.leftRotate(k)
            }
            k.parent.color = 'black'
            k.parent.parent.color = 'red'
            this.rightRotate(k.parent.parent)
          }
        } else {
          let u = k.parent.parent.left
          if (u && u.color === 'red') {
            k.parent.color = 'black'
            u.color = 'black'
            k.parent.parent.color = 'red'
            k = k.parent.parent
          } else {
            if (k === k.parent.left) {
              k = k.parent
              this.rightRotate(k)
            }
            k.parent.color = 'black'
            k.parent.parent.color = 'red'
            this.leftRotate(k.parent.parent)
          }
        }
        if (k === this.root) {
          break
        }
      }
      this.root.color = 'black'
    }

    leftRotate(x) {
      let y = x.right
      x.right = y.left
      if (y.left !== this.NIL) {
        y.left.parent = x
      }
      y.parent = x.parent
      if (x.parent === null) {
        this.root = y
      } else if (x === x.parent.left) {
        x.parent.left = y
      } else {
        x.parent.right = y
      }
      y.left = x
      x.parent = y
    }

    rightRotate(x) {
      let y = x.left
      x.left = y.right
      if (y.right !== this.NIL) {
        y.right.parent = x
      }
      y.parent = x.parent
      if (x.parent === null) {
        this.root = y
      } else if (x === x.parent.right) {
        x.parent.right = y
      } else {
        x.parent.left = y
      }
      y.right = x
      x.parent = y
    }

    findMin() {
      let x = this.root
      if (!x) return null
      while (x.left !== this.NIL && x.left !== null) {
        x = x.left
      }
      return x
    }

    updateHeight(node, newHeight) {
      if (!node) return null
      this.deleteNode(node)
      return this.insert(node.column, newHeight)
    }

    deleteNode(node) {
      if (!node) return
      let y = node
      let yOriginalColor = y.color
      let x

      if (node.left === this.NIL) {
        x = node.right
        this.transplant(node, node.right)
      } else if (node.right === this.NIL) {
        x = node.left
        this.transplant(node, node.left)
      } else {
        y = this.minimum(node.right)
        yOriginalColor = y.color
        x = y.right
        if (y.parent === node) {
          x.parent = y
        } else {
          this.transplant(y, y.right)
          y.right = node.right
          y.right.parent = y
        }
        this.transplant(node, y)
        y.left = node.left
        y.left.parent = y
        y.color = node.color
      }
      if (yOriginalColor === 'black') {
        this.deleteFixup(x)
      }
    }

    transplant(u, v) {
      if (u.parent === null) {
        this.root = v
      } else if (u === u.parent.left) {
        u.parent.left = v
      } else {
        u.parent.right = v
      }
      v.parent = u.parent
    }

    minimum(node) {
      while (node.left !== this.NIL) {
        node = node.left
      }
      return node
    }

    deleteFixup(x) {
      while (x !== this.root && x.color === 'black') {
        if (x === x.parent.left) {
          let w = x.parent.right
          if (w.color === 'red') {
            w.color = 'black'
            x.parent.color = 'red'
            this.leftRotate(x.parent)
            w = x.parent.right
          }
          if (w.left.color === 'black' && w.right.color === 'black') {
            w.color = 'red'
            x = x.parent
          } else {
            if (w.right.color === 'black') {
              w.left.color = 'black'
              w.color = 'red'
              this.rightRotate(w)
              w = x.parent.right
            }
            w.color = x.parent.color
            x.parent.color = 'black'
            w.right.color = 'black'
            this.leftRotate(x.parent)
            x = this.root
          }
        } else {
          let w = x.parent.left
          if (w.color === 'red') {
            w.color = 'black'
            x.parent.color = 'red'
            this.rightRotate(x.parent)
            w = x.parent.left
          }
          if (w.right.color === 'black' && w.left.color === 'black') {
            w.color = 'red'
            x = x.parent
          } else {
            if (w.left.color === 'black') {
              w.right.color = 'black'
              w.color = 'red'
              this.leftRotate(w)
              w = x.parent.left
            }
            w.color = x.parent.color
            x.parent.color = 'black'
            w.left.color = 'black'
            this.rightRotate(x.parent)
            x = this.root
          }
        }
      }
      x.color = 'black'
    }
  }

  class MasonryGrid {
    constructor(container) {
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

      window.addEventListener('resize', this.handleResize.bind(this))
    }

    getColumnCount() {
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

    reinitializeGrid(items) {
      this.initializeColumns()

      items.sort((a, b) => parseInt(a.style.top) - parseInt(b.style.top))

      items.forEach((item, index) => {
        const height = parseInt(item.style.height)
        const shortestColumn = this.tree.findMin()
        const columnIndex = shortestColumn.column
        const top = shortestColumn.height
        const left = columnIndex * (this.columnWidth + this.gapPercentage)

        const PADDING_TOP = 120

        const itemStyle = {
          left: `${left}%`,
          top: `${top + PADDING_TOP}px`,
          height: `${height}px`,
          width: `${this.columnWidth}%`
        }

        item.style = itemStyle

        const newHeight = top + height + 10 // 10px vertical gap
        const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
        if (updatedNode) {
          this.columnNodes[columnIndex] = updatedNode
        }
      })

      return items
    }

    addItem(item) {
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
        width: `${this.columnWidth}%`
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
      console.log(`Window resized. New column count: ${newColumnCount}`)
      if (newColumnCount !== this.columnCount) {
        this.columnCount = newColumnCount
        this.columnWidth = (100 - this.gapPercentage * (this.columnCount - 1)) / this.columnCount
        this.initializeColumns()
        this.reinitializeGrid(this.items)
      }
    }
    getRandomHeight() {
      return (
        Math.floor(Math.random() * (this.maxHeight - this.minHeight + 1)) + this.minHeight + 200
      )
    }
  }

  export let items = []
  let gridItems = []
  let masonryGrid
  let resizeObserverDebounce
  let resizedItems = new Set()
  let scrollVelocity = {
    scrollTop: 0,
    timestamp: 0,
    velocity: 0
  }

  function transformIncomingData(data) {
    return {
      id: data.id,
      content: `Item ${data.id}`,
      metadata: data
    }
  }

  function observeItemHeightChange(item) {
    const observer = new ResizeObserver(() => {
      const resourcePreview = item.dom.querySelector('.resource-preview')
      if (resourcePreview) {
        const height = resourcePreview.offsetHeight
        item.style.height = `${height}px`
        resizedItems.add(item)

        clearTimeout(resizeObserverDebounce)
        resizeObserverDebounce = setTimeout(reinitializeGridAfterResize, 100)
      }
    })
    observer.observe(item.dom.querySelector('.resource-preview'))
  }

  function reinitializeGridAfterResize() {
    if (resizedItems.size > 0) {
      const updatedItems = masonryGrid.reinitializeGrid(items)
      items = updatedItems
      gridItems = updatedItems
      resizedItems.clear()
      updateVisibleItems()
    }
  }

  onMount(() => {
    const gridContainer = document.getElementById('grid')
    masonryGrid = new MasonryGrid(gridContainer)

    renderContents.forEach((item) => {
      addItem(item)
    })

    gridContainer.addEventListener('scroll', updateVisibleItems)

    updateVisibleItems()

    observeItems(gridContainer)
  })

  function observeItems(gridContainer) {
    const observer = new MutationObserver(() => {
      items.forEach((item) => {
        const dom = document.getElementById(`item-${item.id}`)
        if (dom) {
          item.dom = dom
          observeItemHeightChange(item)
        }
      })

      observer.disconnect()
    })

    observer.observe(gridContainer, { childList: true, subtree: true })
  }

  function addItem(incomingItem = null) {
    const newItem = incomingItem
      ? transformIncomingData(incomingItem)
      : { id: items.length + 1, content: `Item ${items.length + 1}` }
    const placedItem = masonryGrid.addItem(newItem)
    if (placedItem) {
      items = [...items, placedItem]
      gridItems = [...gridItems, placedItem]
    }
  }

  function updateVisibleItems() {
    const gridContainer = document.getElementById('grid')
    const scrollTop = gridContainer.scrollTop
    const viewportHeight = gridContainer.clientHeight

    gridItems = items.map((item) => {
      const itemTop = parseInt(item.style.top)
      const itemHeight = parseInt(item.style.height)
      const itemBottom = itemTop + itemHeight

      return {
        ...item,
        visible:
          itemBottom > scrollTop - UPPER_OVERSHOOT_BOUND &&
          itemTop < scrollTop + viewportHeight + LOWER_OVERSHOOT_BOUND
      }
    })

    if (isBottomReached()) {
      handleBottomReached()
    }
  }

  function isBottomReached() {
    const BUFFER =
      scrollVelocity.velocity > 10
        ? 3 * window.innerHeight * (scrollVelocity.velocity / 4)
        : 3 * window.innerHeight

    const gridContainer = document.getElementById('grid')
    return (
      gridContainer.scrollHeight - gridContainer.scrollTop <= gridContainer.clientHeight + BUFFER
    )
  }

  function handleBottomReached() {
    const itemsToLoad = calculateItemsToLoad(scrollVelocity.velocity)
    dispatch('load-more', itemsToLoad)
  }

  function calculateItemsToLoad(velocity) {
    const MIN_ITEMS = 20
    const MAX_ITEMS = 400
    const VELOCITY_FACTOR = 30

    // Logarithmic function to create a curve
    let items = Math.round(Math.log(velocity * VELOCITY_FACTOR + 1) * 10)

    // Ensure the result is within our defined limits
    return Math.max(MIN_ITEMS, Math.min(items, MAX_ITEMS))
  }

  export function updateGrid(newData) {
    const gridContainer = document.getElementById('grid')

    const existingIds = new Set(items.map((item) => item.id))
    const newItems = newData.filter((item) => !existingIds.has(item.id))
    newItems.forEach((item) => {
      addItem(item)
    })
    updateVisibleItems()

    observeItems(gridContainer)
  }
</script>

<svelte:window
  on:wheel={(event) => {
    const gridContainer = document.getElementById('grid')
    const newScrollTop = gridContainer.scrollTop
    const newTimestamp = event.timeStamp

    if (scrollVelocity !== undefined) {
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

<div id="grid" class="masonry-grid">
  <div class="debug">
    Total items: {items.length} | Visible items: {gridItems.filter((item) => item.visible).length}
    <button on:click={() => navigator.clipboard.writeText(JSON.stringify(renderContents[0]))}>
      Copy Data Coming In
    </button>
    <button on:click={() => navigator.clipboard.writeText(JSON.stringify(items[0]))}>
      Copy Current Set
    </button>
  </div>
  {#each gridItems as item (item.id)}
    <div
      class="item"
      id="item-{item.id}"
      class:visible={item.visible}
      style="left: {item.style.left}; top: {item.style.top}; height: {item.style.height};"
    >
      <div class="item-details" bind:this={item.dom}>
        <ResourcePreviewClean
          resource={item.metadata.resource}
          annotations={item.metadata.annotations}
        />
      </div>
    </div>
  {/each}
  <slot />
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
      opacity 0.12s ease,
      left 0.12s ease,
      top 0.12s ease,
      width 0.12s ease;
    will-change: opacity, left, top, width;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
  }

  .debug {
    position: fixed;
    bottom: 0;
    right: 0;
    background: black;
    color: white;
    padding: 10px;
    z-index: 1000;
  }

  .item-details {
    font-size: 0.8em;
    margin-top: 5px;
    padding: 2rem 0;
    width: 100%;
  }
  .item.visible {
    opacity: 1;
  }

  /* Responsive widths */
  @media (max-width: 800px) {
    .item {
      width: 100%;
    }
  }
  @media (min-width: 801px) and (max-width: 1100px) {
    .item {
      width: 49%;
    } /* (100% - 2% gap) / 2 */
  }
  @media (min-width: 1101px) and (max-width: 1400px) {
    .item {
      width: 32%;
    } /* (100% - 4% gap) / 3 */
  }
  @media (min-width: 1401px) and (max-width: 2000px) {
    .item {
      width: 23.5%;
    } /* (100% - 6% gap) / 4 */
  }
  @media (min-width: 2001px) {
    .item {
      width: 18.4%;
    } /* (100% - 8% gap) / 5 */
  }
</style>
