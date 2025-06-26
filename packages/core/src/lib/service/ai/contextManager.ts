import { tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  checkIfYoutubeUrl,
  generateID,
  parseUrlIntoCanonical,
  useLocalStorage,
  useLogScope,
  wait
} from '@horizon/utils'

import {
  PageChatUpdateContextEventAction,
  PageChatUpdateContextItemType,
  type PageChatUpdateContextEventTrigger
} from '@horizon/types'
import { ResourceTagsBuiltInKeys, type Tab, type TabPage, type TabSpace } from '../../types'

import type { OasisSpace } from '../oasis'
import type { Resource, ResourceManager } from '../resources'
import type { TabsManager } from '../tabs'
import type { Telemetry } from '../telemetry'

import {
  type StoredContextItem,
  type ContextItem,
  ContextItemTypes,
  ContextItemActiveSpaceContext,
  ContextItemActiveTab,
  ContextItemPageTab,
  ContextItemResource,
  ContextItemScreenshot,
  ContextItemSpace
} from './context/index'
import type { AIService, ChatPrompt } from './ai'
import { ContextItemInbox } from './context/inbox'
import { ContextItemEverything } from './context/everything'
import type { ActiveSpaceContextInclude } from './context/activeSpaceContexts'
import { ContextItemWikipedia } from './context/wikipedia'
import {
  ACTIVE_CONTEXT_MENTION,
  ACTIVE_TAB_MENTION,
  BROWSER_HISTORY_MENTION,
  EVERYTHING_MENTION,
  INBOX_MENTION,
  NO_CONTEXT_MENTION,
  TABS_MENTION,
  WIKIPEDIA_SEARCH_MENTION
} from '../../constants/chat'
import { MentionItemType, type MentionItem } from '@horizon/editor'
import { ContextItemBrowsingHistory } from './context/history'

export type AddContextItemOptions = {
  trigger?: PageChatUpdateContextEventTrigger
  index?: number
  visible?: boolean
}

export const DEFAULT_CONTEXT_MANAGER_KEY = 'active_chat_context'

export class ContextManager {
  key: string

  private _storage: ReturnType<typeof useLocalStorage<StoredContextItem[]>>
  generatingPrompts: Writable<boolean>
  generatedPrompts: Writable<ChatPrompt[]>

  items: Readable<ContextItem[]>

  tabsInContext: Readable<Tab[]>
  spacesInContext: Readable<OasisSpace[]>
  resourcesInContext: Readable<Resource[]>
  screenshotsInContext: Readable<Blob[]>
  activeTabContextItem: Readable<ContextItemActiveTab | undefined>
  activeSpaceContextItem: Readable<ContextItemActiveSpaceContext | undefined>

  cachedItemPrompts: Map<string, ChatPrompt[]>

