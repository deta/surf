export interface Item {
  id: string
  data: any
}

export interface RenderItem {
  id: string
  data?: Item['data']
  style?: {
    left?: string
    top?: string
    height?: string
    width?: string
  }
  dom?: HTMLElement | null
  visible?: boolean
}

export interface ScrollVelocity {
  scrollTop: number
  timestamp: number
  velocity: number
}

export type DiffItems = {
  added: Item[]
  removed: RenderItem[]
}
