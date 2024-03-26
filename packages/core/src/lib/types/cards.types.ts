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

// TODO: we should make use of this for the resource tags as well
export type CardCreationTrigger =
  | 'draw' // User drew a card
  | 'dnd' // User dragged something onto the horizon to create a card
  | 'paste' // User pasted something onto the horizon to create a card
  | 'duplicate' // User duplicated a card
  | 'protocol' // User clicked a link that opened a card
  | 'system' // System created a card

export interface CardCreationMetadata {
  /** What event triggered the creation */
  trigger?: CardCreationTrigger

  /** Wether the card was or should be put into the foreground */
  foreground?: boolean
}

// NOTE: We should prob prefix all magic cards with magic- or sth. like that
export type CardType = 'browser' | 'text' | 'file' | 'link' | 'ai-text' | 'audio-transcriber'

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