  service: ContextService
  ai: AIService
  tabsManager: TabsManager
  resourceManager: ResourceManager
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(
    key: string,
    service: ContextService,
    ai: AIService,
    tabsManager: TabsManager,
    resourceManager: ResourceManager
  ) {
    this.key = key
    this.service = service
    this.ai = ai
    this.tabsManager = tabsManager
    this.resourceManager = resourceManager
    this.telemetry = resourceManager.telemetry
    this.log = useLogScope(`ContextManager ${key}`)

    this.cachedItemPrompts = new Map()

    this.generatingPrompts = writable(false)
    this.generatedPrompts = writable([])
    this._storage = useLocalStorage<StoredContextItem[]>(this.key, [], true)

    this.items = derived(this.service.items, ($items) => {
      return $items.filter((item) => item.scopes.includes(this.key)).map((item) => item.item)
    })

    this.tabsInContext = derived(
      [this.items, this.tabsManager.activeTab],
      ([$contextItems, $activeTab]) => {
        return $contextItems
          .filter(
            (item) =>
              item instanceof ContextItemPageTab ||
              item instanceof ContextItemResource ||
              item instanceof ContextItemSpace ||
              item instanceof ContextItemActiveTab
          )
          .map((item) => {
            if (item instanceof ContextItemResource || item instanceof ContextItemSpace) {
              return item.sourceTab
            } else if (item instanceof ContextItemActiveTab) {
              // Since we can't directly subscribe to the activeTab store in the context item we rely on the store in the tabsManager
              if (item.currentTabValue?.id !== $activeTab?.id) {
                return $activeTab
              }
              return item.currentTabValue
            } else if (item instanceof ContextItemPageTab) {
              return item.dataValue
            } else {
              return null
            }
          })
          .filter((tab) => !!tab)
      }
    )

    this.spacesInContext = derived([this.items], ([$contextItems]) => {
      return $contextItems
        .filter(
          (item) =>
            (item instanceof ContextItemSpace && !item.sourceTab) ||
            item instanceof ContextItemActiveSpaceContext
        )
        .map((item) => {
          if (item instanceof ContextItemSpace) {
            return item.data
          } else if (item instanceof ContextItemActiveSpaceContext) {
            return get(item.activeSpace)
          } else {
            return null
          }
        })
        .filter((space) => !!space)
    })

    this.resourcesInContext = derived([this.items], ([$contextItems]) => {
      return $contextItems
        .filter(
          (item) =>
            (item instanceof ContextItemResource && !item.sourceTab) ||
            item instanceof ContextItemPageTab
        )
        .map((item) => {
          if (item instanceof ContextItemResource) {
            return item.data
          } else if (item instanceof ContextItemPageTab) {
            return get(item.item)?.data ?? null
          } else {
            return null
          }
        })
        .filter((resource) => !!resource)
    })

    this.screenshotsInContext = derived([this.items], ([$contextItems]) => {
      return $contextItems
        .filter((item) => item instanceof ContextItemScreenshot)
        .map((item) => (item as ContextItemScreenshot).data)
    })

    this.activeTabContextItem = derived([this.items], ([$contextItems]) => {
      return $contextItems.find((item) => item instanceof ContextItemActiveTab)
    })

    this.activeSpaceContextItem = derived([this.items], ([$contextItems]) => {
      return $contextItems.find((item) => item instanceof ContextItemActiveSpaceContext)
    })
  }

  get itemsValue() {
    return get(this.items)
  }

  get tabsInContextValue() {
    return get(this.tabsInContext)
  }

  get spacesInContextValue() {
    return get(this.spacesInContext)
  }

  get resourcesInContextValue() {
    return get(this.resourcesInContext)
  }

  get screenshotsInContextValue() {
    return get(this.screenshotsInContext)
  }

  get promptsValue() {
    return get(this.generatedPrompts)
  }

  async restoreItems() {
    // const storedItems = this._storage.get()
    // if (!storedItems) {
    //   return
    // }
    // this.log.debug('Restoring context items', storedItems)
    // const items: ContextItem[] = []
    // let encounteredMalformedType = false
    // for (const storedItem of storedItems) {
    //   if (storedItem.type === ContextItemTypes.RESOURCE && storedItem.data) {
    //     const resource = await this.resourceManager.getResource(storedItem.data)
    //     if (resource) {
    //       items.push(new ContextItemResource(this, resource))
    //     }
    //   } else if (storedItem.type === ContextItemTypes.SPACE && storedItem.data) {
    //     const space = await this.tabsManager.oasis.getSpace(storedItem.data)
    //     if (space) {
    //       items.push(new ContextItemSpace(this, space))
    //     }
    //   } else if (storedItem.type === ContextItemTypes.PAGE_TAB && storedItem.data) {
    //     const tab = this.tabsManager.tabsValue.find((tab) => tab.id === storedItem.data)
    //     if (tab?.type === 'page') {
    //       items.push(new ContextItemPageTab(this, tab))
    //     } else if (tab?.type === 'space') {
    //       const space = await this.tabsManager.oasis.getSpace(tab.spaceId)
    //       if (space) {
    //         items.push(new ContextItemSpace(this, space, tab as TabSpace))
    //       }
    //     } else {
    //       this.log.error('Invalid tab', tab)
    //       // encounteredMalformedType = true
    //     }
    //   } else if (storedItem.type === ContextItemTypes.ACTIVE_TAB) {
    //     items.push(new ContextItemActiveTab(this))
    //   } else if (storedItem.type === ContextItemTypes.ACTIVE_SPACE) {
    //     items.push(new ContextItemActiveSpaceContext(this))
    //   } else {
    //     this.log.error('Unknown stored item type', storedItem)
    //     encounteredMalformedType = true
    //   }
    // }
    // this.log.debug('Restored context items', items)
    // this.updateItems(() => items)
    // await tick()
    // if (encounteredMalformedType) {
    //   this.persistItems()
    // }
  }

