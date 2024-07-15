class Node {
  constructor(interval, color = 'red', left = null, right = null, parent = null) {
    this.interval = interval
    this.color = color
    this.left = left
    this.right = right
    this.parent = parent
    this.max = interval.bottom
  }
}

class RedBlackTree {
  constructor() {
    this.TNULL = new Node(null, 'black')
    this.root = this.TNULL
  }

  insertInterval(interval) {
    let node = new Node(interval)
    node.left = this.TNULL
    node.right = this.TNULL

    let y = null
    let x = this.root

    while (x !== this.TNULL) {
      y = x
      if (node.interval.top < x.interval.top) {
        x = x.left
      } else {
        x = x.right
      }
    }

    node.parent = y
    if (y === null) {
      this.root = node
    } else if (node.interval.top < y.interval.top) {
      y.left = node
    } else {
      y.right = node
    }

    if (node.parent === null) {
      node.color = 'black'
      return
    }

    if (node.parent.parent === null) {
      return
    }

    this.fixInsert(node)
    this.updateMax(node)
  }

  deleteInterval(interval) {
    this.deleteNodeHelper(this.root, interval)
  }

  deleteNodeHelper(node, interval) {
    let z = this.TNULL
    while (node !== this.TNULL) {
      if (node.interval === interval) {
        z = node
      }

      if (node.interval.top <= interval.top) {
        node = node.right
      } else {
        node = node.left
      }
    }

    if (z === this.TNULL) {
      return
    }

    let y = z
    let yOriginalColor = y.color
    let x
    if (z.left === this.TNULL) {
      x = z.right
      this.rbTransplant(z, z.right)
    } else if (z.right === this.TNULL) {
      x = z.left
      this.rbTransplant(z, z.left)
    } else {
      y = this.minimum(z.right)
      yOriginalColor = y.color
      x = y.right
      if (y.parent === z) {
        x.parent = y
      } else {
        this.rbTransplant(y, y.right)
        y.right = z.right
        y.right.parent = y
      }

      this.rbTransplant(z, y)
      y.left = z.left
      y.left.parent = y
      y.color = z.color
    }
    if (yOriginalColor === 'black') {
      this.fixDelete(x)
    }
    this.updateMax(x)
  }

  queryInterval(interval) {
    let result = []
    this.queryHelper(this.root, interval, result)
    return result
  }

  queryHelper(node, interval, result) {
    if (node === this.TNULL || node === null) {
      return
    }

    if (node.interval.bottom >= interval.top && node.interval.top <= interval.bottom) {
      result.push(node.interval)
    }

    if (node.left !== this.TNULL && node.left.max >= interval.top) {
      this.queryHelper(node.left, interval, result)
    }

    this.queryHelper(node.right, interval, result)
  }

  minimum(node) {
    while (node.left !== this.TNULL) {
      node = node.left
    }
    return node
  }

  fixInsert(node) {
    while (node.parent.color === 'red') {
      if (node.parent === node.parent.parent.right) {
        let u = node.parent.parent.left
        if (u.color === 'red') {
          u.color = 'black'
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          node = node.parent.parent
        } else {
          if (node === node.parent.left) {
            node = node.parent
            this.rightRotate(node)
          }
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          this.leftRotate(node.parent.parent)
        }
      } else {
        let u = node.parent.parent.right
        if (u.color === 'red') {
          u.color = 'black'
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          node = node.parent.parent
        } else {
          if (node === node.parent.right) {
            node = node.parent
            this.leftRotate(node)
          }
          node.parent.color = 'black'
          node.parent.parent.color = 'red'
          this.rightRotate(node.parent.parent)
        }
      }
      if (node === this.root) {
        break
      }
    }
    this.root.color = 'black'
  }

  fixDelete(x) {
    while (x !== this.root && x.color === 'black') {
      if (x === x.parent.left) {
        let s = x.parent.right
        if (s.color === 'red') {
          s.color = 'black'
          x.parent.color = 'red'
          this.leftRotate(x.parent)
          s = x.parent.right
        }

        if (s.left.color === 'black' && s.right.color === 'black') {
          s.color = 'red'
          x = x.parent
        } else {
          if (s.right.color === 'black') {
            s.left.color = 'black'
            s.color = 'red'
            this.rightRotate(s)
            s = x.parent.right
          }

          s.color = x.parent.color
          x.parent.color = 'black'
          s.right.color = 'black'
          this.leftRotate(x.parent)
          x = this.root
        }
      } else {
        let s = x.parent.left
        if (s.color === 'red') {
          s.color = 'black'
          x.parent.color = 'red'
          this.rightRotate(x.parent)
          s = x.parent.left
        }

        if (s.left.color === 'black' && s.right.color === 'black') {
          s.color = 'red'
          x = x.parent
        } else {
          if (s.left.color === 'black') {
            s.right.color = 'black'
            s.color = 'red'
            this.leftRotate(s)
            s = x.parent.left
          }

          s.color = x.parent.color
          x.parent.color = 'black'
          s.left.color = 'black'
          this.rightRotate(x.parent)
          x = this.root
        }
      }
    }
    x.color = 'black'
  }

  rbTransplant(u, v) {
    if (u.parent === null) {
      this.root = v
    } else if (u === u.parent.left) {
      u.parent.left = v
    } else {
      u.parent.right = v
    }
    v.parent = u.parent
  }

  leftRotate(x) {
    let y = x.right
    x.right = y.left
    if (y.left !== this.TNULL) {
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

    x.max = Math.max(x.interval.bottom, Math.max(x.left.max, x.right.max))
    y.max = Math.max(y.interval.bottom, Math.max(y.left.max, y.right.max))
  }

  rightRotate(x) {
    let y = x.left
    x.left = y.right
    if (y.right !== this.TNULL) {
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

    x.max = Math.max(x.interval.bottom, Math.max(x.left.max, x.right.max))
    y.max = Math.max(y.interval.bottom, Math.max(y.left.max, y.right.max))
  }

  updateMax(node) {
    while (node !== null) {
      node.max = Math.max(node.interval.bottom, Math.max(node.left.max, node.right.max))
      node = node.parent
    }
  }
}
