export type HistoryEntryType =
  | 'search'
  | 'navigation'
  // Chrome-based browsers
  | 'import_chrome'
  | 'import_brave'
  | 'import_edge'
  | 'import_opera'
  | 'import_vivaldi'
  | 'import_arc'
  // Firefox-based browsers
  | 'import_firefox'
  | 'import_tor'
  | 'import_waterfox'

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