  async persistItems() {
    // await tick()
    // const itemsToStore = this.itemsValue
    //   .filter((item) => !(item instanceof ContextItemScreenshot))
    //   .map((item) => {
    //     if (item instanceof ContextItemResource) {
    //       return {
    //         id: item.id,
    //         type: item.type,
    //         data: item.data.id
    //       }
    //     } else if (item instanceof ContextItemSpace) {
    //       return {
    //         id: item.id,
    //         type: item.type,
    //         data: item.data.id
    //       }
    //     } else if (item instanceof ContextItemPageTab) {
    //       return {
    //         id: item.id,
    //         type: item.type,
    //         data: item.dataValue?.id
    //       }
    //     } else if (item instanceof ContextItemActiveTab) {
    //       return {
    //         id: item.id,
    //         type: item.type
    //       }
    //     } else if (item instanceof ContextItemActiveSpaceContext) {
    //       return {
    //         id: item.id,
    //         type: item.type
    //       }
    //     } else {
    //       return {
    //         id: item.id,
    //         type: item.type
    //       }
    //     }
    //   })
    // this._storage.set(itemsToStore)
  }

  getUpdateEventItemType(item: ContextItem): PageChatUpdateContextItemType | undefined {
    if (item instanceof ContextItemPageTab) {
      return PageChatUpdateContextItemType.PageTab
    } else if (item instanceof ContextItemResource) {
      return PageChatUpdateContextItemType.Resource
    } else if (item instanceof ContextItemSpace) {
      return PageChatUpdateContextItemType.Space
    } else if (item instanceof ContextItemActiveTab) {
      return PageChatUpdateContextItemType.ActiveTab
    } else if (item instanceof ContextItemActiveSpaceContext) {
      return PageChatUpdateContextItemType.ActiveSpace
    } else {
      return undefined
    }
  }

  addContextItem<T extends ContextItem>(item: T, opts?: AddContextItemOptions) {
    this.log.debug('Adding context item', item.id)

    const { trigger, index, visible } = opts ?? {}

    if (visible === false) {
      item.setVisibility(false)
    }

    const currentContextLength = this.itemsValue.length

    const existingItem = this.itemsValue.find((i) => i.id === item.id)
    if (existingItem) {
      this.log.debug('Item already in context', item.id)
      return existingItem
    }

    this.updateItems((items) => {
      if (index !== undefined) {
        return [...items.slice(0, index), item, ...items.slice(index)]
      }

      return [...items.filter((i) => i.id !== item.id), item]
    })

    this.persistItems()

    // We only want to add the tab to the selection if we are the global context manager
    if (this.key === DEFAULT_CONTEXT_MANAGER_KEY) {
      const linkedTab = this.getTabFromItem(item)
      if (linkedTab) {
        this.tabsManager.addTabToSelection(linkedTab.id)
      }
    }

    if (trigger) {
      this.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.Add,
        currentContextLength + 1,
        1,
        this.getUpdateEventItemType(item),
        trigger
      )
    }

