import { writable, derived, get, type Writable, type Readable } from 'svelte/store'
import {
  getFileKind,
  isDev,
  prependProtocol,
  truncate,
  useDebounce,
  useLogScope,
  useThrottle
} from '@deta/utils'
import { decideIntent } from '../ai/intentClassifier'
import type { ClassificationResultWithRoute } from '../ai/intentClassifier.types'
import { useConfig, type ConfigService } from '../config'
import type {
  ActionProvider,
  TeletypeAction,
  TeletypeServiceOptions,
  SearchState,
  ToolEnhancementHandler,
  ToolEnhancement
} from './types'
import { NavigationProvider } from './providers/NavigationProvider'
import { AskProvider } from './providers/AskProvider'
import { CurrentQueryProvider } from './providers/CurrentQueryProvider'
import { type AIQueryPayload, useMessagePortClient } from '../messagePort'
import { MentionItemType, type MentionItem } from '@deta/editor'
import type { TeletypeSystem } from '@deta/teletype'
import type { Fn, Optional } from '@deta/types'
import { promptForFilesAndTurnIntoResourceMentions } from '../mediaImporter'
import { useResourceManager } from '../resources'
import { AI_TOOLS } from '../constants'

export type ToolsMap = Map<
  string,
  {
    active: boolean
    name: string
    icon?: string
    disabled?: boolean
    enhancementHandler?: ToolEnhancementHandler
  }
>

export class TeletypeService {
  private providers = new Map<string, ActionProvider>()
  private searchState: Writable<SearchState>
  private readonly options: Required<TeletypeServiceOptions>
  private readonly log = useLogScope('TeletypeService')
  private messagePort = useMessagePortClient()
  private readonly resourceManager = useResourceManager()
  private readonly configService: ConfigService

  private unsubs: Fn[] = []
  teletype!: TeletypeSystem

  // Public reactive stores
  public readonly query: Writable<string>
  public readonly mentions: Writable<MentionItem[]>
  public readonly localActions: Writable<TeletypeAction[]>
  public readonly remoteActions: Writable<TeletypeAction[]>
  public readonly tools: Writable<ToolsMap>
  public readonly filterOutSection: Writable<string | null>
  public readonly currentIntent: Writable<ClassificationResultWithRoute | null>
  public readonly preferredActionIndex: Writable<number | null>
  public readonly hideNavigation: Writable<boolean>

  public readonly isLoading: Readable<boolean>
  public readonly actions: Readable<TeletypeAction[]>
  public readonly hasActiveTabMention: Readable<boolean>

  private debouncedLocalSearch: (query: string) => void
  private debouncedRemoteSearch: (query: string) => void

  static self: TeletypeService

  constructor(options: TeletypeServiceOptions = {}) {
    this.options = {
      debounceMsLocal: 100,
      debounceMsRemote: 200,
      maxActionsPerProvider: 3,
      enabledProviders: [],
      ...options
    }

    this.configService = useConfig()

    // Initialize stores
    this.searchState = writable<SearchState>({
      query: '',
      isLoading: false,
      actions: [],
      lastUpdated: Date.now()
    })

    this.query = writable('')
    this.mentions = writable<MentionItem[]>([])
    this.localActions = writable<TeletypeAction[]>([])
    this.remoteActions = writable<TeletypeAction[]>([])
    this.filterOutSection = writable(null)
    this.currentIntent = writable(null)
    this.preferredActionIndex = writable(null)
    this.hideNavigation = writable(false)

    this.tools = writable(new Map())

    // Register default tools
    AI_TOOLS.forEach((tool) => {
      this.registerTool(tool.id, tool.name, tool.icon, undefined, tool.active, tool.disabled)
    })

    // Derived stores
    this.isLoading = derived(this.searchState, ($state) => $state.isLoading)
    this.actions = derived(this.searchState, ($state) => $state.actions)
    this.hasActiveTabMention = derived(this.mentions, ($mentions) =>
      $mentions.some((m) => m.type === MentionItemType.ACTIVE_TAB)
    )

    // Setup debounced searches with different timings
    this.debouncedLocalSearch = useThrottle(
      this.performLocalSearch.bind(this),
      this.options.debounceMsLocal
    )
    this.debouncedRemoteSearch = useThrottle(
      this.performRemoteSearch.bind(this),
      this.options.debounceMsRemote
    )

    // Subscribe to query changes
    this.unsubs.push(
      this.query.subscribe((query) => {
        this.searchState.update((state) => ({ ...state, query }))

        if (!this.hideNavigationValue) {
          // Trigger both searches independently
          this.debouncedLocalSearch(query)
          this.debouncedRemoteSearch(query)
        }
      })
    )

    // Register local providers
    this.registerProvider(new CurrentQueryProvider(this)) // Local, instant current query
    this.registerProvider(new NavigationProvider(this))
    this.registerProvider(new AskProvider(this))

    if (isDev) {
      // @ts-ignore
      window.teletypeService = this
    }
    this.attachListeners()
  }

