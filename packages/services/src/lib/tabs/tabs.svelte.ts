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
import { type Fn, TelemetryViewType, TelemetryCreateTabSource } from '@deta/types'
import { useViewManager, WebContentsView, ViewManager } from '../views'
import { derived, get, writable, type Readable } from 'svelte/store'
import { ViewManagerEmitterNames, ViewType, WebContentsViewEmitterNames } from '../views/types'
import type { NewWindowRequest } from '../ipc/events'
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
import { Telemetry } from '@deta/services'

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
  private telemetry: Telemetry
  private kv: KVStore<KVTabItem>
  private closedTabs: ClosedTabs

  private _lastTabIndex = -1
  private unsubs: Fn[] = []
  newTabView: WebContentsView | null = null

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

  constructor(viewManager?: ViewManager) {
    super()

    this.log = useLogScope('TabsService')
    this.viewManager = viewManager ?? useViewManager()
    this.resourceManager = useResourceManager()
    this.telemetry = this.resourceManager.telemetry
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

    if (url === 'surf-internal://core/Core/core.html') {
      this.log.warn('Attempted to open core URL directly, which is not allowed.')
      throw new Error('Cannot open core URL directly')
    }

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
      view.addSelectionHighlight(options.selectionHighlight)
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
    isUserAction = false,
    interactionSource: TelemetryCreateTabSource | undefined = undefined
  ): Promise<TabItem> {
    this.log.debug('Opening or creating tab for URL:', url)

    const canonicalUrl = parseUrlIntoCanonical(url) ?? url
    const existingTab = this.tabs.find(
      (tab) => (parseUrlIntoCanonical(tab.view.urlValue) ?? tab.view.urlValue) === canonicalUrl
    )

    if (existingTab) {
      this.log.debug('Tab already exists, activating:', existingTab.id)

      if (opts.selectionHighlight) {
        existingTab.view.highlightSelection(opts.selectionHighlight)
      }

      if (opts.active) {
        await this.setActiveTab(existingTab.id, isUserAction)
      } else if (opts.activate) {
        this.activateTab(existingTab.id)
      }

      return existingTab
    }

    this.log.debug('Tab does not exist, creating new one')
    if (isUserAction) this.telemetry.trackCreateTab(interactionSource)
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
  }

  async delete(id: string, userAction = false, spawnSmoke = true) {
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

    if (userAction) this.telemetry.trackDeleteTab()
    this.emit(TabsServiceEmitterNames.DELETED, id)

    if (this.tabs.length <= 0) {
      this.openNewTabPage()
    }
  }

  activateTab(id: string) {
    this.log.debug('Activating tab to id:', id)
    this.activatedTabs = [...this.activatedTabs.filter((t) => t !== id), id]
  }

  async setActiveTab(id: string | null, userAction = false) {
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

      if (userAction) {
        const { type: tab_type, id: tab_resource_id } = tab.view.typeDataValue
        // NOTE: Make digestable for telemetry, we should make this prettier
        const telem_tab_type: Record<ViewType, TelemetryViewType> = {
          [ViewType.Page]: TelemetryViewType.Webpage,
          [ViewType.Notebook]: TelemetryViewType.Notebook,
          [ViewType.NotebookHome]: TelemetryViewType.SurfRoot,
          [ViewType.Resource]: TelemetryViewType.Resource
        }[tab_type]

        if (tab_resource_id) {
          this.resourceManager
            .getResource(tab_resource_id, { includeAnnotations: false })
            .then((resource) => {
              this.resourceManager.telemetry.trackActivateTab(telem_tab_type, resource?.type)
            })
        } else {
          this.resourceManager.telemetry.trackActivateTab(telem_tab_type)
        }
      }
    }

    // NOTE: Do we need this here? for "safety" reactivity shit afterwards?
    // or should this actually be inside the if (id) scope?
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

    await Promise.all(newTabs.map((tab) => this.update(tab.id, { index: tab.index })))

    this.emit(TabsServiceEmitterNames.REORDERED, { tabId, oldIndex: currentIndex, newIndex })
    this.log.debug(`Successfully reordered tab ${tabId} from ${currentIndex} to ${newIndex}`)
  }

  private async prepareNewTabPage() {
    this.log.debug('Preparing new tab page')
    this.newTabView = await this.viewManager.create({ url: 'surf://notebook' })
    await this.newTabView.preloadWebContents({ activate: false })
  }

  async openNewTabPage() {
    if (!this.newTabView) {
      return this.create('surf://notebook')
    }

    const tab = await this.createWithView(this.newTabView, { activate: true })

    // prepare the next new tab page
    setTimeout(() => this.prepareNewTabPage(), 0)

    return tab
  }

  async createResourceTab(resourceId: string, opts?: Partial<CreateTabOptions>) {
    this.log.debug('Creating new resource tab')
    const tab = await this.create(`surf://resource/${resourceId}`, opts)
    return tab
  }

  async changeActiveTabURL(url: string, opts?: Partial<CreateTabOptions>) {
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
  }

  async reopenLastClosed() {
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
  }

  getTabByViewId(viewId: string): TabItem | null {
    const tab = this.tabs.find((t) => t.view.id === viewId) || null
    return tab
  }

  onDestroy() {
    this.log.debug('Destroying TabsService')
    this.unsubs.forEach((unsub) => unsub())
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