    return item
  }

  removeContextItem(id: string, trigger?: PageChatUpdateContextEventTrigger) {
    this.log.debug('Removing context item', id)

    const existingItem = this.itemsValue.find((i) => i.id === id)
    if (!existingItem) {
      this.log.debug('Item not found in context', id)
      return
    }

    const currentContextLength = this.itemsValue.length
    this.updateItems((items) =>
      items.filter((item) => {
        if (item.id === id) {
          // we only want to remove the item from the selection if we are the global context manager
          if (this.key === DEFAULT_CONTEXT_MANAGER_KEY) {
            const linkedTab = this.getTabFromItem(item)
            if (linkedTab) {
              this.tabsManager.removeTabFromSelection(linkedTab.id)
            }
          }

          return false
        }

        return true
      })
    )

    this.persistItems()

    if (trigger) {
      this.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.Remove,
        currentContextLength - 1,
        1,
        this.getUpdateEventItemType(existingItem),
        trigger
      )
    }
  }

  removeAllExcept(ids: string | string[], trigger?: PageChatUpdateContextEventTrigger) {
    const idsArray = Array.isArray(ids) ? ids : [ids]
    this.log.debug('Removing all context items except', idsArray)
    const currentContextLength = this.itemsValue.length

    this.updateItems((items) => items.filter((item) => idsArray.includes(item.id)))

    this.persistItems()

    if (trigger) {
      this.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.ExcludeOthers,
        currentContextLength - idsArray.length,
        idsArray.length,
        undefined,
        trigger
      )
    }
  }

  getTabFromItem(item: ContextItem) {
    if (item instanceof ContextItemPageTab) {
      return item.dataValue
    } else if (item instanceof ContextItemResource) {
      return item.sourceTab
    } else if (item instanceof ContextItemSpace) {
      return item.sourceTab
    } else {
      return null
    }
  }

  async onlyUseTabInContext(tabId: string, trigger?: PageChatUpdateContextEventTrigger) {
    const contextItem = await this.addTab(tabId)
    this.removeAllExcept(contextItem.id, trigger)
  }

  async addResource(resourceOrId: Resource | string, opts?: AddContextItemOptions) {
    const resource =
      typeof resourceOrId === 'string'
        ? await this.resourceManager.getResource(resourceOrId)
        : resourceOrId
    if (!resource) {
      this.log.error(`Resource not found: ${resourceOrId}`)
      throw new Error(`Resource not found: ${resourceOrId}`)
    }

    const item = new ContextItemResource(this.service, resource)
    return this.addContextItem(item, opts)
  }

  async addSpace(spaceOrId: OasisSpace | string, opts?: AddContextItemOptions) {
    const space =
      typeof spaceOrId === 'string' ? await this.tabsManager.oasis.getSpace(spaceOrId) : spaceOrId
    if (!space) {
      this.log.error(`Space not found: ${spaceOrId}`)
      throw new Error(`Space not found: ${spaceOrId}`)
    }

    const item = new ContextItemSpace(this.service, space)
    return this.addContextItem(item, opts)
  }

  async addTab(tabOrId: TabPage | TabSpace | string, opts?: AddContextItemOptions) {
    try {
      const tab =
        typeof tabOrId === 'string'
          ? await this.tabsManager.tabsValue.find((tab) => tab.id === tabOrId)
          : tabOrId

      if (!tab) {
        throw new Error(`Tab not found: ${tabOrId}`)
      }

      const existingItem = this.getTabItem(tab.id)
      if (existingItem) {
        this.log.debug('Tab already in context', tab.id)
        return existingItem
      }

      if (tab.type === 'page') {
        this.log.debug('Adding tab to context', tab.id)
        const item = new ContextItemPageTab(this.service, tab)
        return this.addContextItem(item, opts)
      } else if (tab.type === 'space') {
        const space = await this.tabsManager.oasis.getSpace(tab.spaceId)
        if (!space) {
          throw new Error(`Space not found: ${tab.spaceId}`)
        }

        const item = new ContextItemSpace(this.service, space, tab as TabSpace)
        return this.addContextItem(item, opts)
      } else if (tab.type === 'resource') {
        const resource = await this.resourceManager.getResource(tab.resourceId)
        if (!resource) {
          throw new Error(`Resource not found: ${tab.resourceId}`)
        }

        const item = new ContextItemResource(this.service, resource, tab)
        return this.addContextItem(item, opts)
      } else {
        throw new Error(`Unsupported tab type: ${tab.type}`)
      }
    } catch (error) {
      this.log.error('Failed to add tab to context', error)
      throw error
    }
  }

  async addTabs(tabs: string[], trigger?: PageChatUpdateContextEventTrigger) {
    const currentContextLength = this.itemsValue.length

    const addedItems = await Promise.all(
      tabs.map((tabId) => {
        return this.addTab(tabId)
      })
    )

    if (trigger) {
      this.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.MultiSelect,
        currentContextLength + tabs.length,
        tabs.length,
        PageChatUpdateContextItemType.PageTab,
        trigger
      )
    }

    return addedItems.length > 0 ? addedItems[0] : undefined
  }

  async addScreenshot(screenshot: Blob, opts?: AddContextItemOptions) {
    const item = new ContextItemScreenshot(this.service, screenshot)
    return this.addContextItem(item, opts)
  }

  async addActiveTab(opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_TAB)
    if (existingItem) {
      this.log.debug('Active tab already in context')
      return existingItem
    }

    const item = new ContextItemActiveTab(this.service)
    return this.addContextItem(item, opts)
  }

  async addActiveSpaceContext(include?: ActiveSpaceContextInclude, opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_SPACE)
    if (existingItem) {
      this.log.debug('Active space context already in context')
      return existingItem
    }

    const item = new ContextItemActiveSpaceContext(this.service, include)
    return this.addContextItem(item, opts)
  }

  async addInboxContext(opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.INBOX)
    if (existingItem) {
      this.log.debug('Inbox context already in context')
      return existingItem
    }

    const item = new ContextItemInbox(this.service)
    return this.addContextItem(item, opts)
  }

  async addEverythingContext(opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.EVERYTHING)
    if (existingItem) {
      this.log.debug('Everything context already in context')
      return existingItem
    }

    const item = new ContextItemEverything(this.service)
    return this.addContextItem(item, opts)
  }

  async addWikipediaContext(opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.WIKIPEDIA)
    if (existingItem) {
      this.log.debug('Wikipedia context already in context')
      return existingItem
    }

    const item = new ContextItemWikipedia(this.service)
    return this.addContextItem(item, opts)
  }

  async addBrowsingHistoryContext(opts?: AddContextItemOptions) {
    const existingItem = this.itemsValue.find(
      (item) => item.type === ContextItemTypes.BROWSING_HISTORY
    )
    if (existingItem) {
      this.log.debug('BrowsingHistory context already in context')
      return
    }

    const item = new ContextItemBrowsingHistory(this.service)
    return this.addContextItem(item, opts)
  }

  addMentionItem(item: MentionItem, opts?: AddContextItemOptions) {
    const itemId = item.id
    const activeSpaceContextItem = this.getActiveSpaceContextItem()
    if (itemId === NO_CONTEXT_MENTION.id) {
      this.clear()
    } else if (itemId === EVERYTHING_MENTION.id) {
      return this.addEverythingContext(opts)
    } else if (itemId === INBOX_MENTION.id) {
      return this.addInboxContext(opts)
    } else if (itemId === TABS_MENTION.id) {
      if (activeSpaceContextItem) {
        activeSpaceContextItem.include =
          activeSpaceContextItem.include === 'resources' ? 'everything' : 'tabs'
        return activeSpaceContextItem
      } else {
        return this.addActiveSpaceContext('tabs', opts)
      }
    } else if (itemId === ACTIVE_CONTEXT_MENTION.id) {
      if (activeSpaceContextItem) {
        activeSpaceContextItem.include =
          activeSpaceContextItem.include === 'tabs' ? 'everything' : 'resources'
        return activeSpaceContextItem
      } else {
        return this.addActiveSpaceContext('resources', opts)
      }
    } else if (itemId == ACTIVE_TAB_MENTION.id) {
      return this.addActiveTab(opts)
    } else if (itemId === WIKIPEDIA_SEARCH_MENTION.id) {
      return this.addWikipediaContext(opts)
    } else if (itemId === BROWSER_HISTORY_MENTION.id) {
      return this.addBrowsingHistoryContext(opts)
    } else if (item.type === MentionItemType.RESOURCE) {
      return this.addResource(item.id, opts)
    } else {
      return this.addSpace(itemId, opts)
    }
  }

  getItem(id: string) {
    const item = this.itemsValue.find((item) => item.id === id)
    if (item) {
      return item
    }

    // search within active tab and context item
    const activeTab = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_TAB)
    if (activeTab instanceof ContextItemActiveTab) {
      const activeTabItem = get(activeTab.item)
      if (activeTabItem?.id === id) {
        return activeTabItem
      }
    }

    const activeSpace = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_SPACE)
    if (activeSpace instanceof ContextItemActiveSpaceContext) {
      const activeSpaceItem = get(activeSpace.item)
      if (activeSpaceItem?.id === id) {
        return activeSpaceItem
      }
    }

    const pageTabs = this.itemsValue.filter((item) => item instanceof ContextItemPageTab)
    if (pageTabs.length > 0) {
      const pageTab = pageTabs.find((item) => get(item.item)?.id === id)
      if (pageTab) {
        return get(pageTab.item)
      }
    }

    return null
  }

  getTabItem(tabId: string, includeActive = false) {
    const item = this.itemsValue.find((item) => {
      if (item instanceof ContextItemPageTab) {
        return item.dataValue?.id === tabId
      } else if (item instanceof ContextItemResource) {
        return item.sourceTab?.id === tabId
      } else if (item instanceof ContextItemSpace) {
        return item.sourceTab?.id === tabId
      } else if (item instanceof ContextItemActiveTab) {
        if (includeActive) {
          this.log.debug('Checking active tab item', item.id, tabId)
          return item.currentTabValue?.id === tabId
        }

        return false
      }
    })

    return (item ?? null) as ContextItemResource | ContextItemSpace | ContextItemPageTab | null
  }

  removeTabItem(tabId: string, trigger?: PageChatUpdateContextEventTrigger) {
    const item = this.getTabItem(tabId)

    if (item) {
      this.log.debug('Removing tab item from context', tabId, item.id)
      this.removeContextItem(item.id, trigger)
      return true
    } else {
      this.log.debug('Tab item not found in context', tabId)
      return false
    }
  }

  removeSpaceItem(spaceId: string, trigger?: PageChatUpdateContextEventTrigger) {
    const item = this.itemsValue.find((item) => {
      if (item instanceof ContextItemSpace) {
        return item.data.id === spaceId
      } else {
        return false
      }
    })

    if (item) {
      this.log.debug('Removing space item from context', spaceId, item.id)
      this.removeContextItem(item.id, trigger)
      return true
    } else {
      this.log.debug('Space item not found in context', spaceId)
      return false
    }
  }

  removeResourceItem(resourceId: string, trigger?: PageChatUpdateContextEventTrigger) {
    const item = this.itemsValue.find((item) => {
      if (item instanceof ContextItemResource) {
        return item.data.id === resourceId
      } else if (item instanceof ContextItemPageTab) {
        return get(item.item)?.data?.id === resourceId
      } else {
        return false
      }
    })

    if (item) {
      this.log.debug('Removing resource item from context', resourceId, item.id)
      this.removeContextItem(item.id, trigger)
      return true
    } else {
      this.log.debug('Resource item not found in context', resourceId)
      return false
    }
  }

  getResourceItem(resourceId: string) {
    const item = this.itemsValue.find((item) => {
      if (item instanceof ContextItemResource) {
        return item.data.id === resourceId
      } else if (item instanceof ContextItemPageTab) {
        return get(item.item)?.data?.id === resourceId
      } else if (item instanceof ContextItemActiveTab) {
        return get(item.item)?.data?.id === resourceId
      }
    })

    return (item ?? null) as ContextItemResource | ContextItemPageTab | ContextItemActiveTab | null
  }

  getActiveSpaceContextItem() {
    const item = this.itemsValue.find((item) => item instanceof ContextItemActiveSpaceContext)
    return item as ContextItemActiveSpaceContext | undefined
  }

  clear(trigger?: PageChatUpdateContextEventTrigger) {
    const currentContextLength = this.itemsValue.length

    this.updateItems(() => [])
    this.persistItems()

    // We only want to clear the tab selection if we are the global context manager
    if (this.key === DEFAULT_CONTEXT_MANAGER_KEY) {
      this.tabsManager.clearTabSelection()
    }

    if (trigger) {
      this.telemetry.trackPageChatContextUpdate(
        PageChatUpdateContextEventAction.Clear,
        0,
        currentContextLength,
        undefined,
        trigger
      )
    }
  }

  updateItems(updateFn: (items: ContextItem[]) => ContextItem[]) {
    this.service.updateItems(this.key, updateFn)
  }

  async getResourceIds(prompt?: string) {
    const items = this.service.getScopedItems(this.key)
    this.log.debug('Getting resource ids for context items', items)
    const resourceIds = await Promise.all(items.map((item) => item.getResourceIds(prompt)))
    return [...new Set(resourceIds.flat())]
  }

  async getInlineImages() {
    const items = get(this.items)
    const imageItems = await Promise.all(items.map((item) => item.getInlineImages()))
    return [...new Set(imageItems.flat())]
  }

  async getPrompts(forceGenerate = false) {
    try {
      this.generatingPrompts.set(true)

      this.log.debug('Getting chat prompts', this.itemsValue)
      const model = this.ai.selectedModelValue
      const supportsJsonFormat = model.supports_json_format
      if (!supportsJsonFormat) {
        this.log.debug('Model does not support JSON format', model)
        this.generatedPrompts.set([])
        return []
      }

      const activeTabItem = get(this.activeTabContextItem)
      if (!activeTabItem) {
        this.log.debug('No active tab item found, returning empty prompts')
        this.generatedPrompts.set([])
        return []
      }

      const item = activeTabItem.itemValue
      this.log.debug('Getting prompts for active tab item', item)
      if (!item) {
        this.log.debug('No item found for active tab, returning empty prompts')
        this.generatedPrompts.set([])
        return []
      }

      const cacheKey = item instanceof ContextItemResource ? item.data.id : item.id
      const storedPrompts = this.cachedItemPrompts.get(cacheKey)
      this.log.debug('Cached prompts for item', cacheKey, storedPrompts)
      if (storedPrompts && storedPrompts.length > 0 && !forceGenerate) {
        this.generatedPrompts.set(storedPrompts)
        return storedPrompts
      }

      const generatedPrompts = await item.generatePrompts()
      this.log.debug('Got chat prompts for contextItem', item, generatedPrompts)

      this.cachedItemPrompts.set(cacheKey, generatedPrompts)
      this.generatedPrompts.set(generatedPrompts)

      return generatedPrompts
    } catch (err) {
      this.log.error('Error getting prompts for item', err)
      return []
    } finally {
      this.generatingPrompts.set(false)
    }
  }

  resetPrompts() {
    this.log.debug('Resetting prompts for context manager', this.key)
    this.generatedPrompts.set([])
    this.generatingPrompts.set(false)
  }

  // Clone the context manager into a new instance
  clone(key?: string) {
    const clone = this.service.create(this.itemsValue, key)
    return clone
  }

  replaceWith(contextManager: ContextManager) {
    this.updateItems(() =>
      contextManager.itemsValue.map((item) => {
        return item
      })
    )
    this.persistItems()
  }
}

