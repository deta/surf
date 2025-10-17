import {
  EventEmitterBase,
  getHostname,
  isDev,
  parseUrlIntoCanonical,
  type ScopedLogger,
  useDebounce,
  useLogScope
} from '@deta/utils'
import { KVStore, useKVTable } from '../kv'
import { type Fn } from '@deta/types'
import { useViewManager, WebContentsView, ViewManager } from '../views'
import { derived, get, writable, type Readable } from 'svelte/store'
import { ViewManagerEmitterNames, ViewType, WebContentsViewEmitterNames } from '../views/types'
import { spawnBoxSmoke } from '@deta/ui'
import {
  type TabItemEmitterEvents,
  type KVTabItem,
  TabItemEmitterNames,
  type CreateTabOptions,
  TabsServiceEmitterNames,
  type TabsServiceEmitterEvents
} from './tabs.types'
import { ResourceManager, useResourceManager } from '../resources'
import { tick } from 'svelte'

/**
 * Represents a single tab in the browser window. Each TabItem is associated with a WebContentsView
 * that displays the actual web content. TabItem manages the lifecycle and state of a browser tab,
 * including its title, view data, and position in the tab strip.
 */
export class TabItem extends EventEmitterBase<TabItemEmitterEvents> {
  manager: TabsService
  private log: ScopedLogger

  id: string
  index: number
  title: Readable<string>
  createdAt: Date
  updatedAt: Date
  view: WebContentsView
  pinned = $state<boolean>(false)

  stateIndicator = $state<'none' | 'success'>('none')

  private unsubs: Fn[] = []

  constructor(manager: TabsService, view: WebContentsView, data: KVTabItem) {
    super()
    this.log = useLogScope('TabItem')
    this.manager = manager

    this.id = data.id
    this.index = data.index
    this.createdAt = new Date(data.createdAt)
    this.updatedAt = new Date(data.updatedAt)
    this.view = view
    this.pinned = data.pinned ?? false

    this.title = derived(this.view.title, (title) => title)

    this.unsubs.push(
      view.on(WebContentsViewEmitterNames.DATA_CHANGED, (data) => {
        this.debouncedUpdate({
          title: data.title,
          view: data
        })
      })
    )
  }

  get titleValue() {
    return get(this.title)
  }

  get dataValue(): KVTabItem {
    return {
      id: this.id,
      index: this.index,
      title: this.view.titleValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      view: this.view.dataValue,
      pinned: this.pinned
    }
  }

  async update(data: Partial<KVTabItem>) {
    this.id = data.id ?? this.id
    this.index = data.index ?? this.index
    this.createdAt = data.createdAt ? new Date(data.createdAt) : this.createdAt
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : this.updatedAt
    this.pinned = data.pinned ?? this.pinned

    this.log.debug(`Updating tab ${this.id} with data:`, data)

    this.manager.update(this.id, this.dataValue)

    this.emit(TabItemEmitterNames.UPDATE, this)
  }

  debouncedUpdate = useDebounce((data: Partial<KVTabItem>) => {
    this.log.debug(`Debounced update for tab ${this.id}:`, data)
    this.update(data)
  }, 200)

  copyURL() {
    this.view.copyURL()

    let currState = this.stateIndicator
    this.stateIndicator = 'success'
    setTimeout(() => {
      this.stateIndicator = currState
    }, 2000)
  }

  pin() {
    this.manager.pinTab(this.id)
  }

  unpin() {
    this.manager.unpinTab(this.id)
  }

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())

    this.emit(TabItemEmitterNames.DESTROY, this.id)
  }
}

class ClosedTabs {
  private MAX_CLOSED_TABS = 96
  private closedTabs: KVTabItem[] = []

  push(tab: KVTabItem) {
    this.closedTabs.unshift(tab)
    if (this.closedTabs.length > this.MAX_CLOSED_TABS) this.closedTabs.pop()
  }

