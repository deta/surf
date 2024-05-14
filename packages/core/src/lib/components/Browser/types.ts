export interface BaseTab {
  id: string
  createdAt: string
  updatedAt: string
  section?: string
  title: string
  icon: string
  type: 'page' | 'horizon' | 'chat' | 'empty'
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
}

export interface TabHorizon extends BaseTab {
  type: 'horizon'
  horizonId: string
}

export interface TabEmpty extends BaseTab {
  type: 'empty'
}

export type Tab = TabPage | TabChat | TabHorizon | TabEmpty

export type Chat = {
  id: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'system' | 'assistant'
  content: string
  contentItems?: ChatMessageContentItem[]
  sources?: ChatMessageSource[]
  updatedAt: string
  createdAt: string
}

export type ChatMessageSource = {
  id: string
  resource_id: string
  content: string
  metadata?: {
    timestamp?: number
  }
}

export type ChatMessageContentItem = {
  type: 'text' | 'citation'
  content: string
}
