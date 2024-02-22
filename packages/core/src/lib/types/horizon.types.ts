/*
- `cold`: only basic Horizon information is in memory (initial state for all Horizons)
- `warm`: its cards and all required data for rendering are stored in memory
- `hot`: the Horizon is rendered in the DOM and ready for immediate interaction
*/
export type HorizonState = 'cold' | 'warm' | 'hot'

export type HorizonData = {
  id: string
  name: string
  previewImage?: string
  viewOffsetX: number
  stackingOrder: string[]
  createdAt: string
  updatedAt: string
}
