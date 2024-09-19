import type { Item, RenderItem } from './types'

export class Node {
  column: number
  height: number
  left: Node | null
  right: Node | null
  parent: Node | null
  color: string

  constructor(column: number, height: number) {
    this.column = column
    this.height = height
    this.left = null
    this.right = null
    this.parent = null
    this.color = 'red'
  }
}

export class RedBlackTree {
  root: Node | null
  NIL: Node

  constructor() {
    this.root = null
    this.NIL = new Node(-1, Infinity)
    this.NIL.color = 'black'
  }

  insert(column: number, height: number) {
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

  fixInsert(k: any) {
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

  leftRotate(x: Node) {
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

  rightRotate(x: Node) {
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

  updateHeight(node: Node, newHeight: number) {
    if (!node) return null
    this.deleteNode(node)
    return this.insert(node.column, newHeight)
  }

  deleteNode(node: Node) {
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

  transplant(u: any, v: any) {
    if (u.parent === null) {
      this.root = v
    } else if (u === u.parent.left) {
      u.parent.left = v
    } else {
      u.parent.right = v
    }
    v.parent = u.parent
  }

  minimum(node: Node) {
    while (node.left !== this.NIL) {
      node = node.left
    }
    return node
  }

  deleteFixup(x: any) {
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

export class MasonryGrid {
  container: HTMLElement
  columnCount: number
  gapPercentage: number
  columnWidth: number
  items: RenderItem[]
  isEverythingSpace: boolean
  minHeight: number
  maxHeight: number
  tree: RedBlackTree
  columnNodes: any[]
  horizontalPadding: number

  constructor(container: HTMLElement, isEverythingSpace: boolean = false) {
    if (!container || !container.offsetWidth) {
      // console.warn('Invalid container element or container has no width. No Masonry Grid created.')
      throw new Error(
        'Invalid container element or container has no width. No Masonry Grid created.'
      )
    }

    this.container = container
    this.items = []
    this.minHeight = 50
    this.maxHeight = 450
    this.tree = new RedBlackTree()
    this.columnNodes = []
    this.isEverythingSpace = isEverythingSpace
    this.horizontalPadding = 28 // 20px horizontal padding

    this.columnCount = this.getColumnCount()
    this.gapPercentage = 1 // 2% gap (1% on each side)
    this.columnWidth =
      (100 -
        this.gapPercentage * (this.columnCount - 1) -
        ((2 * this.horizontalPadding) / this.container.offsetWidth) * 100) /
      this.columnCount

    this.initializeColumns()

    // Bind the method to ensure 'this' context is correct
    this.handleResize = this.handleResize.bind(this)
  }

  getColumnCount(): number {
    const width = this.container.offsetWidth
    if (width <= 600) return 1
    if (width <= 900) return 2
    if (width <= 1200) return 3
    if (width <= 1800) return 4
    return 5
  }

  initializeColumns() {
    this.tree = new RedBlackTree()
    this.columnNodes = []
    for (let i = 0; i < this.columnCount; i++) {
      this.columnNodes.push(this.tree.insert(i, 0))
    }
  }

  reinitializeGrid(items: RenderItem[], skipSort: boolean = false): RenderItem[] {
    if (!this.tree) {
      console.error('RedBlackTree is not initialized.')
      return items
    }

    this.initializeColumns()

    if (!skipSort) {
      items.sort((a, b) => parseInt(a.style?.top || '0') - parseInt(b.style?.top || '0'))
    }

    const itemWidth =
      100 / this.columnCount - (this.gapPercentage * (this.columnCount - 1)) / this.columnCount

    items.forEach((item) => {
      const height = item.dom?.classList.contains('space')
        ? item.dom.offsetHeight
        : parseInt(item.style?.height || '0')

      const shortestColumn = this.tree.findMin()
      if (!shortestColumn) {
        console.error('Failed to find the shortest column.')
        return
      }
      const columnIndex = shortestColumn.column
      const left =
        columnIndex * (this.columnWidth + this.gapPercentage) +
        (this.horizontalPadding / this.container.offsetWidth) * 100
      const top = shortestColumn.height

      const PADDING_TOP = this.isEverythingSpace ? 100 : 20

      const itemStyle = {
        left: `${left}%`,
        top: `${top + PADDING_TOP}px`,
        height: `${height}px`,
        width: `${itemWidth}%`
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

  addItem(item: Item): RenderItem | null {
    const height = this.getRandomHeight()
    const shortestColumn = this.tree.findMin()
    if (!shortestColumn) return null
    const columnIndex = shortestColumn.column
    const left =
      columnIndex * (this.columnWidth + this.gapPercentage) +
      (this.horizontalPadding / this.container.offsetWidth) * 100
    const top = shortestColumn.height

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
    if (!this.container || !this.container.offsetWidth) {
      console.warn('ccc-Invalid container element or container has no width. Resize aborted.')
      return
    }
    const newColumnCount = this.getColumnCount()

    if (newColumnCount !== this.columnCount) {
      this.columnCount = newColumnCount
      this.columnWidth =
        (100 -
          this.gapPercentage * (this.columnCount - 1) -
          ((2 * this.horizontalPadding) / this.container.offsetWidth) * 100) /
        this.columnCount
      this.initializeColumns()
      this.reinitializeGrid(this.items)
    }
  }

  getRandomHeight(): number {
    return Math.floor(Math.random() * (this.maxHeight - this.minHeight + 1)) + this.minHeight + 200
  }
}
