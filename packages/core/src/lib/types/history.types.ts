export type HistoryEntryType = 'navigation' | 'search' | 'chat' | 'rag'

export interface HistoryEntry {
  id: string
  createdAt: string
  updatedAt: string
  type: HistoryEntryType
  url?: string
  title?: string
  searchQuery?: string
}

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  partition: string
  userId: string
}
