import { writable, type Writable } from 'svelte/store'

import { useLogScope, wait } from '@deta/utils'

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
import { MentionItemType, type MentionItem } from '@deta/editor'
import type { SearchResultLink } from '@deta/web-parser'
import {
  ACTIVE_TAB_MENTION,
  BROWSER_HISTORY_MENTION,
  EVERYTHING_MENTION,
  INBOX_MENTION,
  NO_CONTEXT_MENTION,
  TABS_MENTION,
  WIKIPEDIA_SEARCH_MENTION
} from '../constants/chat'

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

  constructor(key: string, ai: AIService, resourceManager: ResourceManager) {
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

  async addResource(resourceId: string, opts?: AddContextItemOptions) {
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_RESOURCE_CONTEXT,
      { id: resourceId }
    )

    this.log.debug('Added resource context', result)
  }

  async addNotebook(notebookId: string, opts?: AddContextItemOptions) {
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_NOTEBOOK_CONTEXT,
      { id: notebookId }
    )

    this.log.debug('Added notebook context', result)
  }

  async addTab(tabId: string, opts?: AddContextItemOptions) {
    this.log.debug('Adding tab context via webContentsViewContextManagerAction', tabId)
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_TAB_CONTEXT,
      { id: tabId }
    )

    this.log.debug('Added tab context', result)
  }

  async addTabs(trigger?: PageChatUpdateContextEventTrigger) {
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_TABS_CONTEXT,
      undefined
    )

    this.log.debug('Added tabs context', result)
  }

  async addScreenshot(screenshot: Blob, opts?: AddContextItemOptions) {
    // const item = new ContextItemScreenshot(this.service, screenshot)
    // return this.addContextItem(item, opts)
  }

  async addActiveTab(opts?: AddContextItemOptions) {
    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_ACTIVE_TAB_CONTEXT,
      undefined
    )

    this.log.debug('Added active tab context', result)
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
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.ADD_WEB_SEARCH_CONTEXT,
      { results: resultLinks }
    )

    this.log.debug('Added web search context', result)
  }

  addMentionItem(item: MentionItem, opts?: AddContextItemOptions) {
    const itemId = item.id
    this.log.debug('Adding mention item to context', item)
    if (itemId === NO_CONTEXT_MENTION.id) {
      this.clear()
      // } else if (itemId === EVERYTHING_MENTION.id) {
      //   return this.addEverythingContext(opts)
      // } else if (itemId === INBOX_MENTION.id) {
      //   return this.addInboxContext(opts)
      // } else if (itemId === ACTIVE_CONTEXT_MENTION.id) {
      //   if (activeSpaceContextItem) {
      //     activeSpaceContextItem.include =
      //       activeSpaceContextItem.include === 'tabs' ? 'everything' : 'resources'
      //     return activeSpaceContextItem
      //   } else {
      //     return this.addActiveSpaceContext('resources', opts)
      //   }
      // } else if (itemId == ACTIVE_TAB_MENTION.id) {
      //   return this.addActiveTab(opts)
      // } else if (itemId === WIKIPEDIA_SEARCH_MENTION.id) {
      //   return this.addWikipediaContext(opts)
      // } else if (itemId === BROWSER_HISTORY_MENTION.id) {
      //   return this.addBrowsingHistoryContext(opts)
    } else if (item.type === MentionItemType.TAB) {
      return this.addTab(item.id, opts)
    } else if (item.type === MentionItemType.RESOURCE) {
      return this.addResource(item.id, opts)
    } else if (item.type === MentionItemType.NOTEBOOK) {
      return this.addNotebook(item.id, opts)
    } else if (item.type === MentionItemType.ALL_TABS) {
      return this.addTabs()
    } else if (item.type === MentionItemType.ACTIVE_TAB) {
      return this.addActiveTab(opts)
    } else {
      this.log.error('Unknown mention item type', item)
      return null
    }
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

    await wait(500)

    // @ts-ignore
    const result = await window.api.webContentsViewContextManagerAction(
      WebContentsViewContextManagerActionType.GET_ITEMS,
      { prompt }
    )

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
