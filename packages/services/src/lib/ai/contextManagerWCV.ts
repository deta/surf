import { writable, type Writable } from 'svelte/store'

import {
  useLogScope,
} from '@deta/utils'

import {
  PageChatUpdateContextItemType,
  WebContentsViewContextManagerActionType,
  type PageChatUpdateContextEventTrigger
} from '@deta/types'

import type { Resource, ResourceManager } from '../resources'
import type { TabItem } from '../tabs'
import type { Telemetry } from '../telemetry'

import {
  type ContextItem,
  ContextItemActiveTab,
  ContextItemPageTab,
  ContextItemResource,
  ContextItemSpace
} from './context/index'
import type { AIService, ChatPrompt } from './ai'
import { type MentionItem } from '@deta/editor'
import type { SearchResultLink } from '@deta/web-parser'

export type AddContextItemOptions = {
  trigger?: PageChatUpdateContextEventTrigger
  index?: number
  visible?: boolean
}

export const DEFAULT_CONTEXT_MANAGER_KEY = 'active_chat_context'

export class ContextManagerWCV {
  key: string

  generatingPrompts: Writable<boolean>
  generatedPrompts: Writable<ChatPrompt[]>

  cachedItemPrompts: Map<string, ChatPrompt[]>

  ai: AIService
  resourceManager: ResourceManager
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(
    key: string,
    ai: AIService,
    resourceManager: ResourceManager
  ) {
    this.key = key
    this.ai = ai
    this.resourceManager = resourceManager
    this.telemetry = resourceManager.telemetry
    this.log = useLogScope(`ContextManagerWCV ${key}`)

    this.cachedItemPrompts = new Map()
    this.generatingPrompts = writable(false)
    this.generatedPrompts = writable([])
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
    // } else if (item instanceof ContextItemActiveSpaceContext) {
    //   return PageChatUpdateContextItemType.ActiveSpace
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

    return item
  }

  removeContextItem(id: string, trigger?: PageChatUpdateContextEventTrigger) {
    this.log.debug('Removing context item', id)
  }

  removeAllExcept(ids: string | string[], trigger?: PageChatUpdateContextEventTrigger) {
    const idsArray = Array.isArray(ids) ? ids : [ids]
    this.log.debug('Removing all context items except', idsArray)
  }

  async addResource(resourceOrId: Resource | string, opts?: AddContextItemOptions) {
    // const resource =
    //   typeof resourceOrId === 'string'
    //     ? await this.resourceManager.getResource(resourceOrId)
    //     : resourceOrId
    // if (!resource) {
    //   this.log.error(`Resource not found: ${resourceOrId}`)
    //   throw new Error(`Resource not found: ${resourceOrId}`)
    // }

    // const item = new ContextItemResource(this.service, resource)
    // return this.addContextItem(item, opts)
  }

  async addSpace(spaceOrId: any | string, opts?: AddContextItemOptions) {
    // const space =
    //   typeof spaceOrId === 'string' ? await this.tabsManager.oasis.getSpace(spaceOrId) : spaceOrId
    // if (!space) {
    //   this.log.error(`Space not found: ${spaceOrId}`)
    //   throw new Error(`Space not found: ${spaceOrId}`)
    // }

    // const item = new ContextItemSpace(this.service, space)
    // return this.addContextItem(item, opts)
  }

  async addTab(tabOrId: TabItem | string, opts?: AddContextItemOptions) {
    // try {
    //   const tab =
    //     typeof tabOrId === 'string'
    //       ? await this.tabsManager.tabsValue.find((tab) => tab.id === tabOrId)
    //       : tabOrId

    //   if (!tab) {
    //     throw new Error(`Tab not found: ${tabOrId}`)
    //   }

    //   const existingItem = this.getTabItem(tab.id)
    //   if (existingItem) {
    //     this.log.debug('Tab already in context', tab.id)
    //     return existingItem
    //   }

    //   this.log.debug('Adding tab to context', tab.id)
    //   const item = new ContextItemPageTab(this.service, tab)
    //   return this.addContextItem(item, opts)

    //   // if (tab.type === 'page') {
    //   //   this.log.debug('Adding tab to context', tab.id)
    //   //   const item = new ContextItemPageTab(this.service, tab)
    //   //   return this.addContextItem(item, opts)
    //   // // } else if (tab.type === 'space') {
    //   // //   const space = await this.tabsManager.oasis.getSpace(tab.spaceId)
    //   // //   if (!space) {
    //   // //     throw new Error(`Space not found: ${tab.spaceId}`)
    //   // //   }

    //   // //   const item = new ContextItemSpace(this.service, space, tab as TabSpace)
    //   // //   return this.addContextItem(item, opts)
    //   // } else if (tab.type === 'resource') {
    //   //   const resource = await this.resourceManager.getResource(tab.resourceId)
    //   //   if (!resource) {
    //   //     throw new Error(`Resource not found: ${tab.resourceId}`)
    //   //   }

    //   //   const item = new ContextItemResource(this.service, resource, tab)
    //   //   return this.addContextItem(item, opts)
    //   // } else {
    //   //   throw new Error(`Unsupported tab type: ${tab.type}`)
    //   // }
    // } catch (error) {
    //   this.log.error('Failed to add tab to context', error)
    //   throw error
    // }
  }

