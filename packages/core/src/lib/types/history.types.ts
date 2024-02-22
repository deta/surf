export interface HistoryEntry {
  id: string
  createdAt: string
  updatedAt: string
  sessionId: string
  type: 'navigation' | 'search'
  url?: string
  title?: string
  searchQuery?: string
  inPageNavigation?: boolean
}

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  partition: string
  userId: string
}
