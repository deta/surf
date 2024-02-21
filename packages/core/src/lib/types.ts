import type { IPositionable } from '@horizon/tela'
import type { JSONContent } from '@horizon/editor'

export type CardEvents = {
  change: Card
  load: Card
  delete: Card
  duplicate: Card
}

/*
- `cold`: only basic Horizon information is in memory (initial state for all Horizons)
- `warm`: its cards and all required data for rendering are stored in memory
- `hot`: the Horizon is rendered in the DOM and ready for immediate interaction
*/
export type HorizonState = 'cold' | 'warm' | 'hot'

export type CardType = 'browser' | 'text' | 'file' | 'link'

export type CardPosition = Pick<IPositionable<'id'>, 'x' | 'y' | 'width' | 'height'>

export type UserData = {
  id: string
  user_id: string
}

export type HorizonData = {
  id: string
  name: string
  previewImage?: string
  viewOffsetX: number
  stackingOrder: string[]
  createdAt: string
  updatedAt: string
}

export interface Card extends IPositionable<'id'> {
  id: string
  horizon_id: string
  createdAt: string
  updatedAt: string
  stacking_order: number
  type: CardType
  data: CardBrowser['data'] | CardText['data'] | CardFile['data'] | CardLink['data']
  [key: string]: any
}

export interface Resource {
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

export interface CardText extends Card {
  type: 'text'
  data: {
    content: JSONContent
  }
}

export interface CardFile extends Card {
  type: 'file'
  data: {
    name?: string
    mimetype: string
    resourceId: string
  }
}

export interface CardLink extends Card {
  type: 'link'
  data: {
    title?: string
    url: string
  }
}

export interface HistoryEntry {
  id: string
  createdAt: string
  updatedAt: string
  sessionId: string
  type: 'navigation' | 'search'
  url?: string
  title?: string
  searchQuery?: string
  inPageNavigation?: boolean
}

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  partition: string
  userId: string
}

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