  async addTabs(tabs: string[], trigger?: PageChatUpdateContextEventTrigger) {
    // const currentContextLength = this.itemsValue.length

    // const addedItems = await Promise.all(
    //   tabs.map((tabId) => {
    //     return this.addTab(tabId)
    //   })
    // )

    // if (trigger) {
    //   this.telemetry.trackPageChatContextUpdate(
    //     PageChatUpdateContextEventAction.MultiSelect,
    //     currentContextLength + tabs.length,
    //     tabs.length,
    //     PageChatUpdateContextItemType.PageTab,
    //     trigger
    //   )
    // }

    // return addedItems.length > 0 ? addedItems[0] : undefined
  }

  async addScreenshot(screenshot: Blob, opts?: AddContextItemOptions) {
    // const item = new ContextItemScreenshot(this.service, screenshot)
    // return this.addContextItem(item, opts)
  }

  async addActiveTab(opts?: AddContextItemOptions) {
    // const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_TAB)
    // if (existingItem) {
    //   this.log.debug('Active tab already in context')
    //   return existingItem
    // }

    // const item = new ContextItemActiveTab(this.service)
    // return this.addContextItem(item, opts)
  }

  async addActiveSpaceContext() {
    // no-op
  }

  async addInboxContext(opts?: AddContextItemOptions) {
    // const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.INBOX)
    // if (existingItem) {
    //   this.log.debug('Inbox context already in context')
    //   return existingItem
    // }

    // const item = new ContextItemInbox(this.service)
    // return this.addContextItem(item, opts)
  }

  async addEverythingContext(opts?: AddContextItemOptions) {
    // const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.EVERYTHING)
    // if (existingItem) {
    //   this.log.debug('Everything context already in context')
    //   return existingItem
    // }

    // const item = new ContextItemEverything(this.service)
    // return this.addContextItem(item, opts)
  }

  async addWikipediaContext(opts?: AddContextItemOptions) {
    // const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.WIKIPEDIA)
    // if (existingItem) {
    //   this.log.debug('Wikipedia context already in context')
    //   return existingItem
    // }

    // const item = new ContextItemWikipedia(this.service)
    // return this.addContextItem(item, opts)
  }

  async addBrowsingHistoryContext(opts?: AddContextItemOptions) {
    // const existingItem = this.itemsValue.find(
    //   (item) => item.type === ContextItemTypes.BROWSING_HISTORY
    // )
    // if (existingItem) {
    //   this.log.debug('BrowsingHistory context already in context')
    //   return
    // }

    // const item = new ContextItemBrowsingHistory(this.service)
    // return this.addContextItem(item, opts)
  }

  async addWebSearchContext(resultLinks: SearchResultLink[], opts?: AddContextItemOptions) {
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(WebContentsViewContextManagerActionType.ADD_WEB_SEARCH_CONTEXT, { results: resultLinks })

    this.log.debug('Got resource ids from main process', result)
  }

  addMentionItem(item: MentionItem, opts?: AddContextItemOptions) {
    // const itemId = item.id
    // if (itemId === NO_CONTEXT_MENTION.id) {
    //   this.clear()
    // } else if (itemId === EVERYTHING_MENTION.id) {
    //   return this.addEverythingContext(opts)
    // } else if (itemId === INBOX_MENTION.id) {
    //   return this.addInboxContext(opts)
    // // } else if (itemId === TABS_MENTION.id) {
    // //   if (activeSpaceContextItem) {
    // //     activeSpaceContextItem.include =
    // //       activeSpaceContextItem.include === 'resources' ? 'everything' : 'tabs'
    // //     return activeSpaceContextItem
    // //   } else {
    // //     return this.addActiveSpaceContext('tabs', opts)
    // //   }
    // // } else if (itemId === ACTIVE_CONTEXT_MENTION.id) {
    // //   if (activeSpaceContextItem) {
    // //     activeSpaceContextItem.include =
    // //       activeSpaceContextItem.include === 'tabs' ? 'everything' : 'resources'
    // //     return activeSpaceContextItem
    // //   } else {
    // //     return this.addActiveSpaceContext('resources', opts)
    // //   }
    // } else if (itemId == ACTIVE_TAB_MENTION.id) {
    //   return this.addActiveTab(opts)
    // } else if (itemId === WIKIPEDIA_SEARCH_MENTION.id) {
    //   return this.addWikipediaContext(opts)
    // } else if (itemId === BROWSER_HISTORY_MENTION.id) {
    //   return this.addBrowsingHistoryContext(opts)
    // } else if (item.type === MentionItemType.RESOURCE) {
    //   return this.addResource(item.id, opts)
    // } else {
    //   return this.addSpace(itemId, opts)
    // }
  }