  pop(): KVTabItem | undefined {
    return this.closedTabs.shift()
  }

  get tabs() {
    return this.closedTabs
  }
}

/**
 * Central service for managing browser tabs. Handles tab creation, deletion, activation, and persistence.
 * This service maintains the state of all tabs, manages their order, and coordinates with the ViewManager
 * to handle the actual web content views associated with each tab.
 *
 * Features:
 * - Tab lifecycle management (create, delete, update)
 * - Tab state persistence using KV store
 * - Tab activation and focus handling
 * - History tracking for each tab
 */
export class TabsService extends EventEmitterBase<TabsServiceEmitterEvents> {
  private log: ScopedLogger
  private viewManager: ViewManager
  private resourceManager: ResourceManager
  private kv: KVStore<KVTabItem>
  private closedTabs: ClosedTabs

  private _lastTabIndex = -1
  private unsubs: Fn[] = []
  private newTabView: WebContentsView | null = null

  ready: Promise<void>

  tabs = $state<TabItem[]>([])
  activeTabId = $state<string | null>(null)
  activatedTabs = $state<string[]>([])

  activeTab: TabItem | null

  /**
   * Legacy store to make the contextManager work
   * @deprecated Use activeTab instead
   */
  activeTabStore = writable<TabItem | null>(null)

  static self: TabsService

  get tabsValue(): TabItem[] {
    return this.tabs
  }

  get activeTabIdValue(): string | null {
    return this.activeTabId
  }

  get activeTabValue(): TabItem | null {
    return this.activeTab
  }

  get activatedTabsValue(): string[] {
    return this.activatedTabs
  }

  get activeTabIndex(): number {
    return this.tabs.findIndex((e) => e.id === this.activeTabId)
  }

  constructor(viewManager?: ViewManager) {
    super()

    this.log = useLogScope('TabsService')
    this.viewManager = viewManager ?? useViewManager()
    this.resourceManager = useResourceManager()
    this.kv = useKVTable<KVTabItem>('tabs')
    this.closedTabs = new ClosedTabs()

    this.ready = this.kv.ready

    this.activeTab = $derived.by(() => {
      const activeId = this.activeTabId
      if (!activeId) {
        this.activeTabStore.set(null)
        return null
      }

      const tab = this.tabs.find((t) => t.id === activeId)
      if (!tab) {
        this.log.warn(`Active tab with id "${activeId}" not found`)
        this.activeTabStore.set(null)
        return null
      }

      this.log.debug('Active tab is now', tab.id)
      this.activeTabStore.set(tab)
      return tab
    })

    this.init()

    $inspect(this.tabs)
    $inspect(this.activeTab)

    if (isDev) {
      // @ts-ignore
      window.tabs = this
    }
  }

  private async init() {
    const initialTabs = await this.list()
    this.log.debug('Initializing TabsService with tabs:', initialTabs)
    this.tabs = initialTabs

    if (initialTabs.length > 0) {
      this.setActiveTab(initialTabs[initialTabs.length - 1].id)
    } else {
      this.activeTabId = null
    }

    this.prepareNewTabPage()
  }

  private async prepareNewTabPage() {
    try {
      this.log.debug('Preparing new tab page')
      this.newTabView = await this.viewManager.create({ url: 'surf://surf/notebook' }, true)
      await this.newTabView.preloadWebContents({ activate: false })
    } catch (error) {
      this.log.error('Error preparing new tab page:', error)
    }
  }

  private async getLastTabIndex(): Promise<number> {
    if (this._lastTabIndex >= 0) {
      return this._lastTabIndex
    }

    const items = await this.kv.all()
    if (items.length === 0) {
      this._lastTabIndex = 0
      return this._lastTabIndex
    }

    this._lastTabIndex = Math.max(...items.map((item) => item.index))
    return this._lastTabIndex
  }

