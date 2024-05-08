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
  title: string
  createdAt: string
  updatedAt: string
  messageIds: string[]
}

export type ChatMessage = {
  id: string
  createdAt: string
  updatedAt: string
  role: string
  content: string
}
