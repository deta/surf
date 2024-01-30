import type { IPositionable } from '@horizon/tela'
import type { JSONContent } from '@horizon/editor'

export type CardEvents = {
  change: Card
  load: Card
  delete: Card
}

export type CardType = 'browser' | 'text' | 'file' | 'link'

export type CardPosition = Pick<IPositionable<'id'>, 'x' | 'y' | 'width' | 'height'>

export interface Card extends IPositionable<'id'> {
  id: string
  horizon_id: string
  stacking_order: number
  type: CardType
  data: CardBrowser['data'] | CardText['data'] | CardFile['data'] | CardLink['data']
  [key: string]: any
}

export interface CardBrowser extends Card {
  type: 'browser'
  data: {
    initialLocation: string
    historyStack: string[]
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

export interface Resource {
  id: string
  data: Blob
  [key: string]: any
}