  private itemToTabItem(item: KVTabItem): TabItem | null {
    const view = this.viewManager.create(item.view)
    if (!view) {
      this.log.warn(`View for tab with id "${item.id}" not found`)
      return null
    }

    return new TabItem(this, view, item)
  }

  async list(): Promise<TabItem[]> {
    this.log.trace('Listing all tabs')

    const raw = await this.kv.all()
    if (raw.length === 0) {
      this.log.debug('No tabs found')
      return []
    }

    const tabs = raw
      .map((item) => this.itemToTabItem(item))
      .filter((item) => item !== null)
      .sort((a, b) => a.index - b.index) as TabItem[]

    return tabs
  }

  /**
   * Creates a new browser tab with the specified URL.
   * This method will:
   * 1. Create a new WebContentsView for the URL
   * 2. Generate a unique tab ID and index
   * 3. Persist the tab data to storage
   * 4. Activate the tab if specified in options
   *
   * @param url The URL to load in the new tab
   * @param opts Options for tab creation, such as whether to activate it immediately
   */
  async create(url: string, opts: Partial<CreateTabOptions> = {}): Promise<TabItem> {
    const options = {
      active: true,
      activate: false,
      ...opts
    } as CreateTabOptions

    if (url === 'surf-internal://core/Core/core.html') {
      this.log.warn('Attempted to open core URL directly, which is not allowed.')
      throw new Error('Cannot open core URL directly')
    }

    const view = await this.viewManager.create({ url })

    if (options.selectionHighlight) {
      view.highlightSelection(options.selectionHighlight)
    }

    this.log.debug('Creating new tab with view:', view, 'options:', options)

    // Smart positioning: if active tab is pinned, place new tab at the end
    let newIndex: number
    const activeTab = this.activeTab
    if (activeTab && activeTab.pinned) {
      // Place at the end of all tabs
      newIndex = this.tabs.length
    } else {
      newIndex = this.activeTabIndex + 1 || (await this.getLastTabIndex()) + 1
    }

    const hostname = getHostname(url) || 'unknown'

    const item = await this.kv.create({
      title: hostname,
      view: view.dataValue,
      index: newIndex
    })

    const tab = new TabItem(this, view, item)
    this.tabs.splice(newIndex, 0, tab)

    if (options.active) {
      this.setActiveTab(item.id)
    } else if (options.activate) {
      this.activateTab(item.id)
    }

    this.emit(TabsServiceEmitterNames.CREATED, tab)

    return tab
  }

  async createWithView(
    view: WebContentsView,
    opts: Partial<CreateTabOptions> = {}
  ): Promise<TabItem> {
    const options = {
      active: true,
      activate: false,
      ...opts
    } as CreateTabOptions

    if (options.selectionHighlight) {
      view.highlightSelection(options.selectionHighlight)
    }

    this.log.debug('Creating new tab with view:', view, 'options:', options)

    const newIndex = (await this.getLastTabIndex()) + 1
    const hostname = getHostname(view.urlValue) || 'unknown'

    const item = await this.kv.create({
      title: hostname,
      view: view.dataValue,
      index: newIndex
    })

    const tab = new TabItem(this, view, item)
    this.tabs = [...this.tabs, tab]

    if (options.active) {
      this.setActiveTab(item.id)
    } else if (options.activate) {
      this.activateTab(item.id)
    }

    this.emit(TabsServiceEmitterNames.CREATED, tab)

    return tab
  }

  async openOrCreate(
    url: string,
    opts: Partial<CreateTabOptions> = {},
    isUserAction = false
  ): Promise<TabItem> {
    this.log.debug('Opening or creating tab for URL:', url, opts)

    const canonicalUrl = parseUrlIntoCanonical(url) ?? url
    const existingTab = this.tabs.find(
      (tab) => (parseUrlIntoCanonical(tab.view.urlValue) ?? tab.view.urlValue) === canonicalUrl
    )

    if (existingTab) {
      this.log.debug('Tab already exists, activating:', existingTab.id)

      if (opts.active) {
        await this.setActiveTab(existingTab.id, isUserAction)
      } else if (opts.activate) {
        this.activateTab(existingTab.id)
      }

      if (opts.selectionHighlight) {
        await existingTab.view.highlightSelection(opts.selectionHighlight)
      }

      return existingTab
    }

    this.log.debug('Tab does not exist, creating new one')
    return this.create(url, opts)
  }