  getItem(id: string) {
    // const item = this.itemsValue.find((item) => item.id === id)
    // if (item) {
    //   return item
    // }

    // // search within active tab and context item
    // const activeTab = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_TAB)
    // if (activeTab instanceof ContextItemActiveTab) {
    //   const activeTabItem = get(activeTab.item)
    //   if (activeTabItem?.id === id) {
    //     return activeTabItem
    //   }
    // }

    // // const activeSpace = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_SPACE)
    // // if (activeSpace instanceof ContextItemActiveSpaceContext) {
    // //   const activeSpaceItem = get(activeSpace.item)
    // //   if (activeSpaceItem?.id === id) {
    // //     return activeSpaceItem
    // //   }
    // // }

    // const pageTabs = this.itemsValue.filter((item) => item instanceof ContextItemPageTab)
    // if (pageTabs.length > 0) {
    //   const pageTab = pageTabs.find((item) => get(item.item)?.id === id)
    //   if (pageTab) {
    //     return get(pageTab.item)
    //   }
    // }

    // return null
  }

  clear(trigger?: PageChatUpdateContextEventTrigger) {
    // const currentContextLength = this.itemsValue.length

    // this.updateItems(() => [])
    // this.persistItems()

    // // We only want to clear the tab selection if we are the global context manager
    // // if (this.key === DEFAULT_CONTEXT_MANAGER_KEY) {
    // //   this.tabsManager.clearTabSelection()
    // // }

    // if (trigger) {
    //   this.telemetry.trackPageChatContextUpdate(
    //     PageChatUpdateContextEventAction.Clear,
    //     0,
    //     currentContextLength,
    //     undefined,
    //     trigger
    //   )
    // }
  }

  updateItems(updateFn: (items: ContextItem[]) => ContextItem[]) {
    // this.service.updateItems(this.key, updateFn)
  }

  async getResourceIds(prompt?: string) {
    // const items = this.service.getScopedItems(this.key)
    // this.log.debug('Getting resource ids for context items', items)
    // const resourceIds = await Promise.all(items.map((item) => item.getResourceIds(prompt)))
    // return [...new Set(resourceIds.flat())] as string[]

    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(WebContentsViewContextManagerActionType.GET_ITEMS, { prompt })

    this.log.debug('Got resource ids from main process', result)

    return (result?.resourceIds || []) as string[]
  }

  async getInlineImages() {
    // const items = get(this.items)
    // const imageItems = await Promise.all(items.map((item) => item.getInlineImages()))
    // return [...new Set(imageItems.flat())]
    return []
  }

  async getPrompts(forceGenerate = false) {
    // try {
    //   this.generatingPrompts.set(true)

    //   this.log.debug('Getting chat prompts', this.itemsValue)
    //   const model = this.ai.selectedModelValue
    //   const supportsJsonFormat = model.supports_json_format
    //   if (!supportsJsonFormat) {
    //     this.log.debug('Model does not support JSON format', model)
    //     this.generatedPrompts.set([])
    //     return []
    //   }

    //   const activeTabItem = get(this.activeTabContextItem)
    //   if (!activeTabItem) {
    //     this.log.debug('No active tab item found, returning empty prompts')
    //     this.generatedPrompts.set([])
    //     return []
    //   }

    //   const item = activeTabItem.itemValue
    //   this.log.debug('Getting prompts for active tab item', item)
    //   if (!item) {
    //     this.log.debug('No item found for active tab, returning empty prompts')
    //     this.generatedPrompts.set([])
    //     return []
    //   }

    //   const cacheKey = item instanceof ContextItemResource ? item.data.id : item.id
    //   const storedPrompts = this.cachedItemPrompts.get(cacheKey)
    //   this.log.debug('Cached prompts for item', cacheKey, storedPrompts)
    //   if (storedPrompts && storedPrompts.length > 0 && !forceGenerate) {
    //     this.generatedPrompts.set(storedPrompts)
    //     return storedPrompts
    //   }

    //   const generatedPrompts = await item.generatePrompts()
    //   this.log.debug('Got chat prompts for contextItem', item, generatedPrompts)

    //   this.cachedItemPrompts.set(cacheKey, generatedPrompts)
    //   this.generatedPrompts.set(generatedPrompts)

    //   return generatedPrompts
    // } catch (err) {
    //   this.log.error('Error getting prompts for item', err)
    //   return []
    // } finally {
    //   this.generatingPrompts.set(false)
    // }
  }

  resetPrompts() {
    // this.log.debug('Resetting prompts for context manager', this.key)
    // this.generatedPrompts.set([])
    // this.generatingPrompts.set(false)
  }
}

