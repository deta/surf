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
import { useDebounce, wait } from '@horizon/utils'

export class ContextItemActiveTab extends ContextItemBase {
  type = ContextItemTypes.ACTIVE_TAB

  cachedItemPrompts: Map<string, ChatPrompt[]>
  loadingUnsub: (() => void) | null = null

  loading: Writable<boolean>
  currentTab: Writable<Tab | null>
  item: Writable<ContextItemResource | ContextItemSpace | null>

  activeTabUnsub: () => void

  constructor(manager: ContextManager) {
    super(manager, ContextItemTypes.ACTIVE_TAB, 'browser')

    this.item = writable(null)
    this.currentTab = writable(null)
    this.loading = writable(false)

    this.cachedItemPrompts = new Map()

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

    this.activeTabUnsub = this.manager.tabsManager.activeTab.subscribe((activeTab) => {
      this.log.debug('Active tab changed', activeTab?.id)

      if (!activeTab) {
        this.item.set(null)
        this.currentTab.set(null)
        return
      }

      if (!this.currentTabValue || !this.compareTabs(activeTab, this.currentTabValue)) {
        this.debounceUpdateItem()
      }
    })
  }

  get itemValue() {
    return get(this.item)
  }

  get currentTabValue() {
    return get(this.currentTab)
  }

  get loadingValue() {
    return get(this.loading)
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

  async updateItem() {
    try {
      this.loading.set(true)

      const tab = this.manager.tabsManager.activeTabValue
      if (!tab) {
        this.item.set(null)
        return
      }

      const existingItem = this.itemValue
      const existingTab = this.currentTabValue

      this.currentTab.set(tab)

      this.log.debug('Updating active tab', tab)

      await tick()

      if (tab.type === 'page') {
        this.log.debug('Preparing page tab', tab)
        const resource = await this.manager.preparePageTab(tab)
        if (!resource) {
          this.log.error('Failed to prepare page tab', tab.id)
          this.item.set(null)
          return
        }

        this.log.debug('Prepared page tab', tab.id, resource)

        const newItem = new ContextItemResource(this.manager, resource, tab)
        this.item.set(newItem)

        const showChatSidebar = this.manager.ai.showChatSidebarValue
        const autoGeneratePrompts =
          this.manager.ai.config.settingsValue.automatic_chat_prompt_generation
        if (showChatSidebar && autoGeneratePrompts) {
          this.manager.getPromptsForItem(newItem)
        } else {
          this.log.debug('Skipping auto prompt generation for page tab as it is disabled', tab.id)
        }

        // Only track if the item is new and a completely different tab
        if (existingItem && tab.id !== existingTab?.id && showChatSidebar) {
          this.manager.telemetry.trackPageChatContextUpdate(
            PageChatUpdateContextEventAction.ActiveChanged,
            this.manager.itemsValue.length,
            0,
            PageChatUpdateContextItemType.PageTab,
            PageChatUpdateContextEventTrigger.ActiveTabChanged
          )
        }
      } else if (tab.type === 'space') {
        this.log.debug('Preparing space tab', tab)
        const space = await this.manager.tabsManager.oasis.getSpace(tab.spaceId)
        if (!space) {
          this.item.set(null)
          return
        }

        const newItem = new ContextItemSpace(this.manager, space, tab)
        this.item.set(newItem)

        // Only track if the item is new and a completely different tab
        const showChatSidebar = this.manager.ai.showChatSidebarValue
        if (existingItem && tab.id !== existingTab?.id && showChatSidebar) {
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
    } catch (error) {
      this.log.error('Error updating active tab', error)
      this.item.set(null)
    } finally {
      this.loading.set(false)
    }
  }

  debounceUpdateItem = useDebounce(() => this.updateItem(), 500)

  async getResourceIds(prompt?: string) {
    this.log.debug('Getting resource ids for active tab')
    const item = get(this.item)
    if (item) {
      this.log.debug('Found item for active tab, getting resources', item)
      return item.getResourceIds(prompt)
    } else if (this.loadingValue) {
      this.log.debug('Active tab is still loading, waiting for it to finish')
      return new Promise<string[]>((resolve) => {
        this.loadingUnsub = this.loading.subscribe(async (loading) => {
          this.log.debug('Active tab loading state changed', loading)
          if (!loading) {
            const item = get(this.item)
            if (item) {
              this.log.debug('Active tab finished loading, getting resources', item)
              await wait(50)
              const ids = await item.getResourceIds(prompt)
              resolve(ids)
            } else {
              this.log.debug('Active tab finished loading, but no item found')
              resolve([])
            }

            if (this.loadingUnsub) {
              this.loadingUnsub()
            }
          }
        })
      })
    } else {
      this.log.debug('No item found for active tab')
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

  onDestroy(): void {
    this.log.debug('Destroying active tab context item')
    this.activeTabUnsub()
  }
}
