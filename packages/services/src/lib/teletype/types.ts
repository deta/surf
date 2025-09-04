import { type MentionItem } from '@deta/editor'

export interface TeletypeAction {
  id: string
  name: string
  icon: string
  handler: () => void | Promise<void>
  section?: string
  priority?: number
  keywords?: string[]
  description?: string
  shortcut?: string
  buttonText?: string
  providerId?: string

  // Properties needed for teletype filtering logic
  parent?: string | null
  hidden?: boolean
  hiddenOnRoot?: boolean
}

export interface ActionProvider {
  readonly name: string

  /**
   * Whether this provider executes locally (true) or requires async operations like network calls (false)
   * Local providers execute immediately for instant results
   * Async providers stream in results progressively
   */
  readonly isLocal: boolean

  /**
   * Get actions for the given query
   */
  getActions(query: string, mentions: MentionItem[]): Promise<TeletypeAction[]>

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

export interface TeletypeServiceOptions {
  debounceMsLocal?: number
  debounceMsRemote?: number
  maxActionsPerProvider?: number
  enabledProviders?: string[]
}

export interface SearchState {
  query: string
  isLoading: boolean
  actions: TeletypeAction[]
  lastUpdated: number
}
