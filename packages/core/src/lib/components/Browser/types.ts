export interface BaseTab {
  id: string
  createdAt: string
  updatedAt: string
  section?: string
  title: string
  icon: string
  type: 'page' | 'horizon' | 'chat' | 'empty' | 'importer'
  archived: boolean
}

export interface TabPage extends BaseTab {
  type: 'page'
  initialLocation: string
  historyStackIds: string[]
  currentHistoryIndex: number
  resourceBookmark?: string | null
}

export interface TabChat extends BaseTab {
  type: 'chat'
  query: string
  chatId?: string
  apiEndpoint?: string
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

export type Tab = TabPage | TabChat | TabHorizon | TabEmpty | TabImporter

export type AIChat = {
  id: string
  messages: AIChatMessage[]
}

export type AIChatMessage = {
  role: 'user' | 'system' | 'assistant'
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
}

export type AIChatMessageSource = {
  id: string
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
