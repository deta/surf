import { tick } from 'svelte'
import { type Writable, type Readable, writable, derived, get } from 'svelte/store'
import {
  PageChatUpdateContextEventAction,
  PageChatUpdateContextEventTrigger,
  PageChatUpdateContextItemType
} from '@horizon/types'

import type { Tab } from '../../../types'

import { ContextItemBase } from './base'
import type { ContextManager } from '../contextManager'
import { ContextItemResource } from './resource'
import { ContextItemSpace } from './space'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'
import type { ChatPrompt } from '../chat'

export class ContextItemActiveTab extends ContextItemBase {
  type = ContextItemTypes.ACTIVE_TAB

  cachedItemPrompts: Map<string, ChatPrompt[]>

  currentTab: Writable<Tab | null>
  item: Writable<ContextItemResource | ContextItemSpace | null>

  activeTab: Readable<Tab | null>

  constructor(manager: ContextManager) {
    super(manager, ContextItemTypes.ACTIVE_TAB, 'browser')

    this.item = writable(null)
    this.currentTab = writable(null)

    this.cachedItemPrompts = new Map()

    this.activeTab = derived([manager.tabsManager.activeTab], ([activeTab]) => {
      if (!activeTab) {
        this.item.set(null)
        this.currentTab.set(null)
        return null
      }

      if (!this.currentTabValue || !this.compareTabs(activeTab, this.currentTabValue)) {
        this.updateItem(activeTab)
        return activeTab
      } else {
        return null
      }
    })

    this.label = derived([this.item], ([item]) => {
      if (item) {
        return item.labelValue
      } else {
        return 'Active Tab'
      }
    })

    this.icon = derived([this.item], ([item]) => {
      if (item) {
        return item.iconValue
      } else {
        return { type: ContextItemIconTypes.ICON, data: this.fallbackIcon } as ContextItemIcon
      }
    })

    // This is a hack to make sure the derived function above actually runs
    this.activeTab.subscribe(async (activeTab) => {
      if (activeTab) {
        await tick()
        // this.log.debug('Active tab changed', activeTab.id)
      }
    })
  }

  get itemValue() {
    return get(this.item)
  }

  get currentTabValue() {
    return get(this.currentTab)
  }

  compareTabs(tab1: Tab, tab2: Tab) {
    if (tab1.id !== tab2.id) {
      return false
    }

    if (tab1.type !== tab2.type) {
      return false
    }

    if (tab1.type === 'page' && tab2.type === 'page') {
      return tab1.currentLocation === tab2.currentLocation
    }

    if (tab1.type === 'space' && tab2.type === 'space') {
      return tab1.spaceId === tab2.spaceId
    }

    return true
  }

  async updateItem(tab: Tab) {
    const existingItem = this.itemValue
    const existingTab = this.currentTabValue

    this.currentTab.set(tab)

    await tick()

    if (tab.type === 'page') {
      const resource = await this.manager.preparePageTab(tab)
      if (!resource) {
        this.log.error('Failed to prepare page tab', tab.id)
        this.item.set(null)
        return
      }

      const newItem = new ContextItemResource(this.manager, resource, tab)
      this.item.set(newItem)

      // Only track if the item is new and a completely different tab
      if (existingItem && tab.id !== existingTab?.id) {
        this.manager.telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.ActiveChanged,
          this.manager.itemsValue.length,
          0,
          PageChatUpdateContextItemType.PageTab,
          PageChatUpdateContextEventTrigger.ActiveTabChanged
        )
      }
    } else if (tab.type === 'space') {
      const space = await this.manager.tabsManager.oasis.getSpace(tab.spaceId)
      if (!space) {
        this.item.set(null)
        return
      }

      const newItem = new ContextItemSpace(this.manager, space, tab)
      this.item.set(newItem)

      // Only track if the item is new and a completely different tab
      if (existingItem && tab.id !== existingTab?.id) {
        this.manager.telemetry.trackPageChatContextUpdate(
          PageChatUpdateContextEventAction.ActiveChanged,
          this.manager.itemsValue.length,
          1,
          PageChatUpdateContextItemType.Space,
          PageChatUpdateContextEventTrigger.ActiveTabChanged
        )
      }
    } else {
      this.item.set(null)
    }
  }

  async getResourceIds() {
    const item = get(this.item)
    if (item) {
      return item.getResourceIds()
    } else {
      return []
    }
  }

  async getInlineImages() {
    const item = get(this.item)
    if (item) {
      return item.getInlineImages()
    } else {
      return []
    }
  }

  async generatePrompts() {
    const item = get(this.item)
    if (item) {
      return item.generatePrompts()
    } else {
      return []
    }
  }

  async getPrompts(fresh = false) {
    const item = get(this.item)

    this.log.debug('Getting prompts for item', item, fresh)
    if (!item) {
      return []
    }

    const storedPrompts = this.cachedItemPrompts.get(item.id)
    if (storedPrompts && storedPrompts.length > 0 && !fresh) {
      this.prompts.set(storedPrompts)
      return storedPrompts
    }

    const generatedPrompts = await this.generatePrompts()
    this.cachedItemPrompts.set(item.id, generatedPrompts)
    this.prompts.set(generatedPrompts)
    return generatedPrompts
  }
}
