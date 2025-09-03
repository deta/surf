import { writable, derived, get, type Writable, type Readable } from 'svelte/store'
import { useDebounce, useLogScope } from '@deta/utils'
import type { ActionProvider, TeletypeAction, TeletypeServiceOptions, SearchState } from './types'
import { SearchProvider } from './providers/SearchProvider'
import { NavigationProvider } from './providers/NavigationProvider'
import { AskProvider } from './providers/AskProvider'
import { CurrentQueryProvider } from './providers/CurrentQueryProvider'
import { useMessagePortClient } from '../messagePort'
import { type MentionItem } from '@deta/editor'

export class TeletypeService {
  private providers = new Map<string, ActionProvider>()
  private searchState: Writable<SearchState>
  private readonly options: Required<TeletypeServiceOptions>
  private readonly log = useLogScope('TeletypeService')
  private messagePort = useMessagePortClient()
  private queryUnsubscribe?: () => void

  // Public reactive stores
  public readonly query: Writable<string>
  public readonly mentions: Writable<MentionItem[]>
  public readonly isLoading: Readable<boolean>
  public readonly actions: Readable<TeletypeAction[]>

  private debouncedSearch: (query: string) => void

  static self: TeletypeService

  constructor(options: TeletypeServiceOptions = {}) {
    this.options = {
      debounceMs: 200,
      maxActionsPerProvider: 3,
      enabledProviders: [],
      ...options
    }

    // Initialize stores
    this.searchState = writable<SearchState>({
      query: '',
      isLoading: false,
      actions: [],
      lastUpdated: Date.now()
    })

    this.query = writable('')
    this.mentions = writable<MentionItem[]>([])

    // Derived stores
    this.isLoading = derived(this.searchState, ($state) => $state.isLoading)
    this.actions = derived(this.searchState, ($state) => $state.actions)

    // Setup debounced search
    this.debouncedSearch = useDebounce(this.performSearch.bind(this), this.options.debounceMs)

    // Subscribe to query changes
    this.queryUnsubscribe = this.query.subscribe((query) => {
      this.searchState.update((state) => ({ ...state, query }))
      this.debouncedSearch(query)
    })

    // Register local providers
    this.registerProvider(new CurrentQueryProvider()) // Local, instant current query
    this.registerProvider(new NavigationProvider())
  }

  get queryValue() {
    return get(this.query)
  }

  get mentionsValue() {
    return get(this.mentions)
  }

  /**
   * Register a new action provider
   */
  async registerProvider(provider: ActionProvider): Promise<void> {
    if (
      this.options.enabledProviders.length > 0 &&
      !this.options.enabledProviders.includes(provider.name)
    ) {
      return
    }

    this.log.debug('Registering provider:', provider.name)
    this.providers.set(provider.name, provider)

    if (provider.initialize) {
      await provider.initialize()
    }
  }

  /**
   * Unregister an action provider
   */
  unregisterProvider(providerName: string): void {
    const provider = this.providers.get(providerName)
    if (provider) {
      if (provider.destroy) {
        provider.destroy()
      }
      this.providers.delete(providerName)
    }
  }

  /**
   * Get all registered provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Execute an action by its ID
   */
  async executeAction(actionId: string): Promise<void> {
    const currentState = get(this.searchState)
    const action = currentState.actions.find((a) => a.id === actionId)

    if (action) {
      await action.handler()
    }
  }

  /**
   * Set the search query
   */
  setQuery(query: string): void {
    this.query.set(query)
  }

  /**
   * Set the mention items
   */
  setMentions(mentions: MentionItem[]): void {
    this.mentions.set(mentions)
  }

  /**
   * Clear current search and actions
   */
  clear(): void {
    this.query.set('')
    this.searchState.set({
      query: '',
      isLoading: false,
      actions: [],
      lastUpdated: Date.now()
    })
  }

  /**
   * Destroy the service and cleanup all providers
   */
  destroy(): void {
    // Cleanup query subscription
    if (this.queryUnsubscribe) {
      this.queryUnsubscribe()
      this.queryUnsubscribe = undefined
    }

    // Cleanup providers
    for (const provider of this.providers.values()) {
      if (provider.destroy) {
        provider.destroy()
      }
    }
    this.providers.clear()
  }