export class ContextService {
  ai: AIService
  tabsManager: TabsManager
  resourceManager: ResourceManager
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  private _items: Writable<{ item: ContextItem; scopes: string[] }[]>
  items: Readable<{ item: ContextItem; scopes: string[] }[]>

  constructor(ai: AIService, tabsManager: TabsManager, resourceManager: ResourceManager) {
    this.ai = ai
    this.tabsManager = tabsManager
    this.resourceManager = resourceManager
    this.telemetry = resourceManager.telemetry
    this.log = useLogScope('ContextService')

    this._items = writable([])

    this.items = derived(this._items, ($items) => $items)
  }

  get itemsValue() {
    return get(this.items)
  }

  getScopedItems(scope: string) {
    return this.itemsValue.filter((item) => item.scopes.includes(scope)).map((item) => item.item)
  }

  updateItems(scope: string, updateFn: (items: ContextItem[]) => ContextItem[]) {
    const allItems = this.itemsValue
    const scopedItems = allItems.filter((x) => x.scopes.includes(scope)).map((x) => x.item)

    const updatedItems = updateFn(scopedItems)

    const deletedItems = scopedItems.filter((item) => !updatedItems.includes(item))
    const addedItems = updatedItems.filter((item) => !scopedItems.includes(item))
    const changedItems = updatedItems.filter((item) => scopedItems.includes(item))

    deletedItems.forEach((item) => {
      const index = allItems.findIndex((x) => x.item.id === item.id)
      if (index !== -1) {
        allItems[index].scopes = allItems[index].scopes.filter((x) => x !== scope)
        if (allItems[index].scopes.length === 0) {
          allItems.splice(index, 1)
          item.onDestroy()
        }
      }
    })

    addedItems.forEach((item) => {
      const index = allItems.findIndex((x) => x.item.id === item.id)
      if (index !== -1) {
        allItems[index].scopes.push(scope)
      } else {
        allItems.push({ item, scopes: [scope] })
      }
    })

    changedItems.forEach((item) => {
      const index = allItems.findIndex((x) => x.item.id === item.id)
      if (index !== -1) {
        allItems[index].item = item
      }
    })

    this.log.debug('Updated context items', allItems, {
      added: addedItems,
      deleted: deletedItems,
      changed: changedItems
    })

    this._items.set(allItems)
  }

