import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { getFileType, useLocalStorageStore, useLogScope } from '@horizon/utils'
import {
  ActivateTabEventTrigger,
  CreateTabEventTrigger,
  ResourceTagsBuiltInKeys,
  ResourceTypes,
  type DeleteTabEventTrigger
} from '@horizon/types'
import EventEmitter from 'events'
import type TypedEmitter from 'typed-emitter'

import type {
  CreateTabOptions,
  Optional,
  PageMagic,
  Space,
  SpaceData,
  Tab,
  TabImporter,
  TabPage,
  TabResource,
  TabSpace
} from '../types'
import { HorizonDatabase, HorizonStore } from './storage'
import type { HistoryEntriesManager } from './history'

import type BrowserTab from '../components/Browser/BrowserTab.svelte'
import type { Telemetry } from './telemetry'
import { getContext, setContext, tick } from 'svelte'
import { spawnBoxSmoke } from '../components/Effects/SmokeParticle.svelte'
import type { Resource, ResourceManager } from './resources'

export type TabEvents = {
  created: (tab: Tab, active: boolean) => void
  deleted: (tab: Tab) => void
  updated: (tab: Tab) => void
  selected: (tab: Tab) => void
  'url-changed': (tab: Tab, newUrl: string) => void
}

export const TABS_CONTEXT_KEY = 'tabs-manager'

export const PAGE_TABS_RESOURCE_TYPES = [
  ResourceTypes.LINK,
  ResourceTypes.ARTICLE,
  ResourceTypes.DOCUMENT,
  ResourceTypes.POST
]

class ClosedTabs {
  private MAX_CLOSED_TABS = 96
  private closedTabs: Tab[] = []

  push(tab: Tab) {
    this.closedTabs.unshift(tab)
    if (this.closedTabs.length > this.MAX_CLOSED_TABS) this.closedTabs.pop()
  }

  pop(): Tab | undefined {
    return this.closedTabs.shift()
  }

  get tabs() {
    return this.closedTabs
  }
}

export class TabsManager {
  private log: ReturnType<typeof useLogScope>
  private db: HorizonStore<Tab>
  private resourceManager: ResourceManager
  private historyEntriesManager: HistoryEntriesManager
  private telemetry: Telemetry
  private eventEmitter: TypedEmitter<TabEvents>
  private closedTabs: ClosedTabs

  tabs: Writable<Tab[]>
  activeTabId: Writable<string>
  activatedTabs: Writable<string[]>
  showNewTabOverlay: Writable<number>
  browserTabs: Writable<Record<string, BrowserTab>>
  activeTabsHistory: Writable<string[]>
  activeTabMagic: Writable<PageMagic>
  selectedTabs: Writable<Set<{ id: string; userSelected: boolean }>>
  lastSelectedTabId: Writable<string | null>

  activeTab: Readable<Tab | undefined>
  activeBrowserTab: Readable<BrowserTab | undefined>
  activeTabLocation: Readable<string | null>
  activeTabs: Readable<Tab[]>
  pinnedTabs: Readable<Tab[]>
  unpinnedTabs: Readable<Tab[]>
  magicTabs: Readable<(TabPage | TabSpace | TabResource)[]>