  async ask(query: string, mentions: MentionItem[]): Promise<void> {
    this.log.debug('Asking question:', query)
    await this.messagePort.teletypeAsk.send({ query, mentions })
    this.clear()
  }

  /**
   * Perform the actual search across all providers using two-phase execution:
   * Phase 1: Execute LOCAL providers immediately for instant results
   * Phase 2: Execute ASYNC providers progressively as they complete
   */
  private async performSearch(query: string): Promise<void> {
    if (!query.trim()) {
      this.searchState.update((state) => ({
        ...state,
        actions: [],
        isLoading: false
      }))
      return
    }

    this.searchState.update((state) => ({ ...state, isLoading: true }))

    const mentions = this.mentionsValue

    try {
      // Get local actions immediately
      const localActions = await this.getLocalActions(query, mentions)
      this.log.debug(`Got local actions:`, localActions)

      // Show local results first
      this.updateResults(localActions, false)

      // Get remote actions in parallel
      const remoteActions = await this.getRemoteActions(query, mentions)
      this.log.debug(`Got remote actions:`, remoteActions)

      // Combine and sort all actions
      const allActions = [...localActions, ...remoteActions].sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      )

      // Update final results
      this.updateResults(allActions, true)
    } catch (error) {
      this.log.error('Search failed:', error)
      this.searchState.update((state) => ({
        ...state,
        isLoading: false,
        actions: []
      }))
    }
  }

  /**
   * Get actions from local providers
   */
  private async getLocalActions(query: string, mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []

    for (const provider of this.providers.values()) {
      if (provider.canHandle(query)) {
        const providerActions = await provider.getActions(query, mentions)
        const limitedActions = providerActions
          .slice(0, this.options.maxActionsPerProvider)
          .map((action) => ({
            ...action,
            provider
          }))

        actions.push(...limitedActions)
      }
    }

    return actions.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  /**
   * Get actions from remote providers via messagePort
   */
  private async getRemoteActions(
    query: string,
    mentions: MentionItem[]
  ): Promise<TeletypeAction[]> {
    try {
      this.log.debug('Requesting remote actions for query:', query, mentions)
      const response = await this.messagePort.teletypeSearch.request({ query, mentions })

      this.log.debug('Got remote actions:', response.actions)

      // Convert serialized actions back to TeletypeAction objects
      return response.actions.map((action) => {
        return {
          ...action,
          handler: async () => {
            // Execute action via messagePort
            await this.messagePort.teletypeExecuteAction.send({ actionId: action.id })
          }
        } as TeletypeAction
      })
    } catch (error) {
      this.log.error('Failed to get remote actions:', error)
      return []
    }
  }

  /**
   * Update results and state
   */
  private updateResults(actions: TeletypeAction[], isComplete: boolean): void {
    this.searchState.update((state) => ({
      ...state,
      actions,
      isLoading: !isComplete,
      lastUpdated: Date.now()
    }))
  }

  /**
   * Append new results while maintaining priority order (for async providers)
   */
  private appendResults(newActions: TeletypeAction[]): void {
    this.searchState.update((state) => {
      const allActions = [...state.actions, ...newActions]
      // Re-sort by priority to maintain proper ordering
      allActions.sort((a, b) => (b.priority || 0) - (a.priority || 0))

      // Apply global limit based on maxActionsPerProvider to prevent exceeding total
      const limitedActions = allActions.slice(0, this.options.maxActionsPerProvider)

      return {
        ...state,
        actions: limitedActions,
        lastUpdated: Date.now()
      }
    })
  }

  static provide(options?: TeletypeServiceOptions) {
    const service = new TeletypeService(options)
    if (!TeletypeService.self) TeletypeService.self = service

    return service
  }

  static use() {
    if (!TeletypeService.self) {
      throw new Error('TeletypeService not initialized')
    }
    return TeletypeService.self
  }
}

export const useTeletypeService = TeletypeService.use
export const createTeletypeService = TeletypeService.provide