  async get(id: string): Promise<TabItem | null> {
    try {
      this.log.debug('Getting tab with id:', id)
      const item = await this.kv.read(id)

      if (!item) {
        this.log.warn(`Tab with id "${id}" not found`)
        return null
      }

      const tabItem = this.itemToTabItem(item)
      if (!tabItem) {
        this.log.warn(`Tab with id "${id}" could not be converted to TabItem`)
        return null
      }

      return tabItem
    } catch (error) {
      this.log.error('Error getting tab:', error)
      return null
    }
  }

  async update(id: string, data: Partial<KVTabItem>) {
    try {
      this.log.debug('Updating tab with id:', id, 'data:', data)
      const item = await this.kv.update(id, data)

      this.log.debug('Tab updated:', item)

      // NOTE: we manually update the activeTabStore here as changes to the data are not tracked by the activeTabStore derived.by
      if (id === this.activeTabIdValue) {
        this.log.debug(
          'Updating activeTabStore for active tab',
          id,
          this.activeTabValue?.view.urlValue
        )
        this.activeTabStore.set(this.activeTabValue)
      }

      return !!item
    } catch (error) {
      this.log.error('Error updating tab:', error)
      return false
    }
  }

  /**
   * Closes a tab with special handling for pinned tabs.
   * If the tab is pinned, it will switch to the next available tab instead of deleting it.
   * If the tab is not pinned, it will be deleted normally.
   *
   * @param id The ID of the tab to close
   * @param userAction Whether this is a user-initiated action
   */
  async closeTab(id: string, userAction = false) {
    try {
      this.log.debug('Closing tab with id:', id)

      const tab = this.tabs.find((t) => t.id === id)
      if (!tab) {
        this.log.error('No tab found with id:', id)
        return
      }

      if (tab.pinned) {
        this.log.debug('Tab is pinned, jumping to next tab instead of closing')

        const allTabs = this.tabs
        let targetTab: TabItem | null = null

        const currentIndex = allTabs.findIndex((t) => t.id === id)
        const nextTabIndex = currentIndex + 1

        if (nextTabIndex < allTabs.length) {
          targetTab = allTabs[nextTabIndex]
        } else if (allTabs.length > 1) {
          targetTab = allTabs[allTabs.length - 2]
        }

        if (targetTab) {
          await this.setActiveTab(targetTab.id, userAction)
        }
      } else {
        // Delete regular tabs normally
        await this.delete(id, userAction)
      }
    } catch (error) {
      this.log.error('Error closing tab:', error)
    }
  }

  async delete(id: string, userAction = false, spawnSmoke = true) {
    try {
      this.log.debug('Deleting tab with id:', id)

      const tab = this.tabs.find((t) => t.id === id)
      const tabIdx = this.tabs.findIndex((t) => t.id === id)
      if (tab) {
        this.tabs = this.tabs.filter((t) => t.id !== id)
        this.closedTabs.push(tab.dataValue)

        if (this.activeTabId === id) {
          // Set first tab as active if available
          if (this.tabs.length > 0) {
            const nextTab = this.tabs.at(tabIdx)
            if (nextTab) this.setActiveTab(nextTab.id, userAction)
            else this.setActiveTab(this.tabs.at(-1)!.id, userAction)
          } else {
            this.activeTabId = null
          }
        }

        tab.onDestroy()
      } else {
        this.log.warn(`Tab with id "${id}" not found`)
      }

      if (spawnSmoke) {
        const rect = document.getElementById(`tab-${id}`)?.getBoundingClientRect()
        if (rect) {
          spawnBoxSmoke(rect, {
            densityN: 30,
            size: 13,
            //velocityScale: 0.5,
            cloudPointN: 7
          })
        }
      }

      await this.kv.delete(id)

      this.emit(TabsServiceEmitterNames.DELETED, id)

      if (this.tabs.length <= 0) {
        this.openNewTabPage()
      }
    } catch (error) {
      this.log.error('Error deleting tab:', error)
    }
  }