  constructor(
    resourceManager: ResourceManager,
    historyEntriesManager: HistoryEntriesManager,
    telemetry: Telemetry
  ) {
    const storage = new HorizonDatabase()
    this.db = storage.tabs
    this.resourceManager = resourceManager
    this.historyEntriesManager = historyEntriesManager
    this.telemetry = telemetry
    this.log = useLogScope('TabsService')
    this.eventEmitter = new EventEmitter() as TypedEmitter<TabEvents>
    this.closedTabs = new ClosedTabs()

    this.tabs = writable<Tab[]>([])
    this.activeTabId = useLocalStorageStore<string>('activeTabId', '')
    this.activatedTabs = writable<string[]>([]) // for lazy loading
    this.showNewTabOverlay = writable<number>(0)
    this.browserTabs = writable<Record<string, BrowserTab>>({})
    this.selectedTabs = writable(new Set())
    this.lastSelectedTabId = writable(null)
    this.activeTabsHistory = writable<string[]>([])
    this.activeTabMagic = writable<PageMagic>({
      running: false,
      showSidebar: false,
      initializing: false,
      responses: [],
      errors: []
    })

    this.activeTab = derived([this.tabs, this.activeTabId], ([tabs, activeTabId]) => {
      return tabs.find((tab) => tab.id === activeTabId)
    })

    this.activeBrowserTab = derived([this.tabs, this.activeTabId], ([tabs, activeTabId]) => {
      return this.browserTabsValue[activeTabId]
    })

    this.activeTabLocation = derived(this.activeTab, (activeTab) => {
      if (activeTab?.type === 'page') {
        if (activeTab.currentLocation) {
          return activeTab.currentLocation
        }

        const currentEntry = this.historyEntriesManager.getEntry(
          activeTab.historyStackIds[activeTab.currentHistoryIndex]
        )

        return currentEntry?.url ?? null
      }

      return null
    })

    this.activeTabs = derived([this.tabs], ([tabs]) => {
      const uniqueTabs = new Map<string, Tab>()
      tabs.forEach((tab) => {
        if (!tab.archived && !uniqueTabs.has(tab.id)) {
          uniqueTabs.set(tab.id, tab)
        }
      })
      return Array.from(uniqueTabs.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    })

    this.pinnedTabs = derived([this.activeTabs], ([tabs]) => {
      return tabs.filter((tab) => tab.pinned).sort((a, b) => a.index - b.index)
    })

    this.unpinnedTabs = derived([this.activeTabs], ([tabs]) => {
      return tabs.filter((tab) => !tab.pinned).sort((a, b) => a.index - b.index)
    })

    this.magicTabs = derived([this.activeTabs], ([tabs]) => {
      return tabs.filter((tab) => tab.magic).sort((a, b) => a.index - b.index) as (
        | TabPage
        | TabSpace
        | TabResource
      )[]
    })

    const isDev = import.meta.env.DEV
    if (isDev) {
      // @ts-ignore
      window.tabsManager = this
    }
  }

  get tabsValue() {
    return get(this.tabs)
  }

  get browserTabsValue() {
    return get(this.browserTabs)
  }

  get activeTabMagicValue() {
    return get(this.activeTabMagic)
  }

  get activeTabIdValue() {
    return get(this.activeTabId)
  }

  get activeTabValue() {
    return get(this.activeTab)
  }

  get activeTabsValue() {
    return get(this.activeTabs)
  }

  get pinnedTabsValue() {
    return get(this.pinnedTabs)
  }

  get unpinnedTabsValue() {
    return get(this.unpinnedTabs)
  }

  get magicTabsValue() {
    return get(this.magicTabs)
  }

  get activeTabsHistoryValue() {
    return get(this.activeTabsHistory)
  }

  get showNewTabOverlayValue() {
    return get(this.showNewTabOverlay)
  }

  get selectedTabsValue() {
    return get(this.selectedTabs)
  }

  private addToActiveTabsHistory(tabId: string) {
    this.activeTabsHistory.update((history) => {
      if (history[history.length - 1] !== tabId) {
        // remove tab from history if it already exists and add it to the end
        return [...history.filter((id) => id !== tabId), tabId]
      }

      return history
    })
  }

  private async persistChanges(tabId: string, updates: Partial<Tab>) {
    await this.db.update(tabId, updates)
  }

  async bulkPersistChanges(items: { id: string; updates: Partial<Tab> }[]) {
    await this.db.bulkUpdate(items)
  }

  on<E extends keyof TabEvents>(event: E, listener: TabEvents[E]): () => void {
    this.eventEmitter.on(event, listener)

    return () => {
      this.eventEmitter.off(event, listener)
    }
  }

  emit<E extends keyof TabEvents>(event: E, ...args: Parameters<TabEvents[E]>) {
    this.eventEmitter.emit(event, ...args)
  }

  async create<T extends Tab>(
    tab: Optional<T, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'pinned' | 'index' | 'magic'>,
    opts?: CreateTabOptions
  ) {
    const defaultOpts = {
      placeAtEnd: true,
      active: false
    }

    const { placeAtEnd, active } = Object.assign(defaultOpts, opts)

    const activeTabIndex =
      this.unpinnedTabsValue.find((tab) => tab.id === this.activeTabIdValue)?.index ??
      this.unpinnedTabsValue.length - 1
    const nextTabIndex = this.unpinnedTabsValue[activeTabIndex + 1]?.index ?? -1

    // generate index in between active and next tab so that the new tab is placed in between
    const TAB_INDEX_OFFSET = 0.1
    const nextIndex =
      nextTabIndex > 0 ? nextTabIndex - TAB_INDEX_OFFSET : activeTabIndex + TAB_INDEX_OFFSET

    const newIndex = opts?.index ?? (placeAtEnd ? Date.now() : nextIndex)

    this.log.debug('Creating tab', tab, 'at index', newIndex, this.unpinnedTabs)

    const newTab = await this.db.create({
      archived: false,
      pinned: false,
      magic: false,
      index: newIndex,
      ...tab
    })

    this.log.debug('Created tab', newTab)
    this.activatedTabs.update((tabs) => [...tabs, newTab.id])
    this.tabs.update((tabs) => [...tabs, newTab])

    if (active) {
      // remove the selection from the currently active tab if it was not selected manually by the user
      this.selectedTabs.update((selectedTabs) => {
        const tab = Array.from(selectedTabs).find((t) => t.id === this.activeTabIdValue)
        if (tab && !tab.userSelected) {
          return new Set(Array.from(selectedTabs).filter((t) => t.id !== this.activeTabIdValue))
        }

        return selectedTabs
      })

      this.makeActive(newTab.id)
    }

    this.emit('created', newTab, active)

    return newTab
  }

  async delete(tabId: string, trigger?: DeleteTabEventTrigger) {
    const rect = document.getElementById(`tab-${tabId}`)?.getBoundingClientRect()
    if (rect) {
      spawnBoxSmoke(rect, {
        densityN: 28,
        size: 13,
        //velocityScale: 0.5,
        cloudPointN: 7
      })
    }

    const tab = this.tabsValue.find((tab) => tab.id === tabId)
    if (!tab) {
      this.log.error('Tab not found', tabId)
      return
    }

    const tabsInOrder = [...this.pinnedTabsValue, ...this.unpinnedTabsValue]
    const currentIndex = tabsInOrder.findIndex((tab) => tab.id === tabId)

    this.tabs.update((tabs) =>
      tabs.filter((tab) => {
        const bool = tab.id === tabId
        if (bool) this.closedTabs.push(tab)
        return !bool
      })
    )

    this.activatedTabs.update((tabs) => tabs.filter((id) => id !== tabId))

    await tick()
    if (this.activeTabIdValue === tabId) {
      const updatedTabsInOrder = tabsInOrder.filter((tab) => tab.id !== tabId)
      if (updatedTabsInOrder.length > 0) {
        const newActiveTab =
          updatedTabsInOrder[Math.min(currentIndex, updatedTabsInOrder.length - 1)]
        this.makeActive(newActiveTab.id)
      }
    }

    await this.db.delete(tabId)

    this.emit('deleted', tab)

    if (trigger) {
      if (tab.type === 'page') {
        await this.telemetry.trackDeletePageTab(trigger)
      } else if (tab.type === 'space') {
        await this.telemetry.trackDeleteSpaceTab(trigger)
      }
    }
  }

  async update(tabId: string, updates: Partial<Tab>) {
    this.log.debug('Updating tab', tabId, updates)
    this.tabs.update((tabs) => {
      const updatedTabs = tabs.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            ...updates
          } as Tab
        }

        return tab
      })

