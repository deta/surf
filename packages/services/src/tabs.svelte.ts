import { EventEmitterBase, getHostname, isDev, type ScopedLogger, useLogScope } from '@deta/utils'
import { type BaseKVItem, KVStore, useKVTable } from './kv'
import type { Fn, WebContentsViewData } from '@deta/types'
import { useViewManager, WebContentsView, ViewManager } from './viewManager.svelte'
import { derived, type Readable } from 'svelte/store'

export interface KVTabItem extends BaseKVItem {
  title: string
  index: number
  view: WebContentsViewData
}

export type CreateTabOptions = {
  active: boolean
}

export class TabItem extends EventEmitterBase<any> {
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
      view.on('data-changed', (data) => {
        this.log.debug(`View data changed for tab ${this.id}:`, data)
        this.update({
          title: data.title,
          view: data
        })
      })
    )
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

    this.manager.update(this.id, {
      id: this.id,
      index: this.index,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      view: this.view.dataValue
    })

    this.emit('update', this)
  }

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())

    this.view.manager.destroy(this.view.id)

    this.emit('destroy', this)
  }
}

export class TabsService extends EventEmitterBase<any> {
  private log: ScopedLogger
  private viewManager: ViewManager
  private kv: KVStore<KVTabItem>

  private _lastTabIndex = -1

  ready: Promise<void>

  tabs = $state<TabItem[]>([])
  activeTabId = $state<string | null>(null)
  activatedTabs = $state<string[]>([])

  activeTab: TabItem | null

  static self: TabsService

  get tabsValue(): TabItem[] {
    return this.tabs
  }

  constructor() {
    super()

    this.log = useLogScope('TabsService')
    this.viewManager = useViewManager()
    this.kv = useKVTable<KVTabItem>('tabs')

    this.ready = this.kv.ready

    this.activeTab = $derived.by(() => {
      const activeId = this.activeTabId
      if (!activeId) return null

      const tab = this.tabs.find((t) => t.id === activeId)
      if (!tab) {
        this.log.warn(`Active tab with id "${activeId}" not found`)
        return null
      }

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
      .map((item) => this.itemToTabItem(item))
      .filter((item) => item !== null) as TabItem[]

    return tabs
  }

  async create(url: string, opts: Partial<CreateTabOptions> = {}): Promise<TabItem> {
    const options = {
      active: true,
      ...opts
    } as CreateTabOptions

    const view = await this.viewManager.create({ url })

    this.log.debug('Creating new tab with view:', view, 'options:', options)

    const newIndex = (await this.getLastTabIndex()) + 1
    const hostname = getHostname(url) || 'unknown'

    const item = await this.kv.create({ title: hostname, view: view.dataValue, index: newIndex })

    const tab = new TabItem(this, view, item)
    this.tabs = [...this.tabs, tab]

    if (options.active) {
      this.setActiveTab(item.id)
    }

    return tab
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

      this.activatedTabs = [...this.activatedTabs.filter((t) => t !== id), id]
      this.viewManager.activate(tab.view.id)
    }
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