  activateTab(id: string) {
    this.log.debug('Activating tab to id:', id)
    this.activatedTabs = [...this.activatedTabs.filter((t) => t !== id), id]
  }

  async setActiveTab(id: string | null, userAction = false) {
    try {
      this.log.debug('Setting active tab to id:', id)

      this.activeTabId = id

      if (id) {
        const tab = this.tabs.find((t) => t.id === id)
        if (!tab) {
          this.log.warn(`Tab with id "${id}" not found`)
          return
        }

        this.activateTab(tab.id)
        this.viewManager.activate(tab.view.id)

        // To make the extensions work we need to inform the main process about the active tab's webContents id
        tab.view.waitForWebContentsReady().then((webContents) => {
          if (webContents && tab.id === this.activeTabIdValue) {
            // @ts-ignore
            window.api.setActiveTab(webContents.webContentsId)
          }
        })
      }

      // NOTE: Do we need this here? for "safety" reactivity shit afterwards?
      // or should this actually be inside the if (id) scope?
      this.emit(TabsServiceEmitterNames.ACTIVATED, this.activeTab)
    } catch (err) {
      this.log.error('Error activating tab:', err)
    }
  }

  /**
   * Reorders a tab to a new position in the tab strip.
   * Updates both the in-memory tabs array and persists the new order to storage.
   *
   * @param tabId The ID of the tab to reorder
   * @param newIndex The target index position (0-based)
   */
  async reorderTab(tabId: string, newIndex: number) {
    try {
      this.log.debug(`Reordering tab ${tabId} to index ${newIndex}`)

      const currentIndex = this.tabs.findIndex((tab) => tab.id === tabId)
      if (currentIndex === -1) {
        this.log.warn(`Tab with id "${tabId}" not found for reordering`)
        return
      }

      // Clamp newIndex to valid range
      newIndex = Math.max(0, Math.min(newIndex, this.tabs.length - 1))

      // Don't reorder if already in the correct position
      if (currentIndex === newIndex) {
        return
      }

      const newTabs = [...this.tabs]
      const [movedTab] = newTabs.splice(currentIndex, 1)
      newTabs.splice(newIndex, 0, movedTab)

      this.tabs = newTabs

      newTabs.forEach((tab, index) => (tab.index = index))

      // Update all tabs with error handling for race conditions
      const updateResults = await Promise.allSettled(
        newTabs.map((tab) => this.update(tab.id, { index: tab.index }))
      )

      // Log any failures but don't block the reorder operation
      updateResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.log.warn(`Failed to update index for tab ${newTabs[idx].id}:`, result.reason)
        }
      })

      this.emit(TabsServiceEmitterNames.REORDERED, { tabId, oldIndex: currentIndex, newIndex })
      this.log.debug(`Successfully reordered tab ${tabId} from ${currentIndex} to ${newIndex}`)
    } catch (error) {
      this.log.error('Error reordering tab:', error)
    }
  }

  /**
   * Pin a tab, keeping its current position
   * @param tabId The ID of the tab to pin
   */
  async pinTab(tabId: string) {
    try {
      this.log.debug(`Pinning tab ${tabId}`)

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        this.log.warn(`Tab with id "${tabId}" not found for pinning`)
        return
      }

      if (tab.pinned) {
        this.log.debug(`Tab ${tabId} is already pinned`)
        return
      }

      // Update the tab's pinned state
      tab.pinned = true
      await this.update(tabId, { pinned: true })

      this.log.debug(`Successfully pinned tab ${tabId}`)
    } catch (error) {
      this.log.error('Error pinning tab:', error)
    }
  }

  /**
   * Unpin a tab, keeping its current position
   * @param tabId The ID of the tab to unpin
   */
  async unpinTab(tabId: string) {
    try {
      this.log.debug(`Unpinning tab ${tabId}`)

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        this.log.warn(`Tab with id "${tabId}" not found for unpinning`)
        return
      }

      if (!tab.pinned) {
        this.log.debug(`Tab ${tabId} is already unpinned`)
        return
      }

      // Update the tab's pinned state
      tab.pinned = false
      await this.update(tabId, { pinned: false })

      this.log.debug(`Successfully unpinned tab ${tabId}`)
    } catch (error) {
      this.log.error('Error unpinning tab:', error)
    }
  }

  async openNewTabPage() {
    try {
      if (!this.newTabView) {
        return this.create('surf://surf/notebook')
      }

      const tab = await this.createWithView(this.newTabView, { activate: true })
      this.newTabView = null

      // prepare the next new tab page
      setTimeout(() => this.prepareNewTabPage(), 100)

      return tab
    } catch (error) {
      this.log.error('Error opening new tab page:', error)
    }
  }

  async createResourceTab(resourceId: string, opts?: Partial<CreateTabOptions>) {
    this.log.debug('Creating new resource tab')
    const tab = await this.create(`surf://surf/resource/${resourceId}`, opts)
    return tab
  }

  async changeActiveTabURL(url: string, opts?: Partial<CreateTabOptions>) {
    try {
      this.log.debug('Replacing active tab with new URL:', url)
      const activeTab = this.activeTabValue

      if (!activeTab) {
        this.log.warn('No active tab found to replace URL')
        return
      }

      if (!activeTab.view.webContents) {
        this.log.warn('Active tab has no webContents to load URL')
        return
      }

      activeTab.view.webContents.loadURL(url)

      if (opts?.selectionHighlight) {
        activeTab.view.highlightSelection(opts.selectionHighlight)
      }

      if (opts?.active) {
        this.setActiveTab(activeTab.id)
      } else if (opts?.activate) {
        this.activateTab(activeTab.id)
      }

      return activeTab
    } catch (error) {
      this.log.error('Error changing active tab URL:', error)
    }
  }

  async reopenLastClosed() {
    try {
      const tabData = this.closedTabs.pop()
      if (tabData) {
        this.log.debug('Opening previously closed tab')

        const tab = this.itemToTabItem(tabData)
        if (!tab) {
          this.log.error('Failed to convert closed tab data to tab item:', tabData)
          return
        }

        this.tabs = [...this.tabs, tab]
        this.setActiveTab(tab.id, true)
      }
    } catch (error) {
      this.log.error('Error reopening last closed tab:', error)
    }
  }

  getTabByViewId(viewId: string): TabItem | null {
    const tab = this.tabs.find((t) => t.view.id === viewId) || null
    return tab
  }

  findTabByURL(url: string): TabItem | null {
    const tab = this.tabs.find((t) => t.view.urlValue === url) || null
    return tab
  }

  onDestroy() {
    this.log.debug('Destroying TabsService')
    this.unsubs.forEach((unsub) => unsub())

    if (this.newTabView) {
      this.newTabView.destroy()
      this.newTabView = null
    }
  }

  static provide(viewManager?: ViewManager): TabsService {
    TabsService.self = new TabsService(viewManager)
    return TabsService.self
  }

  static useTabs(): TabsService {
    return TabsService.self
  }
}

export const createTabsService = (viewManager?: ViewManager) => TabsService.provide(viewManager)
export const useTabs = () => TabsService.useTabs()