      return updatedTabs
    })

    await this.persistChanges(tabId, updates)

    this.emit('updated', this.tabsValue.find((tab) => tab.id === tabId)!)
  }

  async updateActive(updates: Partial<Tab>) {
    if (!this.activeTabValue) {
      this.log.error('No active tab')
      return
    }

    await this.update(this.activeTabValue.id, updates)
  }

  async deleteActive(trigger?: DeleteTabEventTrigger) {
    if (!this.activeTabValue) {
      this.log.error('No active tab')
      return
    }
    if (this.showNewTabOverlayValue !== 0) {
      this.showNewTabOverlay.set(0)
      return
    }

    const activeTab = this.activeTabValue
    if (activeTab.pinned) {
      this.log.debug('Active tab is pinned, deactivating it')
      const tabsInOrder = [...this.pinnedTabsValue, ...this.unpinnedTabsValue]
      const currentIndex = tabsInOrder.findIndex((tab) => tab.id === activeTab.id)
      this.activatedTabs.update((tabs) => tabs.filter((id) => id !== activeTab.id))

      const nextTabIndex = currentIndex + 1
      if (nextTabIndex < tabsInOrder.length) {
        this.makeActive(tabsInOrder[nextTabIndex].id)
      } else if (tabsInOrder.length > 1) {
        this.makeActive(tabsInOrder[tabsInOrder.length - 2].id)
      }
    } else {
      await this.delete(activeTab.id, trigger)
    }
  }

  async makeActive(tabId: string, trigger?: ActivateTabEventTrigger) {
    this.log.debug('Making tab active', tabId)
    const tab = this.tabsValue.find((tab) => tab.id === tabId)
    if (!tab) {
      this.log.error('Tab not found', tabId)
      return
    }

    this.showNewTabOverlay.set(0)

    const browserTab = this.browserTabsValue[tabId]

    const activeElement = document.activeElement
    if (activeElement && typeof (activeElement as any).blur === 'function') {
      ;(activeElement as any).blur()
    }

    if (browserTab) {
      if (typeof browserTab.focus === 'function') {
        browserTab.focus()
      }
    }

    this.activatedTabs.update((tabs) => {
      if (tabs.includes(tabId)) {
        return tabs
      }

      return [...tabs, tabId]
    })

    this.activeTabId.set(tabId)
    this.addToActiveTabsHistory(tabId)

    // TODO: make this work again
    // if ($showAppSidebar) {
    //   setAppSidebarState(true)
    // } else {
    //   setAppSidebarState(false)
    // }

    // TODO: find a better way to scroll to the active tab without accessing the DOM directly
    setTimeout(() => {
      const activeTabElement = document.getElementById(`tab-${tabId}`)
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'end'
        })
      }
    }, 0)

    this.emit('selected', tab)

    if (trigger) {
      this.telemetry.trackActivateTab(trigger, tab.type)

      if (tab.type === 'space') {
        this.telemetry.trackActivateTabSpace(trigger)
      }
    }
  }

  makePreviousActive(currentIndex?: number) {
    if (this.activeTabsValue.length === 0) {
      this.log.debug('No tabs in view')
      return
    }

    const previousTab = this.activeTabsHistoryValue[this.activeTabsHistoryValue.length - 1]
    const nextTabIndex = currentIndex
      ? currentIndex + 1
      : this.activeTabsValue.findIndex((tab) => tab.id === this.activeTabIdValue)

    this.log.debug(
      'xx Previous tab',
      previousTab,
      'Next tab index',
      nextTabIndex,
      this.activeTabsHistoryValue
    )

    if (previousTab) {
      this.makeActive(previousTab)
    } else if (nextTabIndex >= this.activeTabsValue.length && this.activeTabsValue[0]) {
      this.makeActive(this.activeTabsValue[0].id)
    } else if (this.activeTabsValue[nextTabIndex]) {
      this.makeActive(this.activeTabsValue[nextTabIndex].id)
    } else {
      // go to last tab
      if (this.unpinnedTabsValue.length > 0) {
        this.makeActive(this.unpinnedTabsValue[this.unpinnedTabsValue.length - 1].id)
      }
    }
  }

  async reopenDeleted() {
    const tab = this.closedTabs.pop()
    if (tab) {
      this.log.debug('Opening previously closed tab')
      await this.create(tab, { active: true })
    }
  }

  // Note: the browser component uses this inside a debounced function
  cycle(previous: boolean) {
    if (this.tabsValue.length === 0) {
      this.log.debug('No tabs in view')
      return
    }
    let ordered = [
      ...this.unpinnedTabsValue.sort((a, b) => a.index - b.index),
      ...this.pinnedTabsValue.sort((a, b) => a.index - b.index)
    ].filter((tab) => !tab.archived)

    const activeTabIndex = ordered.findIndex((tab) => tab.id === this.activeTabIdValue)
    if (!previous) {
      const nextTabIndex = activeTabIndex + 1
      if (nextTabIndex >= ordered.length) {
        this.makeActive(ordered[0].id, ActivateTabEventTrigger.Shortcut)
      } else {
        this.makeActive(ordered[nextTabIndex].id, ActivateTabEventTrigger.Shortcut)
      }
    } else {
      const previousTabIndex = activeTabIndex - 1
      if (previousTabIndex < 0) {
        this.makeActive(ordered[ordered.length - 1].id, ActivateTabEventTrigger.Shortcut)
      } else {
        this.makeActive(ordered[previousTabIndex].id, ActivateTabEventTrigger.Shortcut)
      }
    }
  }

  showNewTab() {
    this.showNewTabOverlay.set(1)
  }

  async addPageTab(url: string, opts?: CreateTabOptions, tabData?: Partial<TabPage>) {
    this.log.debug('Creating new page tab')

    if (!url) {
      this.showNewTab()
      return null
    }

    const newTab = await this.create<TabPage>(
      {
        title: url,
        icon: '',
        type: 'page',
        initialLocation: url,
        historyStackIds: [],
        currentHistoryIndex: -1,
        ...tabData
      },
      opts
    )

    await this.telemetry.trackCreateTab(
      opts?.trigger ?? CreateTabEventTrigger.Other,
      opts?.active ?? false,
      'page'
    )

    return newTab as TabPage
  }

  async addSpaceTab(space: Space, opts?: Omit<CreateTabOptions, 'trigger'>) {
    this.log.debug('Creating new space tab')
    const newTab = await this.create<TabSpace>(
      {
        title: space.name.folderName,
        icon: '',
        spaceId: space.id,
        type: 'space',
        colors: space.name.colors
      },
      opts
    )

    return newTab
  }

  async addResourceTab(resource: Resource, opts?: CreateTabOptions) {
    this.log.debug('Creating new resource tab')

    const newTab = await this.create<TabResource>(
      {
        title: resource?.metadata?.name ?? getFileType(resource.type) ?? 'Untitled',
        icon: '',
        type: 'resource',
        resourceId: resource.id,
        resourceType: resource.type
      },
      opts
    )

    await this.telemetry.trackCreateTab(
      opts?.trigger ?? CreateTabEventTrigger.Other,
      opts?.active ?? false,
      'resource'
    )

    return newTab
  }

  async openResourceAsTab(resourceOrId: Resource | string, opts?: CreateTabOptions) {
    const resource =
      typeof resourceOrId === 'string'
        ? await this.resourceManager.getResource(resourceOrId)
        : resourceOrId
    if (!resource) {
      throw new Error('Resource not found: ' + resourceOrId)
    }

    // If the resource is a page type, and has a canonical URL, add a page tab as we can render it using a webview
    const canonicalUrl =
      resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
      resource.metadata?.sourceURI
    if (PAGE_TABS_RESOURCE_TYPES.some((x) => resource.type.startsWith(x)) && canonicalUrl) {
      return this.addPageTab(canonicalUrl, opts)
    }

    return this.addResourceTab(resource, opts)
  }

  async addImporterTab() {
    this.log.debug('Creating new importer tab')
    const newTab = await this.create<TabImporter>(
      {
        title: 'Importer',
        icon: '',
        type: 'importer',
        index: 0,
        pinned: false,
        magic: false
      },
      { active: true }
    )

    return newTab
  }

  async removeResourceBookmarks(resourceId: string) {
    this.log.debug('Removing bookmarks for resource', resourceId)

    const tabsToUpdate = this.tabsValue.filter(
      (tab) => tab.type === 'page' && tab.resourceBookmark === resourceId
    )
    if (tabsToUpdate.length > 0) {
      this.log.debug('Removing bookmarks', tabsToUpdate)
      for (const tab of tabsToUpdate) {
        await this.update(tab.id, {
          resourceBookmark: null,
          chatResourceBookmark: null,
          resourceBookmarkedManually: false
        })
      }
    }

    // remove resource tabs of the same resource
    const tabsToDelete = this.tabsValue.filter(
      (tab) => tab.type === 'resource' && tab.resourceId === resourceId
    )
    if (tabsToDelete.length > 0) {
      this.log.debug('Removing resource tabs', tabsToDelete)
      for (const tab of tabsToDelete) {
        await this.delete(tab.id)
      }
    }

    return {
      updated: tabsToUpdate.length,
      deleted: tabsToDelete.length
    }
  }

  async removeSpaceTabs(spaceId: string) {
    this.log.debug('Removing space tabs for space', spaceId)

    const tabsToDelete = this.tabsValue.filter(
      (tab) => tab.type === 'space' && tab.spaceId === spaceId
    )
    if (tabsToDelete.length > 0) {
      this.log.debug('Removing space tabs', tabsToDelete)
      for (const tab of tabsToDelete) {
        await this.delete(tab.id)
      }
    }

    return tabsToDelete.length
  }

  async updateSpaceTabs(spaceId: string, updates: Partial<SpaceData>) {
    this.log.debug('Updating space tabs for space', spaceId, updates)

    const tabUpdates = {} as Partial<TabSpace>

    if (updates.folderName) {
      tabUpdates.title = updates.folderName
    }

    if (updates.colors) {
      tabUpdates.colors = updates.colors
    }

    const tabsToUpdate = this.tabsValue.filter(
      (tab) => tab.type === 'space' && tab.spaceId === spaceId
    )

    if (tabsToUpdate.length > 0) {
      this.log.debug('Updating space tabs', tabsToUpdate)
      for (const tab of tabsToUpdate) {
        await this.update(tab.id, tabUpdates)
      }
    }
  }

  static provide(
    resourceManager: ResourceManager,
    historyEntriesManager: HistoryEntriesManager,
    telemetry: Telemetry
  ) {
    const tabsService = new TabsManager(resourceManager, historyEntriesManager, telemetry)
    setContext(TABS_CONTEXT_KEY, tabsService)
    return tabsService
  }

  static use() {
    return getContext<TabsManager>(TABS_CONTEXT_KEY)
  }
}

export const createTabsManager = TabsManager.provide
export const useTabsManager = TabsManager.use
