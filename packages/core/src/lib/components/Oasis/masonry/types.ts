interface Item {
  id: number | string
  content?: string
  style?: {
    left?: string
    top?: string
    height?: string
    width?: string
  }
  dom?: HTMLElement | null
  visible?: boolean
}

interface ScrollVelocity {
  scrollTop: number
  timestamp: number
  velocity: number
}
