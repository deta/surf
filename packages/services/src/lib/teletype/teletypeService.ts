import { writable, derived, get, type Writable, type Readable } from 'svelte/store'
import { useDebounce, useLogScope } from '@deta/utils'
import type { ActionProvider, TeletypeAction, TeletypeServiceOptions, SearchState } from './types'
import { SearchProvider } from './providers/SearchProvider'
import { NavigationProvider } from './providers/NavigationProvider'
import { AskProvider } from './providers/AskProvider'
import { CurrentQueryProvider } from './providers/CurrentQueryProvider'

export class TeletypeService {
  private providers = new Map<string, ActionProvider>()
  private searchState: Writable<SearchState>
  private readonly options: Required<TeletypeServiceOptions>
  private readonly log = useLogScope('TeletypeService')
  private queryUnsubscribe?: () => void

  // Public reactive stores
  public readonly query: Writable<string>
  public readonly isLoading: Readable<boolean>
  public readonly actions: Readable<TeletypeAction[]>

  private debouncedSearch: (query: string) => void

  static self: TeletypeService

  constructor(options: TeletypeServiceOptions = {}) {
    this.options = {
      debounceMs: 15,
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

    // Register default providers
    this.registerProvider(new CurrentQueryProvider()) // Local, instant current query
    this.registerProvider(new SearchProvider()) // Async Google suggestions
    this.registerProvider(new NavigationProvider())
    this.registerProvider(new AskProvider())
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

    try {
      // Phase 1: Execute LOCAL providers immediately
      const localActions = await this.executeLocalProviders(query)

      // Show local results immediately
      this.updateResults(localActions, false) // Keep loading true for async providers

      // Phase 2: Execute ASYNC providers and stream results
      await this.executeAsyncProviders(query, localActions)
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
   * Execute all LOCAL providers immediately for instant results
   */
  private async executeLocalProviders(query: string): Promise<TeletypeAction[]> {
    const localActions: TeletypeAction[] = []

    for (const provider of this.providers.values()) {
      if (provider.isLocal && provider.canHandle(query)) {
        try {
          const actions = await provider.getActions(query)
          const limitedActions = actions.slice(0, this.options.maxActionsPerProvider)
          localActions.push(...limitedActions)
        } catch (error) {
          this.log.warn(`Local provider ${provider.name} failed:`, error)
        }
      }
    }

    // Sort by priority (higher priority first)
    localActions.sort((a, b) => (b.priority || 0) - (a.priority || 0))

    return localActions
  }

  /**
   * Execute ASYNC providers and stream results as they complete
   */
  private async executeAsyncProviders(
    query: string,
    existingActions: TeletypeAction[]
  ): Promise<void> {
    const asyncProviders = Array.from(this.providers.values()).filter(
      (provider) => !provider.isLocal && provider.canHandle(query)
    )

    if (asyncProviders.length === 0) {
      // No async providers, just mark loading as complete
      this.updateResults(existingActions, true)
      return
    }

    this.log.debug(`Executing ${asyncProviders.length} async providers`)

    const asyncPromises = asyncProviders.map(async (provider) => {
      try {
        const actions = await provider.getActions(query)
        const limitedActions = actions.slice(0, this.options.maxActionsPerProvider)

        // Stream in results as each provider completes
        this.appendResults(limitedActions)

        return limitedActions
      } catch (error) {
        this.log.warn(`Async provider ${provider.name} failed:`, error)
        return []
      }
    })

    // Wait for all async providers to complete, then mark loading as done
    await Promise.all(asyncPromises)

    // Mark loading as complete
    this.searchState.update((state) => ({
      ...state,
      isLoading: false
    }))
  }

  /**
   * Update results immediately (for local providers)
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