  async getActivePrompts(forceGenerate?: boolean) {
    const usingNotesSidebar = this.ai.config.settingsValue.experimental_notes_chat_sidebar

    const activeContextManager = usingNotesSidebar
      ? this.ai.smartNotes.activeNoteValue?.contextManager
      : this.ai.contextManager
    if (activeContextManager) {
      return activeContextManager.getPrompts(forceGenerate)
    }

    return []
  }

  async getResourceFromTab(tab: TabPage) {
    const existingResourceId = tab.resourceBookmark ?? tab.chatResourceBookmark
    if (!existingResourceId) {
      return null
    }

    const fetchedResource = await this.resourceManager.getResource(existingResourceId)
    if (!fetchedResource) {
      return null
    }

    const isDeleted =
      (fetchedResource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.DELETED)
        ?.value === 'true'
    if (isDeleted) {
      this.log.debug('Existing resource is deleted, ignoring', fetchedResource.id)
      return null
    }

    const fetchedCanonical = (fetchedResource?.tags ?? []).find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
    )?.value

    if (!fetchedCanonical) {
      this.log.debug(
        'Existing resource has no canonical url, still going to use it',
        fetchedResource.id
      )
      return fetchedResource
    }

    if (
      parseUrlIntoCanonical(fetchedCanonical) !==
      parseUrlIntoCanonical(tab.currentLocation || tab.initialLocation)
    ) {
      this.log.debug(
        'Existing resource does not match current location',
        fetchedCanonical,
        tab.currentLocation,
        tab.id
      )
      return null
    }

