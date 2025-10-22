import { writable, derived, get, type Writable, type Readable } from 'svelte/store'
import { useDebounce, useLogScope, useThrottle } from '@deta/utils'
import type {
  MentionProvider,
  MentionItem,
  MentionServiceOptions,
  MentionSearchState,
  MentionSelection,
  MentionType
} from './mention.types'
import { useMessagePortPrimary } from '../messagePort'

import { TabsMentionProvider } from './providers/TabsMentionProvider'
import { ResourceMentionProvider } from './providers/ResourceMentionProvider'
import { NotebookMentionProvider } from './providers/NotebookMentionProvider'
import type { TabsService } from '../tabs/tabs.svelte'

import { MentionTypes } from './mention.types'
import { tick } from 'svelte'
import type { Fn } from '@deta/types'
import { useBrowser } from '../browser'

export class MentionService {
  private providers = new Map<string, MentionProvider>()
  private searchState: Writable<MentionSearchState>
  private readonly options: Required<MentionServiceOptions>

  private readonly log = useLogScope('MentionService')
  private readonly messagePort = useMessagePortPrimary()
  private readonly browser = useBrowser()

  private queryUnsubscribe?: () => void
  private unsubs: Fn[] = []

  // Public reactive stores
  public readonly query: Writable<string>
  public readonly isLoading: Readable<boolean>
  public readonly items: Readable<MentionItem[]>

  private debouncedSearch: (query: string) => void

  static self: MentionService

  constructor(tabsService?: TabsService, options: MentionServiceOptions = {}) {
    this.options = {
      debounceMs: 500,
      maxItemsPerProvider: 6,
      enabledProviders: [],
      enabledTypes: Object.values(MentionTypes),
      ...options
    }

    // Initialize stores
    this.searchState = writable<MentionSearchState>({
      query: '',
      isLoading: false,
      items: [],
      lastUpdated: Date.now()
    })

    this.query = writable('')

    // Derived stores
    this.isLoading = derived(this.searchState, ($state) => $state.isLoading)
    this.items = derived(this.searchState, ($state) => $state.items)

    // Setup debounced search
    this.debouncedSearch = useDebounce(this.performSearch.bind(this), this.options.debounceMs)

    // Subscribe to query changes
    this.queryUnsubscribe = this.query.subscribe((query) => {
      this.searchState.update((state) => ({ ...state, query }))
      this.debouncedSearch(query)
    })

    // Register default providers if available
    if (tabsService) {
      const tabsProvider = new TabsMentionProvider(tabsService)
      this.registerProvider(tabsProvider)
    }

    const resourceProvider = new ResourceMentionProvider()
    this.registerProvider(resourceProvider)

    const notebookProvider = new NotebookMentionProvider()
    this.registerProvider(notebookProvider)

    this.attachListeners()
  }

  get itemsValue() {
    return get(this.items)
  }

  private attachListeners() {
    this.unsubs.push(
      this.messagePort.fetchMentions.handle(async ({ query }, viewId: string) => {
        this.log.debug('Received fetchMentions event', query)

        const location = this.browser.getViewLocation(viewId) ?? 'tab'

        let results = await (query.length > 0
          ? this.debouncedPerformSearch(query)
          : this.performSearch(query))

        if (!results) {
          this.log.debug('No results found')
          return []
        }

        if (location === 'tab') {
          this.log.debug('Filtering out ACTIVE_TAB mentions for tab')
          results = results.filter((item) => item.type !== MentionTypes.ACTIVE_TAB)
        }

        this.log.debug('Returning fetched mentions:', results)
        return results
      })
    )
  }

  /**
   * Register a new mention provider
   */
  async registerProvider(provider: MentionProvider): Promise<void> {
    if (this.options.enabledProviders.includes(provider.name)) {
      return
    }

    if (!this.options.enabledTypes.includes(provider.type)) {
      return
    }

    this.log.debug('Registering provider:', provider.name)
    this.providers.set(provider.name, provider)

    if (provider.initialize) {
      await provider.initialize()
    }
  }

  /**
   * Unregister a mention provider
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
   * Select a mention item and return formatted selection data
   */
  selectMention(item: MentionItem): MentionSelection {
    return {
      item,
      insertText: `@${item.type}:${item.id}`,
      displayText: item.name
    }
  }

