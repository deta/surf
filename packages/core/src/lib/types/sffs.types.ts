import type { SFFSResource } from './resources.types'

export type SFFSSearchResultEngine = 'metadata' | 'content' | 'proximity'

export interface SFFSSearchResultItem {
  resource: SFFSResource
  cardIDs: string[]
  engine: SFFSSearchResultEngine
}

export interface SFFSSearchResult {
  items: SFFSSearchResultItem[]
  total: number
  limit: number
  offset: number
}
