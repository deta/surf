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
