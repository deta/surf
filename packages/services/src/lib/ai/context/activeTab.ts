import { tick } from 'svelte'
import { type Writable, type Readable, writable, derived, get } from 'svelte/store'

import type { TabItem } from '../../tabs'

import { ContextItemBase } from './base'
import { ContextItemNotebook, type ContextService } from '../contextManager'
import { ContextItemResource } from './resource'
import { ContextItemSpace } from './space'
import { ContextItemTypes, ContextItemIconTypes, type ContextItemIcon } from './types'
import { useDebounce, wait } from '@deta/utils'
import { ViewType } from '../../views'

export class ContextItemActiveTab extends ContextItemBase {
  type = ContextItemTypes.ACTIVE_TAB

  loadingUnsub: (() => void) | null = null

  currentTab: Writable<TabItem | null>
  item: Writable<ContextItemResource | ContextItemSpace | null>

  currentTabUrl: Writable<string | null>

  activeTabUnsub: () => void

  constructor(service: ContextService) {
    super(service, ContextItemTypes.ACTIVE_TAB, 'sparkles')

    this.item = writable(null)
    this.currentTab = writable(null)
    this.currentTabUrl = writable(null)

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

    this.iconString = derived([this.icon], ([icon]) => {
      return this.contextItemIconToString(icon, this.fallbackIcon)
    })

    this.activeTabUnsub = this.service.tabsManager.activeTabStore.subscribe((activeTab) => {
      this.log.debug(
        'Active tab changed',
        activeTab?.id,
        activeTab?.view.urlValue,
        this.currentTabValue?.view.urlValue
      )

      if (!activeTab) {
        this.log.debug('No active tab, clearing item')
        this.item.set(null)
        this.currentTab.set(null)
        this.currentTabUrl.set(null)
        return
      }

      if (this.compareTabs(activeTab)) {
        this.log.debug('Active tab is the same as current tab, not updating item')
        return
      }

      const viewManager = this.service.defaultContextManager?.viewManager
      if (
        viewManager &&
        viewManager.sidebarViewOpen &&
        viewManager.activeSidebarView &&
        [ViewType.NotebookHome, ViewType.Notebook, ViewType.Resource].includes(
          viewManager.activeSidebarView.typeValue
        )
      ) {
        this.loading.set(true)
        this.currentTabUrl.set(activeTab.view.urlValue)
        this.debounceUpdateItem()
      } else {
        this.log.debug('Sidebar is not open to a notebook or resource, skipping update')
        this.item.set(null)
      }
    })
  }

  get itemValue() {
    return get(this.item)
  }

  get currentTabValue() {
    return get(this.currentTab)
  }

  get currentTabUrlValue() {
    return get(this.currentTabUrl)
  }

  compareTabs(tab1: TabItem) {
    if (tab1.id !== this.currentTabValue?.id) {
      return false
    }

    return tab1.view.urlValue === (this.currentTabUrlValue ?? this.currentTabValue?.view.urlValue)
  }

  async updateItem() {
    try {
      this.loading.set(true)

      const tab = this.service.tabsManager.activeTabValue
      if (!tab) {
        this.item.set(null)
        return null
      }

      const existingItem = this.itemValue
      const existingTab = this.currentTabValue

      this.currentTab.set(tab)

      this.log.debug('Updating active tab', tab)

      await tick()

      if (tab.view.typeValue === ViewType.Page) {
        this.log.debug('Preparing page tab', tab)
        const resource = await this.service.preparePageTab(tab)
        if (!resource) {
          this.log.error('Failed to prepare page tab', tab.id)
          this.item.set(null)
          return null
        }

        this.log.debug('Prepared page tab', tab.id, resource)

        const newItem = new ContextItemResource(this.service, resource, tab)
        this.item.set(newItem)

        return newItem
      } else if (tab.view.typeValue === ViewType.Resource) {
        this.log.debug('Preparing resource tab', tab)
        const resourceId = tab.view.typeDataValue.id
        if (!resourceId) {
          this.log.error('Resource tab has no resource id', tab.id)
          this.item.set(null)
          return null
        }

        const resource = await this.service.resourceManager.getResource(resourceId)
        if (!resource) {
          this.log.error('Failed to load resource for resource tab', tab.id, resourceId)
          this.item.set(null)
          return null
        }

        this.log.debug('Prepared resource tab', tab.id, resource)
        const newItem = new ContextItemResource(this.service, resource, tab)
        this.item.set(newItem)

        return newItem
      } else if (tab.view.typeValue === ViewType.Notebook) {
        this.log.debug('Preparing notebook tab', tab)
        const notebookId = tab.view.typeDataValue.id
        if (!notebookId) {
          this.log.error('Notebook tab has no notebook id', tab.id)
          this.item.set(null)
          return null
        }

        const notebook = await this.service.notebookManager.getNotebook(notebookId)
        if (!notebook) {
          this.log.error('Failed to load notebook for notebook tab', tab.id, notebookId)
          this.item.set(null)
          return null
        }

        this.log.debug('Prepared notebook tab', tab.id, notebook)
        const newItem = new ContextItemNotebook(this.service, notebook, tab)
        this.item.set(newItem)

        return newItem
      } else {
        this.item.set(null)
        return null
      }
    } catch (error) {
      this.log.error('Error updating active tab', error)
      this.item.set(null)
      return null
    } finally {
      this.loading.set(false)
    }
  }

  debounceUpdateItem = useDebounce(() => this.updateItem(), 250)

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
      const tab = this.service.tabsManager.activeTabValue
      if (!tab) {
        this.log.debug('No item found for active tab')
        return []
      }

      const item = await this.updateItem()
      if (!item) {
        this.log.debug('No item found for active tab')
        return []
      }

      this.log.debug('Got item for active tab after update, getting resources', item)
      return item.getResourceIds(prompt)
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

  onDestroy(): void {
    this.log.debug('Destroying active tab context item')
    this.activeTabUnsub()
  }
}