  get queryValue() {
    return get(this.query)
  }

  get mentionsValue() {
    return get(this.mentions)
  }

  get localActionsValue() {
    return get(this.localActions)
  }

  get remoteActionsValue() {
    return get(this.remoteActions)
  }

  get hideNavigationValue() {
    return get(this.hideNavigation)
  }

  attachTeletype(teletype: TeletypeSystem) {
    this.teletype = teletype
  }

  attachListeners() {
    this.unsubs.push(
      this.messagePort.noteInsertMentionQuery.handle((payload) => {
        console.debug('Received note-insert-mention-query event', payload)
        this.insertMention(payload.mention, payload.query)
      })
    )
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
      await action.handler({
        query: this.queryValue,
        mentions: this.mentionsValue
      })
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

  setFilterOutSection(section: string | null): void {
    this.filterOutSection.set(section)

    // Re-run the last search to update results based on new filter
    this.debouncedLocalSearch(this.queryValue)
    this.debouncedRemoteSearch(this.queryValue)
  }

  setHideNavigation(hide: boolean): void {
    this.hideNavigation.set(hide)
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

  async ask(payload: Optional<AIQueryPayload, 'tools' | 'mentions'>): Promise<void> {
    this.log.debug('Asking question:', payload)

    const tools = {
      websearch: this.isToolActive('websearch'),
      surflet: this.isToolActive('surflet')
    }

    const fullPayload = {
      tools,
      mentions: this.mentionsValue,
      ...payload
    } as AIQueryPayload

    await this.messagePort.teletypeAsk.send(fullPayload)
    this.clear()
  }

  async createNote(content: string): Promise<void> {
    this.log.debug('Creating note:', content)
    await this.messagePort.createNote.send({ content, isNewTabPage: true })
    this.clear()
  }

  async navigateToUrlOrSearch(urlOrQuery: string): Promise<void> {
    try {
      await this.messagePort.navigateURL.send({ url: urlOrQuery, target: 'active_tab' })
    } catch (error) {
      this.log.error('Failed to navigate to URL:', error)
    }
  }

  /**
   * Perform the local search immediately with minimal debounce
   */
  private async performLocalSearch(query: string): Promise<void> {
    if (!query.trim()) {
      this.searchState.update((state) => ({
        ...state,
        actions: [],
        isLoading: false
      }))
      this.currentIntent.set(null)
      this.preferredActionIndex.set(null)
      return
    }

    this.searchState.update((state) => ({ ...state, isLoading: true }))
    const mentions = this.mentionsValue

    try {
      // Get intent classification for the query
      const intentResult = await decideIntent(query.trim())
      this.currentIntent.set(intentResult)
      this.log.debug(`Intent classification:`, intentResult)

      // Get local actions immediately
      const localActions = await this.getLocalActions(query, mentions)
      this.log.debug(`Got local actions:`, localActions)

      this.localActions.set(localActions)

      // Combine with current remote actions
      const allActions = [...localActions, ...this.remoteActionsValue].sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      )

      // Calculate preferred action index based on intent
      const preferredIndex = this.calculatePreferredActionIndex(allActions, intentResult)
      this.preferredActionIndex.set(preferredIndex)
      this.log.debug(`Preferred action index:`, preferredIndex)

      // Update final results
      this.updateResults(allActions, false)
    } catch (error) {
      this.log.error('Local search failed:', error)
    }
  }

  /**
   * Perform the remote search with longer debounce
   */
  private async performRemoteSearch(query: string): Promise<void> {
    if (!query.trim()) return

    const mentions = this.mentionsValue

    try {
      // Get remote actions
      const remoteActions = await this.getRemoteActions(query, mentions)
      this.log.debug(`Got remote actions:`, remoteActions)

      this.remoteActions.set(remoteActions)

      // Combine with current local actions
      const allActions = [...this.localActionsValue, ...remoteActions].sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      )

      // Recalculate preferred action index with updated actions
      const intentResult = get(this.currentIntent)
      const preferredIndex = this.calculatePreferredActionIndex(allActions, intentResult)
      this.preferredActionIndex.set(preferredIndex)
      this.log.debug(`Updated preferred action index:`, preferredIndex)

      this.log.debug('Combined actions:', allActions)

      // If there is a action with providerId 'hostname-search', remove the action with providerId 'navigation' if the url matches
      const hasHostnameAction = allActions.some(
        (action) => action.providerId === 'hostname-search' && (action.priority ?? 0) >= 100
      )
      if (hasHostnameAction) {
        const navigationActions = allActions.filter((action) => action.providerId === 'navigation')
        for (const navAction of navigationActions) {
          const navUrl = navAction.name.trim()
          const hostnameAction = allActions.find(
            (action) => action.providerId === 'hostname-search' && navUrl === action.name.trim()
          )
          if (hostnameAction) {
            const index = allActions.indexOf(navAction)
            if (index > -1) {
              allActions.splice(index, 1)
            }
          }
        }
      }

      // Update final results
      this.updateResults(allActions, true)
    } catch (error) {
      this.log.error('Remote search failed:', error)
    }
  }

