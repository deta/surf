import type { Optional } from '.'

export type SFFSSearchResultEngineRaw = 'Keyword' | 'Proximity' | 'Semantic'

export interface SFFSSearchResultRawItem {
  resource: SFFSRawCompositeResource
  card_ids: string[]
  engine: SFFSSearchResultEngineRaw
}

export interface SFFSSearchResult {
  items: SFFSSearchResultRawItem[]
  total: number
  // limit: number
  // offset: number
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
  user_context: string
}

export type SFFSRawResourceTag = {
  id: string
  resource_id: string
  tag_name: string
  tag_value: string
  op?: 'eq' | 'ne' | 'prefix' | 'suffix'
}

export type SFFSRawResourceTextContent = {
  id: string
  resource_id: string
  content: string
}

export interface SFFSRawCompositeResource {
  resource: SFFSRawResource
  metadata?: SFFSRawResourceMetadata
  text_content?: SFFSRawResourceTextContent
  resource_tags?: SFFSRawResourceTag[]
  resource_annotations?: SFFSRawResource[]
}

export interface SFFSRawCard {
  id: string
  horizon_id: string
  card_type: string
  resource_id?: string
  position_id: number
  position_x: number
  position_y: number
  width: number
  height: number
  stacking_order: string
  created_at: string
  updated_at: string
  data: number[]
}

export type SFFSRawCardToCreate = Optional<
  SFFSRawCard,
  'id' | 'stacking_order' | 'created_at' | 'updated_at'
>

export interface SFFSRawHorizon {
  id: string
  horizon_name: string
  view_offset_x: number
  icon_uri?: string
  created_at: string
  updated_at: string
}

export type SFFSRawHorizonToCreate = Optional<SFFSRawHorizon, 'id' | 'created_at' | 'updated_at'>

export type SFFSRawHistoryEntryType = 'Search' | 'Navigation'

export interface SFFSRawHistoryEntry {
  id: string
  entry_type: SFFSRawHistoryEntryType
  url: string | null
  title: string | null
  search_query: string | null
  created_at: string
  updated_at: string
}
