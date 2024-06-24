export interface CreateSpaceEntryInput {
  resource_id: string
  manually_added: boolean
}

export interface Space {
  id: string
  name: SpaceName
  created_at: string
  updated_at: string
  deleted: number
}

export interface SpaceName {
  [key: string]: any
}

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
