import type { IPositionable } from '@horizon/tela'

export type CardEvents = {
  change: Card
  load: Card
  delete: Card
  duplicate: Card
  beginDrag: Card
  endDrag: Card
  beginResize: Card
  endResize: Card
}

export type CardType = 'browser' | 'text' | 'file' | 'link'

export type CardPosition = Pick<IPositionable<'id'>, 'x' | 'y' | 'width' | 'height'>

export interface Card extends IPositionable<'id'> {
  id: string
  horizonId: string
  createdAt: string
  updatedAt: string
  stackingOrder: number
  type: CardType
  data: CardBrowser['data'] | null
  resourceId: string | null
  [key: string]: any
}

export interface LegacyResource {
  id: string
  data: Blob
  createdAt: string
  updatedAt: string
  [key: string]: any
}

export interface CardBrowser extends Card {
  type: 'browser'
  data: {
    initialLocation: string
    historyStackIds: string[]
    currentHistoryIndex: number
  }
}
