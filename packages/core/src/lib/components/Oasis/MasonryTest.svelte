<script>
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { onMount, tick } from 'svelte'

  export let renderContents

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
    constructor(container, columnCount) {
      this.container = container
      this.columnCount = columnCount
      this.columnWidth = 100 / columnCount
      this.items = []
      this.minHeight = 50
      this.maxHeight = 250
      this.tree = new RedBlackTree()
      this.columnNodes = []

      for (let i = 0; i < columnCount; i++) {
        this.columnNodes.push(this.tree.insert(i, 0))
      }
    }

    addItem(item) {
      const height = this.getRandomHeight()
      const shortestColumn = this.tree.findMin()
      if (!shortestColumn) return null // Handle case where tree is empty
      const columnIndex = shortestColumn.column
      const top = shortestColumn.height
      const left = columnIndex * this.columnWidth

      const itemStyle = {
        left: `${left}%`,
        top: `${top}px`,
        height: `${height}px`
      }

      const newHeight = top + height + 10 // 10px margin
      const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
      if (updatedNode) {
        this.columnNodes[columnIndex] = updatedNode
      }

      return { ...item, style: itemStyle, dom: null }
    }

    reinitializeGrid(items) {
      // Reset the tree and column nodes
      this.tree = new RedBlackTree()
      this.columnNodes = []
      for (let i = 0; i < this.columnCount; i++) {
        this.columnNodes.push(this.tree.insert(i, 0))
      }

      // Sort items by their current top position to maintain relative order
      items.sort((a, b) => parseInt(a.style.top) - parseInt(b.style.top))

      // Reposition items
      items.forEach((item) => {
        const height = parseInt(item.style.height)
        const shortestColumn = this.tree.findMin()
        const columnIndex = shortestColumn.column
        const top = shortestColumn.height
        const left = columnIndex * this.columnWidth

        item.style = {
          left: `${left}%`,
          top: `${top}px`,
          height: `${height}px`
        }

        const newHeight = top + height + 10 // 10px margin
        const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
        if (updatedNode) {
          this.columnNodes[columnIndex] = updatedNode
        }
      })

      return items
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

  function transformIncomingData(data) {
    return {
      id: data.id,
      content: `Item ${data.id}`,
      metadata: data
    }
  }

  let resizeObserverDebounce
  let resizedItems = new Set()

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
    masonryGrid = new MasonryGrid(gridContainer, 5)

    renderContents.forEach((item) => {
      addItem(item)
    })

    gridContainer.addEventListener('scroll', updateVisibleItems)

    updateVisibleItems()

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
  })

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
        visible: itemBottom > scrollTop - 200 && itemTop < scrollTop + viewportHeight + 200
      }
    })
  }

  export function updateGrid(newData) {
    newData.forEach((item) => {
      addItem(item)
    })
    updateVisibleItems()
  }
</script>

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
</div>

<style>
  .debug {
    position: fixed;
    bottom: 0;
    right: 0;
    color: #fff;
    background-color: #333;
    padding: 0.5rem;
    z-index: 100;
  }
  .masonry-grid {
    position: relative;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }
  .item {
    position: absolute;
    width: calc(20% - 10px);
    box-sizing: border-box;
    padding: 10px;
    transition: opacity 0.12s ease;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
  }

  .item-details {
    font-size: 0.8em;
    margin-top: 5px;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    padding: 1rem;
    justify-content: center;
  }
  .item.visible {
    opacity: 1;
  }
</style>
