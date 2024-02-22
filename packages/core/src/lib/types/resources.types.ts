import type { Card, CardFile, CardLink, CardText } from '.'

export interface SFFSResourceMetadata {
  name: string
  sourceURI: string
  alt: string
}

export interface SFFSResourceTag {
  id: string
  name: string
  value: string
}

export interface SFFSResource {
  id: string
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]
}

export interface MockResource {
  id: string
  type: 'file' | 'link' | 'text' | 'unknown'
  data: CardLink['data']['url'] | CardFile['data'] | CardText['data']['content'] | null
  createdAt: string
  updatedAt: string
  cards: Card[]
}
