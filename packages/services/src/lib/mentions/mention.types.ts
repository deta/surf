export interface MentionItem {
  id: string
  type: MentionType
  name: string
  icon: string
  description?: string
  metadata?: Record<string, any>
  priority?: number
  keywords?: string[]
}

export const MentionTypes = {
  TAB: 'tab',
  RESOURCE: 'resource',
  NOTEBOOK: 'notebook',
  ALL_TABS: 'all-tabs',
  ACTIVE_TAB: 'active-tab'
} as const

export type MentionType = (typeof MentionTypes)[keyof typeof MentionTypes]

export interface MentionProvider {
  readonly name: string
  readonly type: MentionType

  /**
   * Whether this provider executes locally (true) or requires async operations (false)
   * Local providers execute immediately for instant results
   * Async providers stream in results progressively
   */
  readonly isLocal: boolean

  /**
   * Get mention items for the given query
   */
  getMentions(query: string): Promise<MentionItem[]>

  /**
   * Check if this provider can handle the given query
   */
  canHandle(query: string): boolean

  /**
   * Initialize the provider with dependencies
   */
  initialize?(): Promise<void>

  /**
   * Cleanup resources when provider is removed
   */
  destroy?(): void
}

export interface MentionServiceOptions {
  debounceMs?: number
  maxItemsPerProvider?: number
  enabledProviders?: string[]
  enabledTypes?: MentionType[]
}

export interface MentionSearchState {
  query: string
  isLoading: boolean
  items: MentionItem[]
  lastUpdated: number
}

export interface MentionSelection {
  item: MentionItem
  insertText: string
  displayText: string
}