  /**
   * Get items by type
   */
  getItemsByType(type: MentionType): MentionItem[] {
    const currentState = get(this.searchState)
    return currentState.items.filter((item) => item.type === type)
  }

  /**
   * Set the search query
   */
  setQuery(query: string): void {
    this.query.set(query)
  }

  /**
   * Clear current search and items
   */
  clear(): void {
    this.query.set('')
    this.searchState.set({
      query: '',
      isLoading: false,
      items: [],
      lastUpdated: Date.now()
    })
  }

  /**
   * Destroy the service and cleanup all providers
   */
  destroy(): void {
    // Cleanup subscription
    if (this.queryUnsubscribe) {
      this.queryUnsubscribe()
      this.queryUnsubscribe = undefined
    }

    this.unsubs.forEach((unsub) => unsub())

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
  async performSearch(query: string) {
    if (!query.trim()) {
      query = ''
    }

    this.searchState.update((state) => ({ ...state, isLoading: true }))

    try {
      // Phase 1: Execute LOCAL providers immediately
      const localItems = await this.executeLocalProviders(query)

      // Show local results immediately
      this.updateResults(localItems, false) // Keep loading true for async providers

      // Phase 2: Execute ASYNC providers and stream results
      await this.executeAsyncProviders(query, localItems)

      await tick()

      return this.itemsValue
    } catch (error) {
      this.log.error('Search failed:', error)
      this.searchState.update((state) => ({
        ...state,
        isLoading: false,
        items: []
      }))
    }
  }

  debouncedPerformSearch = useDebounce((query: string) => this.performSearch(query), 300)

  /**
   * Execute all LOCAL providers immediately for instant results
   */
  private async executeLocalProviders(query: string): Promise<MentionItem[]> {
    const localItems: MentionItem[] = []

    for (const provider of this.providers.values()) {
      if (provider.isLocal && provider.canHandle(query)) {
        try {
          const items = await provider.getMentions(query)
          const limitedItems = items.slice(0, this.options.maxItemsPerProvider)
          localItems.push(...limitedItems)
        } catch (error) {
          this.log.warn(`Local provider ${provider.name} failed:`, error)
        }
      }
    }

    // Sort by priority (higher priority first)
    localItems.sort((a, b) => (b.priority || 0) - (a.priority || 0))

    return localItems
  }

  /**
   * Execute ASYNC providers and stream results as they complete
   */
  private async executeAsyncProviders(query: string, existingItems: MentionItem[]): Promise<void> {
    const asyncProviders = Array.from(this.providers.values()).filter(
      (provider) => !provider.isLocal && provider.canHandle(query)
    )

    if (asyncProviders.length === 0) {
      // No async providers, just mark loading as complete
      this.updateResults(existingItems, true)
      return
    }

    this.log.debug(`Executing ${asyncProviders.length} async providers`)

    const asyncPromises = asyncProviders.map(async (provider) => {
      try {
        const items = await provider.getMentions(query)
        const limitedItems = items.slice(0, this.options.maxItemsPerProvider)

        // Stream in results as each provider completes
        this.appendResults(limitedItems)

        return limitedItems
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
  private updateResults(items: MentionItem[], isComplete: boolean): void {
    this.searchState.update((state) => ({
      ...state,
      items,
      isLoading: !isComplete,
      lastUpdated: Date.now()
    }))
  }

  /**
   * Append new results while maintaining priority order (for async providers)
   */
  private appendResults(newItems: MentionItem[]): void {
    this.searchState.update((state) => {
      const allItems = [...state.items, ...newItems]
      // Re-sort by priority to maintain proper ordering
      allItems.sort((a, b) => (b.priority || 0) - (a.priority || 0))

      // Apply global limit to prevent too many results
      const limitedItems = allItems.slice(0, this.options.maxItemsPerProvider * this.providers.size)

      return {
        ...state,
        items: limitedItems,
        lastUpdated: Date.now()
      }
    })
  }

  static provide(tabsService?: TabsService, options?: MentionServiceOptions) {
    const service = new MentionService(tabsService, options)
    if (!MentionService.self) MentionService.self = service

    return service
  }

  static use() {
    if (!MentionService.self) {
      throw new Error('MentionService not initialized')
    }
    return MentionService.self
  }
}

export const useMentionService = MentionService.use
export const createMentionService = MentionService.provide
