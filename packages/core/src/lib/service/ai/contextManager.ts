import { tick } from 'svelte'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import { parseUrlIntoCanonical, useLocalStorage, useLogScope, wait } from '@horizon/utils'

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
import { ContextItemHome } from './context/home'
import { ContextItemEverything } from './context/everything'
import type { ActiveSpaceContextInclude } from './context/activeSpaceContexts'
import { ContextItemWikipedia } from './context/wikipedia'

export class ContextManager {
  key = 'active_chat_context'

  private _storage: ReturnType<typeof useLocalStorage<StoredContextItem[]>>
  private _items: Writable<ContextItem[]>
  generatingPrompts: Writable<boolean>
  generatedPrompts: Writable<ChatPrompt[]>

  items: Readable<ContextItem[]>

  tabsInContext: Readable<Tab[]>
  spacesInContext: Readable<OasisSpace[]>
  resourcesInContext: Readable<Resource[]>
  screenshotsInContext: Readable<Blob[]>
  activeTabContextItem: Readable<ContextItemActiveTab | undefined>
  activeSpaceContextItem: Readable<ContextItemActiveSpaceContext | undefined>

  ai: AIService
  tabsManager: TabsManager
  resourceManager: ResourceManager
  telemetry: Telemetry
  log: ReturnType<typeof useLogScope>

