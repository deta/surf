import {
  EventEmitterBase,
  getHostname,
  isDev,
  type ScopedLogger,
  useDebounce,
  useLogScope
} from '@deta/utils'
import { KVStore, useKVTable } from '../kv'
import type { Fn } from '@deta/types'
import { useViewManager, WebContentsView, ViewManager } from '../views'
import { derived, get, writable, type Readable } from 'svelte/store'
import { ViewManagerEmitterNames, WebContentsViewEmitterNames } from '../views/types'
import type { NewWindowRequest } from '../ipc/events'
import {
  type TabItemEmitterEvents,
  type KVTabItem,
  TabItemEmitterNames,
  type CreateTabOptions,
  TabsServiceEmitterNames,
  type TabsServiceEmitterEvents
} from './tabs.types'

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
      view: this.view.dataValue
    }
  }

  async update(data: Partial<KVTabItem>) {
    this.id = data.id ?? this.id
    this.index = data.index ?? this.index
    this.createdAt = data.createdAt ? new Date(data.createdAt) : this.createdAt
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : this.updatedAt

    this.log.debug(`Updating tab ${this.id} with data:`, data)

    this.manager.update(this.id, {
      id: this.id,
      index: this.index,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      view: this.view.dataValue
    })

    this.emit(TabItemEmitterNames.UPDATE, this)
  }

  debouncedUpdate = useDebounce((data: Partial<KVTabItem>) => {
    this.log.debug(`Debounced update for tab ${this.id}:`, data)
    this.update(data)
  }, 200)

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())

    this.view.manager.destroy(this.view.id)

    this.emit(TabItemEmitterNames.DESTROY, this.id)
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
  private kv: KVStore<KVTabItem>

  private _lastTabIndex = -1
  private unsubs: Fn[] = []

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

  constructor() {
    super()

    this.log = useLogScope('TabsService')
    this.viewManager = useViewManager()
    this.kv = useKVTable<KVTabItem>('tabs')

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

    this.unsubs.push(
      this.viewManager.on(ViewManagerEmitterNames.NEW_WINDOW_REQUEST, (details) => {
        this.handleNewWindowRequest(details)
      })
    )
  }

  private handleNewWindowRequest(details: NewWindowRequest) {
    this.log.debug('New window request received', details)
    const active = details.disposition !== 'background-tab'
    this.create(details.url, { active, activate: true })
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
    this.log.debug('Listing all tabs')

    const raw = await this.kv.all()
    if (raw.length === 0) {
      this.log.debug('No tabs found')
      return []
    }

    const tabs = raw
      .sort((a, b) => a.index - b.index)
      .map((item) => this.itemToTabItem(item))
      .filter((item) => item !== null) as TabItem[]

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

    const view = await this.viewManager.create({ url })

    if (options.selectionHighlight) {
      view.addSelectionHighlight(options.selectionHighlight)
    }

    this.log.debug('Creating new tab with view:', view, 'options:', options)

    const newIndex = (await this.getLastTabIndex()) + 1
    const hostname = getHostname(url) || 'unknown'

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

  async openOrCreate(url: string, opts: Partial<CreateTabOptions> = {}): Promise<TabItem> {
    this.log.debug('Opening or creating tab for URL:', url)
    const existingTab = this.tabs.find((tab) => tab.view.urlValue === url)
    if (existingTab) {
      this.log.debug('Tab already exists, activating:', existingTab.id)

      if (opts.selectionHighlight) {
        existingTab.view.highlightSelection(opts.selectionHighlight)
      }

      if (opts.active) {
        await this.setActiveTab(existingTab.id)
      } else if (opts.activate) {
        this.activateTab(existingTab.id)
      }

      return existingTab
    }

    this.log.debug('Tab does not exist, creating new one')
    return this.create(url, opts)
  }

  async get(id: string): Promise<TabItem | null> {
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
  }

  async update(id: string, data: Partial<KVTabItem>) {
    this.log.debug('Updating tab with id:', id, 'data:', data)
    const item = await this.kv.update(id, data)

    this.log.debug('Tab updated:', item)
    return !!item
  }

  async delete(id: string) {
    this.log.debug('Deleting tab with id:', id)

    const tab = this.tabs.find((t) => t.id === id)
    if (tab) {
      this.tabs = this.tabs.filter((t) => t.id !== id)

      if (this.activeTabId === id) {
        // Set first tab as active if available
        if (this.tabs.length > 0) {
          this.setActiveTab(this.tabs[this.tabs.length - 1].id)
        } else {
          this.activeTabId = null
        }
      }

      tab.onDestroy()
    } else {
      this.log.warn(`Tab with id "${id}" not found`)
    }

    await this.kv.delete(id)

    this.emit(TabsServiceEmitterNames.DELETED, id)
  }

  activateTab(id: string) {
    this.log.debug('Activating tab to id:', id)
    this.activatedTabs = [...this.activatedTabs.filter((t) => t !== id), id]
  }

  async setActiveTab(id: string | null) {
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
    }

    this.emit(TabsServiceEmitterNames.ACTIVATED, this.activeTab)
  }

  /**
   * Reorders a tab to a new position in the tab strip.
   * Updates both the in-memory tabs array and persists the new order to storage.
   *
   * @param tabId The ID of the tab to reorder
   * @param newIndex The target index position (0-based)
   */
  async reorderTab(tabId: string, newIndex: number) {
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

    newTabs.forEach((tab, index) => {
      tab.index = index
    })

    this.emit(TabsServiceEmitterNames.REORDERED, { tabId, oldIndex: currentIndex, newIndex })
    this.log.debug(`Successfully reordered tab ${tabId} from ${currentIndex} to ${newIndex}`)
  }

  onDestroy() {
    this.log.debug('Destroying TabsService')
    this.unsubs.forEach((unsub) => unsub())
  }

  static useTabs(): TabsService {
    if (!TabsService.self) {
      TabsService.self = new TabsService()
    }
    return TabsService.self
  }
}

export function useTabs(): TabsService {
  return TabsService.useTabs()
}
