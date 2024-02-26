import type { SFFSResourceItem } from './resources.types'

export type SFFSSearchResultEngine = 'metadata' | 'content' | 'proximity'

export interface SFFSSearchResultItem {
  resource: SFFSResourceItem
  cardIDs: string[]
  engine: SFFSSearchResultEngine
}

export interface SFFSSearchResult {
  items: SFFSSearchResultItem[]
  total: number
  limit: number
  offset: number
}

/*
 RAW TYPES FROM SFFS BASED ON model.rs
*/

export type SFFSRawResource = {
  id: string
  resource_path: string
  resource_type: string
  created_at: string
  updated_at: string
  deleted: number
}

export type SFFSRawResourceMetadata = {
  id: string
  resource_id: string
  name: string
  source_uri: string
  alt: string
}

export type SFFSRawResourceTag = {
  id: string
  resource_id: string
  tag_name: string
  tag_value: string
}

export type SFFSRawResourceTextContent = {
  id: string
  resource_id: string
  content: string
}

export interface SFFSRawCompositeResource {
  resource: SFFSRawResource
  metadata?: SFFSRawResourceMetadata
  textContent?: SFFSRawResourceTextContent
  resourceTags?: SFFSRawResourceTag[]
}