    return fetchedResource
  }

  async preparePageTab(tab: TabPage) {
    await tick()
    const surfUrlMatch = tab.currentLocation?.match(/surf:\/\/resource\/([^\/]+)/)
    if (surfUrlMatch) {
      const resourceId = surfUrlMatch[1]
      const resource = await this.resourceManager.getResource(resourceId)
      if (resource) {
        this.log.debug('Resource found for surf url', resourceId)
        return resource
      }

      return null
    }

    const isActivated = this.tabsManager.activatedTabsValue.includes(tab.id)
    this.log.debug('Preparing tab for chat context', tab, isActivated)
    if (!isActivated) {
      this.log.debug('Tab not activated, activating first', tab.id)
      this.tabsManager.activateTab(tab.id)

      // give the tab some time to load
      await wait(200)

      const browserTab = this.tabsManager.browserTabsValue[tab.id]
      if (!browserTab) {
        this.log.error('Browser tab not found', tab.id)
        throw Error(`Browser tab not found`)
      }

      this.log.debug('Waiting for tab to become active', tab.id)
      await browserTab.waitForAppDetection(3000)
    }

    const browserTab = this.tabsManager.browserTabsValue[tab.id]
    if (!browserTab) {
      this.log.error('Browser tab not found', tab.id)
      throw Error(`Browser tab not found`)
    }

    let tabResource = await this.getResourceFromTab(tab)
    if (!tabResource) {
      const useFreshWebview = checkIfYoutubeUrl(tab.currentLocation || tab.initialLocation)

      this.log.debug('Bookmarking page for chat context', tab.id, 'fresh webview:', useFreshWebview)

      tabResource = await browserTab.createResourceForChat({ freshWebview: useFreshWebview })
    } else {
      this.log.debug('Existing resource found for tab, using it', tab.id, tabResource.id)
      // const url =
      //   tabResource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
      //     ?.value ??
      //   tab.currentLocation ??
      //   tab.initialLocation

      // this.log.debug(
      //   'Existing resource found for tab, updating with fresh content',
      //   tab.id,
      //   tabResource.id,
      //   url
      // )

      // tabResource = await browserTab.refreshResourceWithPage(tabResource, url, false)
    }

    if (!tabResource) {
      this.log.error('Failed to bookmark page for chat context', tab.id)
      throw Error(`Failed to bookmark page for chat context`)
    }

    this.log.debug('Tab prepared for chat context', tab.id, tabResource)

    return tabResource
  }

  /**
   * Checks if a given item is in the context of the currently active note's context
   */
  checkIfItemInActiveNoteContext(item: ContextItem) {
    const activeNoteContextManager = this.ai.smartNotes.activeNoteValue?.contextManager

    if (!activeNoteContextManager) {
      return false
    }

    const activeNoteContextItems = activeNoteContextManager.itemsValue
    const isInActiveNoteContext = activeNoteContextItems.some((i) => i.id === item.id)

    return isInActiveNoteContext
  }

  create(items?: ContextItem[], key?: string) {
    const ctxKey = key ?? `context-${generateID()}`
    this.log.debug('Creating context manager', ctxKey, items)

    if (items) {
      this.log.debug('Using items', items)

      this.updateItems(ctxKey, (existingItems) => {
        return [...existingItems, ...items]
      })
    }

    return new ContextManager(ctxKey, this, this.ai, this.tabsManager, this.resourceManager)
  }

  createDefault(items?: ContextItem[]) {
    const ctxKey = DEFAULT_CONTEXT_MANAGER_KEY
    this.log.debug('Creating default context manager', ctxKey, items)

    if (items) {
      this.log.debug('Using items', items)

      this.updateItems(ctxKey, (existingItems) => {
        return [...existingItems, ...items]
      })
    }

    return new ContextManager(ctxKey, this, this.ai, this.tabsManager, this.resourceManager)
  }

  static create(ai: AIService, tabsManager: TabsManager, resourceManager: ResourceManager) {
    return new ContextService(ai, tabsManager, resourceManager)
  }
}

export * from './context/index'
