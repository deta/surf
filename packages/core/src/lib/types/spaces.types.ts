import type { ContextViewDensity, ContextViewType } from '@horizon/types'
import type { SpaceEntrySortBy } from './sffs.types'

export interface CreateSpaceEntryInput {
  resource_id: string
  manually_added: number
}

export interface Space {
  id: string
  name: SpaceData
  created_at: string
  updated_at: string
  deleted: number
}

export interface SpaceData {
  folderName: string
  description?: string
  colors?: [string, string]
  emoji?: string
  imageIcon?: string
  showInSidebar: boolean
  sources?: SpaceSource[]
  liveModeEnabled: boolean
  hideViewed: boolean
  smartFilterQuery: string | null
  sortBy?: SpaceEntrySortBy
  sortOrder?: 'asc' | 'desc'
  sql_query: string | null
  embedding_query: string | null
  builtIn?: boolean
  index?: number
  pinned?: boolean
  viewType?: ContextViewType
  viewDensity?: ContextViewDensity
  selectedNoteResource?: string
}

export interface SpaceSource {
  id: string
  name: string
  type: 'rss'
  url: string
  last_fetched_at: string | null
}

export const SpaceEntryOrigin = {
  Blacklisted: 2,
  ManuallyAdded: 1,
  LlmQuery: 0
} as const

export type SpaceEntryOrigin = (typeof SpaceEntryOrigin)[keyof typeof SpaceEntryOrigin]

export interface SpaceEntry {
  id: string
  space_id: string
  resource_id: string
  resource_type?: string
  created_at: string
  updated_at: string
  manually_added: number
}

export interface AiSFFSQueryResponse {
  sql_query: string
  sql_query_results: string[] // resource ids
  embedding_search_query: string | null
  embedding_search_results: string[] | null // narrowed down resource ids, is null if the query is null
}

export const GENERAL_CONTEXT_ID = '__general_context'
