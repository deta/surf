import type { ContextViewDensity, ContextViewType } from '@deta/types'
import type { SpaceEntrySortBy } from './sffs.types'
import type { Icons } from '@deta/icons'

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

/**
 * Space metadata for hierarchical organization of spaces
 */
export interface NestingData {
  parentSpaces?: string[]
  childSpaces?: string[]
  hasChildren: boolean
  hasParents: boolean
}

export interface SpaceData {
  folderName: string
  description?: string
  colors?: [string, string]
  icon?: Icons
  emoji?: string
  imageIcon?: string
  showInSidebar: boolean
  sources?: SpaceSource[]
  liveModeEnabled: boolean
  smartFilterQuery: string | null
  sortBy?: SpaceEntrySortBy
  sortOrder?: 'asc' | 'desc'
  sql_query: string | null
  embedding_query: string | null
  builtIn?: boolean
  default?: boolean
  index?: number
  pinned?: boolean
  viewType?: ContextViewType
  viewDensity?: ContextViewDensity
  selectedNoteResource?: string
  nestingData?: NestingData
  useAsBrowsingContext?: boolean
  imported?: boolean
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
  entry_id: string
  entry_type: string
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

/**
 * Response type for space contents
 */
export interface SpaceContentsResponse {
  space: SpaceData
  childSpaces: SpaceData[]
  resources: string[]
  path: {
    id: string
    name: string
  }[]
}

/**
 * Request to move a resource between spaces
 */
export interface MoveResourceRequest {
  resourceId: string
  sourceId: string
  targetId: string
}

export interface CreateSubSpaceRequest {
  parentId: string
  name: string
  description?: string
  emoji?: string
  colors?: [string, string]
  useAsBrowsingContext?: boolean
}

export type SpaceIconChange = {
  colors?: [string, string]
  emoji?: string
  imageIcon?: string
}