  /**
   * Calculate the preferred action index based on user setting and intent classification
   */
  private calculatePreferredActionIndex(
    actions: TeletypeAction[],
    intentResult: ClassificationResultWithRoute | null
  ): number | null {
    if (actions.length === 0) {
      return null
    }

    // Get user preference for default action
    const userSettings = this.configService?.settingsValue
    const defaultAction = userSettings?.teletype_default_action || 'auto'

    this.log.debug(`User preference for default action: ${defaultAction}`)

    // Handle user preference overrides
    if (defaultAction === 'always_ask') {
      // Always prefer Ask actions
      for (let i = 0; i < actions.length; i++) {
        if (actions[i].providerId === 'ask') {
          this.log.debug(`Always Ask mode: Found Ask action at index ${i}:`, actions[i].name)
          return i
        }
      }
    } else if (defaultAction === 'always_search') {
      // Always prefer Search actions
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]
        if (
          action.providerId === 'current-query' ||
          action.providerId === 'search' ||
          action.providerId === 'hostname-search' ||
          action.providerId === 'navigation'
        ) {
          this.log.debug(`Always Search mode: Found Search action at index ${i}:`, action.name)
          return i
        }
      }
    } else if (defaultAction === 'auto' && intentResult) {
      // Use intelligent intent-based selection
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]

        if (intentResult.intent === 'llm' && action.providerId === 'ask') {
          this.log.debug(`Auto mode: Found LLM-matching action at index ${i}:`, action.name)
          return i
        }

        if (
          intentResult.intent === 'search' &&
          (action.providerId === 'current-query' ||
            action.providerId === 'search' ||
            action.providerId === 'hostname-search' ||
            action.providerId === 'navigation')
        ) {
          this.log.debug(`Auto mode: Found search-matching action at index ${i}:`, action.name)
          return i
        }
      }
    }

    this.log.debug('No matching action found, using default selection (index 0)')
    return null // Fallback to default selection (index 0)
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
            providerId: provider.name,
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
            await this.messagePort.teletypeExecuteAction.send({
              actionId: action.id,
              query: this.queryValue,
              mentions: this.mentionsValue
            })
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
    if (get(this.filterOutSection)) {
      actions = actions.filter((action) => action.section !== get(this.filterOutSection))
    }

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

  registerTool(
    id: string,
    name: string,
    icon?: string,
    enhancementHandler?: ToolEnhancementHandler,
    active: boolean = false,
    disabled: boolean = false
  ) {
    this.log.debug('Registering tool:', id, name)
    this.tools.update((tools) => {
      tools.set(id, { active, name, icon, enhancementHandler, disabled })
      return tools
    })
  }

  toggleTool(id: string) {
    this.log.debug('toggleTool called for:', id)
    this.tools.update((tools) => {
      const tool = tools.get(id)
      if (tool) {
        this.log.debug('Tool before toggle:', tool)
        // Create a new tool object to ensure reactivity
        const newTool = { ...tool, active: !tool.active }
        tools.set(id, newTool)
        this.log.debug('Tool after toggle:', newTool)
      } else {
        this.log.warn('Tool not found:', id)
      }
      return new Map(tools)
    })
  }

  isToolActive(id: string): boolean {
    const tools = get(this.tools)
    const tool = tools.get(id)
    return tool ? tool.active && !tool.disabled : false
  }

  getActiveTool(): string | null {
    const tools = get(this.tools)
    for (const [id, tool] of tools) {
      if (tool.active && !tool.disabled) return id
    }
    return null
  }

  getActiveToolEnhancements(): ToolEnhancement[] {
    const tools = get(this.tools)
    const enhancements: ToolEnhancement[] = []

    for (const [id, tool] of tools) {
      if (tool.active && !tool.disabled && tool.enhancementHandler) {
        const enhancement = tool.enhancementHandler()
        if (enhancement) {
          enhancements.push({ toolId: id, ...enhancement })
        }
      }
    }

    return enhancements
  }

  runQueryEnhancements(query: string): string {
    const enhancements = this.getActiveToolEnhancements()
    for (const enhancement of enhancements) {
      if (enhancement.executeQueryModifier) {
        query = enhancement.executeQueryModifier(query)
        this.log.debug(`Tool "${enhancement.toolId}" modified query to:`, query)
      }
    }

    return query
  }

  insertMention(mentionItem?: MentionItem, query?: string): void {
    if (!this.teletype || !this.teletype.editorComponent) {
      this.log.warn('Editor component not available to insert mention')
      return
    }
    const editorComponent = this.teletype.editorComponent
    editorComponent.insertMention(mentionItem, query)
    editorComponent.focus()
  }

  async promptForAndInsertFileMentions() {
    if (!this.teletype || !this.teletype.editorComponent) {
      this.log.warn('Editor component not available')
      return
    }

    const mentions = await promptForFilesAndTurnIntoResourceMentions(this.resourceManager)
    if (!mentions || mentions.length === 0) {
      this.log.debug('No files selected or no mentions created')
      return
    }

    this.log.debug(`Inserting ${mentions.length} file mentions:`, mentions)
    for (const mentionItem of mentions) {
      this.insertMention(mentionItem)
    }

    this.teletype.editorComponent.focusEnd()
  }

  /**
   * Destroy the service and cleanup all providers
   */
  destroy(): void {
    this.unsubs.forEach((unsub) => unsub())
    this.unsubs.length = 0

    // Cleanup providers
    for (const provider of this.providers.values()) {
      if (provider.destroy) {
        provider.destroy()
      }
    }
    this.providers.clear()
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
