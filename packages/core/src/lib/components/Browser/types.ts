export interface BaseTab {
  id: string
  createdAt: string
  updatedAt: string
  section?: string
  title: string
  icon: string
  type: 'page' | 'horizon' | 'chat' | 'empty' | 'importer' | 'space' | 'oasis-discovery'
  archived: boolean
}

export interface TabPage extends BaseTab {
  type: 'page'
  initialLocation: string
  historyStackIds: string[]
  currentHistoryIndex: number
  resourceBookmark?: string | null
  chatResourceBookmark?: string | null
  chatId?: string | null
}

export interface TabChat extends BaseTab {
  type: 'chat'
  query: string
  chatId?: string
  apiEndpoint?: string
  ragOnly?: boolean
}

export interface TabHorizon extends BaseTab {
  type: 'horizon'
  horizonId: string
}

export interface TabEmpty extends BaseTab {
  type: 'empty'
}

export interface TabImporter extends BaseTab {
  type: 'importer'
}

export interface TabOasisDiscovery extends BaseTab {
  type: 'oasis-discovery'
}

export interface TabSpace extends BaseTab {
  type: 'space'
  spaceId: string
}

export type Tab =
  | TabPage
  | TabChat
  | TabHorizon
  | TabEmpty
  | TabImporter
  | TabSpace
  | TabOasisDiscovery

export type AIChat = {
  id: string
  messages: AIChatMessage[]
}

export type AIChatMessage = {
  role: 'user' | 'system' | 'assistant'
  status: 'success' | 'pending' | 'error'
  query: string
  content: string
  sources?: AIChatMessageSource[]
}

export type AIChatMessageParsed = {
  id: string
  role: 'user' | 'system' | 'assistant'
  query: string
  content: string
  contentItems?: ChatMessageContentItem[]
  sources?: AIChatMessageSource[]
  status?: 'success' | 'pending' | 'error'
}

export type AIChatMessageSource = {
  id: string
  all_chunk_ids: string[]
  render_id: string
  resource_id: string
  content: string
  metadata?: {
    timestamp?: number
    url?: string
  }
}

export type ChatMessageContentItem = {
  type: 'text' | 'citation'
  content: string
}

export type PageMagicResponse = {
  id: string
  role: 'system' | 'user'
  query?: string
  status: 'success' | 'pending' | 'error'
  content: string
  citations: Record<string, { color: string; text: string }>
}

export type PageMagic = {
  tabId: string
  showSidebar: boolean
  running: boolean
  responses: AIChatMessageParsed[]
}

export type PageHighlight = {
  type: 'important' | 'statistic' | 'pro' | 'contra' | 'quote'
  color?: string
  text: string
}
