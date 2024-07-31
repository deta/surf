<script>
  import { onMount, createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let gridGap = '2rem'
  export let colWidth = 'minmax(250px, 330px)'
  export let refreshLayout = () => {}

  // Convert gridGap to percentage
  const gapPercentage = ((parseFloat(gridGap) / 16) * 100) / 100 // Assuming 1rem = 16px

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
    constructor(container, initialColumnCount, gap) {
      this.container = container
      this.columnCount = initialColumnCount
      this.gap = gap
      this.updateColumnWidth()
      this.items = []
      this.tree = new RedBlackTree()
      this.columnNodes = []

      this.initializeColumns()
    }

    updateColumnWidth() {
      const totalGapWidth = (this.columnCount - 1) * this.gap
      this.columnWidth = (100 - totalGapWidth) / this.columnCount
    }

    initializeColumns() {
      this.columnNodes = []
      for (let i = 0; i < this.columnCount; i++) {
        this.columnNodes.push(this.tree.insert(i, 0))
      }
    }

    addItem(item, height) {
      const shortestColumn = this.tree.findMin()
      if (!shortestColumn) return null
      const columnIndex = shortestColumn.column
      const top = shortestColumn.height
      const left = columnIndex * (this.columnWidth + this.gap)

      const itemStyle = {
        left: `${left}%`,
        top: `${top}px`,
        width: `${this.columnWidth}%`
      }

      const newHeight = top + height + this.gap
      const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
      if (updatedNode) {
        this.columnNodes[columnIndex] = updatedNode
      }

      return { ...item, style: itemStyle }
    }

    reflow(newColumnCount) {
      if (this.columnCount === newColumnCount) return

      this.columnCount = newColumnCount
      this.updateColumnWidth()
      this.tree = new RedBlackTree()
      this.initializeColumns()

      // Recalculate positions for all items
      return this.items.map((item) => {
        const shortestColumn = this.tree.findMin()
        if (!shortestColumn) return item

        const columnIndex = shortestColumn.column
        const top = shortestColumn.height
        const left = columnIndex * (this.columnWidth + this.gap)

        const newStyle = {
          left: `${left}%`,
          top: `${top}px`,
          width: `${this.columnWidth}%`
        }

        const itemHeight = item.height
        const newHeight = top + itemHeight + this.gap
        const updatedNode = this.tree.updateHeight(shortestColumn, newHeight)
        if (updatedNode) {
          this.columnNodes[columnIndex] = updatedNode
        }

        return { ...item, style: newStyle }
      })
    }
  }

  let gridItems = []
  let masonryGrid
  let gridContainer

  function getColumnCount() {
    const width = gridContainer ? gridContainer.clientWidth : window.innerWidth
    const minColWidth = parseInt(colWidth.match(/\d+/)[0])
    return Math.floor(width / (minColWidth + parseFloat(gridGap)))
  }

  onMount(() => {
    gridContainer = document.getElementById('grid')
    masonryGrid = new MasonryGrid(gridContainer, getColumnCount(), gapPercentage)

    // Set up resize event listener
    window.addEventListener('resize', handleResize)

    // Initial layout
    refreshLayout = () => {
      const items = Array.from(gridContainer.children).filter((child) =>
        child.classList.contains('masonry-item')
      )
      layoutItems(items)
    }
    refreshLayout()
  })

  function layoutItems(items) {
    masonryGrid.items = []
    gridItems = items
      .map((item) => {
        const rect = item.getBoundingClientRect()
        const placedItem = masonryGrid.addItem(item, rect.height)
        if (placedItem) {
          masonryGrid.items.push(placedItem)
          return placedItem
        }
        return null
      })
      .filter(Boolean)
    updateItemPositions()
  }

  function updateItemPositions() {
    gridItems.forEach((item) => {
      item.style.left = item.style.left
      item.style.top = item.style.top
      item.style.width = item.style.width
    })
  }

  function handleResize() {
    const newColumnCount = getColumnCount()
    const reflowedItems = masonryGrid.reflow(newColumnCount)
    if (reflowedItems) {
      gridItems = reflowedItems
      updateItemPositions()
    }
  }

  // Expose a method to handle new items being added
  export function handleItemLoad(item) {
    const rect = item.getBoundingClientRect()
    const placedItem = masonryGrid.addItem(item, rect.height)
    if (placedItem) {
      masonryGrid.items.push(placedItem)
      gridItems = [...gridItems, placedItem]
      updateItemPositions()
    }
  }
</script>

<div
  id="grid"
  class="masonry-grid"
  style="grid-gap: {gridGap}; grid-template-columns: repeat(auto-fill, {colWidth});"
>
  <slot />
</div>

<style>
  .masonry-grid {
    position: relative;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    display: grid;
  }
  :global(.masonry-item) {
    position: absolute;
    transition:
      left 0.3s ease,
      top 0.3s ease,
      width 0.3s ease;
  }
</style>