  constructor(
    ai: AIService,
    tabsManager: TabsManager,
    resourceManager: ResourceManager,
    items?: ContextItem[]
  ) {
    this.ai = ai
    this.tabsManager = tabsManager
    this.resourceManager = resourceManager
    this.telemetry = resourceManager.telemetry
    this.log = useLogScope('ContextManager')

    this.generatingPrompts = writable(false)
    this.generatedPrompts = writable([])
    this._storage = useLocalStorage<StoredContextItem[]>(this.key, [], true)
    this._items = writable(items ?? [])

    this.items = derived(this._items, ($items) => $items)

    this.tabsInContext = derived(
      [this._items, this.tabsManager.activeTab],
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

    this.spacesInContext = derived([this._items], ([$contextItems]) => {
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

    this.resourcesInContext = derived([this._items], ([$contextItems]) => {
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

    this.screenshotsInContext = derived([this._items], ([$contextItems]) => {
      return $contextItems
        .filter((item) => item instanceof ContextItemScreenshot)
        .map((item) => (item as ContextItemScreenshot).data)
    })

    this.activeTabContextItem = derived([this._items], ([$contextItems]) => {
      return $contextItems.find((item) => item instanceof ContextItemActiveTab)
    })

    this.activeSpaceContextItem = derived([this._items], ([$contextItems]) => {
      return $contextItems.find((item) => item instanceof ContextItemActiveSpaceContext)
    })
  }

  get itemsValue() {
    return get(this._items)
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

  async restoreItems() {
    const storedItems = this._storage.get()
    if (!storedItems) {
      return
    }

    this.log.debug('Restoring context items', storedItems)

    const items: ContextItem[] = []
    let encounteredMalformedType = false

    for (const storedItem of storedItems) {
      if (storedItem.type === ContextItemTypes.RESOURCE && storedItem.data) {
        const resource = await this.resourceManager.getResource(storedItem.data)
        if (resource) {
          items.push(new ContextItemResource(this, resource))
        }
      } else if (storedItem.type === ContextItemTypes.SPACE && storedItem.data) {
        const space = await this.tabsManager.oasis.getSpace(storedItem.data)
        if (space) {
          items.push(new ContextItemSpace(this, space))
        }
      } else if (storedItem.type === ContextItemTypes.PAGE_TAB && storedItem.data) {
        const tab = this.tabsManager.tabsValue.find((tab) => tab.id === storedItem.data)
        if (tab?.type === 'page') {
          items.push(new ContextItemPageTab(this, tab))
        } else if (tab?.type === 'space') {
          const space = await this.tabsManager.oasis.getSpace(tab.spaceId)
          if (space) {
            items.push(new ContextItemSpace(this, space, tab as TabSpace))
          }
        } else {
          this.log.error('Invalid tab', tab)
          // encounteredMalformedType = true
        }
      } else if (storedItem.type === ContextItemTypes.ACTIVE_TAB) {
        items.push(new ContextItemActiveTab(this))
      } else if (storedItem.type === ContextItemTypes.ACTIVE_SPACE) {
        items.push(new ContextItemActiveSpaceContext(this))
      } else {
        this.log.error('Unknown stored item type', storedItem)
        encounteredMalformedType = true
      }
    }

    this.log.debug('Restored context items', items)

    this.updateItems(() => items)

    await tick()

    if (encounteredMalformedType) {
      this.persistItems()
    }
  }

  async persistItems() {
    await tick()
    const itemsToStore = this.itemsValue
      .filter((item) => !(item instanceof ContextItemScreenshot))
      .map((item) => {
        if (item instanceof ContextItemResource) {
          return {
            id: item.id,
            type: item.type,
            data: item.data.id
          }
        } else if (item instanceof ContextItemSpace) {
          return {
            id: item.id,
            type: item.type,
            data: item.data.id
          }
        } else if (item instanceof ContextItemPageTab) {
          return {
            id: item.id,
            type: item.type,
            data: item.dataValue?.id
          }
        } else if (item instanceof ContextItemActiveTab) {
          return {
            id: item.id,
            type: item.type
          }
        } else if (item instanceof ContextItemActiveSpaceContext) {
          return {
            id: item.id,
            type: item.type
          }
        } else {
          return {
            id: item.id,
            type: item.type
          }
        }
      })

    this._storage.set(itemsToStore)
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

  addContextItem<T extends ContextItem>(
    item: T,
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number | undefined
  ) {
    this.log.debug('Adding context item', item.id)
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

    const linkedTab = this.getTabFromItem(item)
    if (linkedTab) {
      this.tabsManager.addTabToSelection(linkedTab.id)
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
          const linkedTab = this.getTabFromItem(item)
          if (linkedTab) {
            this.tabsManager.removeTabFromSelection(linkedTab.id)
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
      this.log.debug('Bookmarking page for chat context', tab.id)
      tabResource = await browserTab.createResourceForChat()
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

  async addResource(
    resourceOrId: Resource | string,
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number
  ) {
    const resource =
      typeof resourceOrId === 'string'
        ? await this.resourceManager.getResource(resourceOrId)
        : resourceOrId
    if (!resource) {
      this.log.error(`Resource not found: ${resourceOrId}`)
      throw new Error(`Resource not found: ${resourceOrId}`)
    }

    const item = new ContextItemResource(this, resource)
    return this.addContextItem(item, trigger, index)
  }

  async addSpace(
    spaceOrId: OasisSpace | string,
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number
  ) {
    const space =
      typeof spaceOrId === 'string' ? await this.tabsManager.oasis.getSpace(spaceOrId) : spaceOrId
    if (!space) {
      this.log.error(`Space not found: ${spaceOrId}`)
      throw new Error(`Space not found: ${spaceOrId}`)
    }

    const item = new ContextItemSpace(this, space)
    return this.addContextItem(item, trigger, index)
  }

  async addTab(
    tabOrId: TabPage | TabSpace | string,
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number
  ) {
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
        const item = new ContextItemPageTab(this, tab)
        return this.addContextItem(item, trigger, index)
      } else if (tab.type === 'space') {
        const space = await this.tabsManager.oasis.getSpace(tab.spaceId)
        if (!space) {
          throw new Error(`Space not found: ${tab.spaceId}`)
        }

        const item = new ContextItemSpace(this, space, tab as TabSpace)
        return this.addContextItem(item, trigger, index)
      } else if (tab.type === 'resource') {
        const resource = await this.resourceManager.getResource(tab.resourceId)
        if (!resource) {
          throw new Error(`Resource not found: ${tab.resourceId}`)
        }

        const item = new ContextItemResource(this, resource, tab)
        return this.addContextItem(item, trigger, index)
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

    await Promise.all(
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

    return
  }

  async addScreenshot(
    screenshot: Blob,
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number
  ) {
    const item = new ContextItemScreenshot(this, screenshot)
    this.addContextItem(item, trigger, index)
  }

  async addActiveTab(trigger?: PageChatUpdateContextEventTrigger, index?: number) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_TAB)
    if (existingItem) {
      this.log.debug('Active tab already in context')
      return
    }

    const item = new ContextItemActiveTab(this)
    this.addContextItem(item, trigger, index)
  }

  async addActiveSpaceContext(
    trigger?: PageChatUpdateContextEventTrigger,
    index?: number,
    include?: ActiveSpaceContextInclude
  ) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.ACTIVE_SPACE)
    if (existingItem) {
      this.log.debug('Active space context already in context')
      return
    }

    const item = new ContextItemActiveSpaceContext(this, include)
    this.addContextItem(item, trigger, index)
  }

  async addHomeContext(trigger?: PageChatUpdateContextEventTrigger, index?: number) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.HOME)
    if (existingItem) {
      this.log.debug('Home context already in context')
      return
    }

    const item = new ContextItemHome(this)
    this.addContextItem(item, trigger, index)
  }

  async addEverythingContext(trigger?: PageChatUpdateContextEventTrigger, index?: number) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.EVERYTHING)
    if (existingItem) {
      this.log.debug('Everything context already in context')
      return
    }

    const item = new ContextItemEverything(this)
    this.addContextItem(item, trigger, index)
  }

  async addWikipediaContext(trigger?: PageChatUpdateContextEventTrigger, index?: number) {
    const existingItem = this.itemsValue.find((item) => item.type === ContextItemTypes.WIKIPEDIA)
    if (existingItem) {
      this.log.debug('Wikipedia context already in context')
      return
    }

    const item = new ContextItemWikipedia(this)
    this.addContextItem(item, trigger, index)
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
      this.log.trace('Removing tab item from context', tabId, item.id)
      this.removeContextItem(item.id, trigger)
      return true
    } else {
      this.log.debug('Tab item not found in context', tabId)
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

    this.tabsManager.clearTabSelection()

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
    const currentItems = this.itemsValue
    const updatedItems = updateFn(currentItems)

    const deletedItems = currentItems.filter((item) => !updatedItems.includes(item))
    deletedItems.forEach((item) => {
      item.onDestroy()
    })

    this._items.set(updatedItems)
  }

  async getResourceIds(prompt?: string) {
    const items = get(this._items)
    const resourceIds = await Promise.all(items.map((item) => item.getResourceIds(prompt)))
    return [...new Set(resourceIds.flat())]
  }

  async getInlineImages() {
    const items = get(this._items)
    const imageItems = await Promise.all(items.map((item) => item.getInlineImages()))
    return [...new Set(imageItems.flat())]
  }

  async getPromptsForItem(idOrItem: string | ContextItem, fresh = false) {
    const item =
      typeof idOrItem === 'string'
        ? get(this._items).find((item) => item.id === idOrItem)
        : idOrItem
    if (!item) {
      return []
    }

    this.log.debug('Getting chat prompts for contextItem', item)
    const model = this.ai.selectedModelValue
    const supportsJsonFormat = model.supports_json_format
    if (!supportsJsonFormat) {
      this.log.debug('Model does not support JSON format', model)
      this.generatedPrompts.set([])
      return []
    }

    const prompts = await item.getPrompts(fresh)
    this.log.debug('Got chat prompts for contextItem', item, prompts)
    this.generatedPrompts.set(prompts)
    return prompts
  }

  // Clone the context manager into a new instance
  clone() {
    const clone = new ContextManager(
      this.ai,
      this.tabsManager,
      this.resourceManager,
      this.itemsValue
    )
    return clone
  }

  replaceWith(contextManager: ContextManager) {
    this.updateItems(() => contextManager.itemsValue)
    this.persistItems()
  }
}

export * from './context/index'
