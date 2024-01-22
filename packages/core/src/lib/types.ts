import type { IPositionable } from '@horizon/tela'

export interface Card extends IPositionable<'id'> {
  id: string
  stacking_order: number
  data: {
    title: string
    src: string
  }

  [key: string]: any
}
