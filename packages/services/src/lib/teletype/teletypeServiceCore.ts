import { useLogScope } from '@deta/utils'
import type { ActionProvider, TeletypeAction, TeletypeServiceOptions } from './types'
import { SearchProvider } from './providers/SearchProvider'
import { AskProvider } from './providers/AskProvider'
import { type TeletypeActionSerialized, useMessagePortPrimary } from '../messagePort'
import { type MentionItem } from '@deta/editor'
import { ResourcesProvider } from './providers/ResourcesProvider'

export class TeletypeServiceCore {
  private providers = new Map<string, ActionProvider>()
  private readonly options: Required<TeletypeServiceOptions>
  private readonly log = useLogScope('TeletypeService Core')
  private messagePort = useMessagePortPrimary()

  static self: TeletypeServiceCore
  private actionMap = new Map<string, TeletypeAction>()

  constructor(options: TeletypeServiceOptions = {}) {
    this.options = {
      debounceMs: 15,
      maxActionsPerProvider: 3,
      enabledProviders: [],
      ...options
    }

    // Handle search requests from main service
    this.messagePort.teletypeSearch.handle(async ({ query, mentions }) => {
      const actions = await this.getActionsForQuery(query, mentions)
      const serializedActions = actions.map(
        (action) =>
          ({
            id: action.id,
            name: action.name,
            description: action.description,
            icon: action.icon,
            priority: action.priority,
            providerId: action.providerId!
          }) satisfies TeletypeActionSerialized
      )

      return {
        actions: serializedActions
      }
    })

    // Handle action execution requests
    this.messagePort.teletypeExecuteAction.on(async ({ actionId }) => {
      const action = this.actionMap.get(actionId)
      if (action) {
        await action.handler()
        return true
      }

      return false
    })

    const askProvider = new AskProvider()

    this.messagePort.teletypeAsk.on(async ({ query, mentions }) => {
      this.log.debug('Asking question:', query, mentions)
      askProvider.triggerAskAction(query, mentions)
    })

    // Register external/async providers
    this.registerProvider(new SearchProvider()) // Async Google suggestions
    // this.registerProvider(new ResourcesProvider()) // SFFS Resources search
    this.registerProvider(askProvider)
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
    // const currentState = get(this.searchState)
    // const action = currentState.actions.find((a) => a.id === actionId)
    // if (action) {
    //   await action.handler()
    // }
  }

  /**
   * Set the search query
   */
  setQuery(query: string): void {
    // this.query.set(query)
  }

  /**
   * Clear current search and actions
   */
  clear(): void {}

  /**
   * Destroy the service and cleanup all providers
   */
  destroy(): void {
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
  /**
   * Get actions for a query from all registered providers
   */
  private async getActionsForQuery(
    query: string,
    mentions: MentionItem[]
  ): Promise<TeletypeAction[]> {
    if (!query.trim()) {
      return []
    }

    const actions: TeletypeAction[] = []
    const providers = Array.from(this.providers.values()).filter((provider) =>
      provider.canHandle(query)
    )

    this.log.debug(`Getting actions from ${providers.length} providers`)

    const providerPromises = providers.map(async (provider) => {
      try {
        this.log.debug(`Getting actions from provider: ${provider.name}`)
        const providerActions = await provider.getActions(query, mentions)

        this.log.debug(`Got actions from provider: ${provider.name}`, providerActions)

        const limitedActions = providerActions
          .slice(0, this.options.maxActionsPerProvider)
          .map((action) => ({
            ...action,
            provider
          }))

        actions.push(
          ...limitedActions.map((action) => ({
            ...action,
            providerId: provider.name
          }))
        )
      } catch (error) {
        this.log.error(`Provider ${provider.name} failed:`, error)
      }
    })

    await Promise.all(providerPromises)

    // Sort by priority (higher priority first)
    const sortedActions = actions.sort((a, b) => (b.priority || 0) - (a.priority || 0))

    this.log.debug(`Sorted actions:`, sortedActions)

    sortedActions.forEach((action) => {
      this.actionMap.set(action.id, action)
    })

    return sortedActions
  }

  static provide(options?: TeletypeServiceOptions) {
    const service = new TeletypeServiceCore(options)
    if (!TeletypeServiceCore.self) TeletypeServiceCore.self = service

    return service
  }

  static use() {
    if (!TeletypeServiceCore.self) {
      throw new Error('TeletypeService not initialized')
    }
    return TeletypeServiceCore.self
  }
}

export const useTeletypeServiceCore = TeletypeServiceCore.use
export const createTeletypeServiceCore = TeletypeServiceCore.provide
