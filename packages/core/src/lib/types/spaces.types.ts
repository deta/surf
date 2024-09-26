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
  colors: [string, string]
  showInSidebar: boolean
  sources?: SpaceSource[]
  liveModeEnabled: boolean
  hideViewed: boolean
  smartFilterQuery: string | null
  sortBy: 'created_at' | 'source_published_at'
  sql_query: string | null
  embedding_query: string | null
  builtIn?: boolean
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
