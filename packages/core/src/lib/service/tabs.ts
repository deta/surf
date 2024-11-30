import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import {
  getFileType,
  isDev,
  normalizeURL,
  useLocalStorageStore,
  useLogScope,
  wait
} from '@horizon/utils'
import {
  ActivateTabEventTrigger,
  BrowserContextScope,
  ChangeContextEventTrigger,
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
  SpaceData,
  Tab,
  TabImporter,
  TabOnboarding,
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
import type { OasisService, OasisSpace } from './oasis'
import type { DesktopManager } from './desktop'

export type TabEvents = {
  created: (tab: Tab, active: boolean) => void
  deleted: (tab: Tab) => void
  updated: (tab: Tab) => void
  selected: (tab: Tab) => void
  'url-changed': (tab: Tab, newUrl: string) => void
  'changed-active-scope': (scopeId: string | null) => void
}

export type TabScopeObject = { tabId: string; scopeId: string | null }

export const TABS_CONTEXT_KEY = 'tabs-manager'

const SCOPED_TAB_DEACTIVATION_TIMEOUT = 1000 * 60 * 5 // deactivate scoped tabs after 5 minutes if the scope is longer active
const MAX_LAST_USED_SCOPES = 15

export const PAGE_TABS_RESOURCE_TYPES = [
  ResourceTypes.LINK,
  ResourceTypes.ARTICLE,
  ResourceTypes.DOCUMENT,
  ResourceTypes.POST
]

export const getBrowserContextScopeType = (scopeId: string | undefined | null) => {
  return scopeId ? BrowserContextScope.Space : BrowserContextScope.General
}

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
  private telemetry: Telemetry
  private eventEmitter: TypedEmitter<TabEvents>
  private closedTabs: ClosedTabs
  private oasis: OasisService
  historyEntriesManager: HistoryEntriesManager
  desktopManager: DesktopManager

  tabs: Writable<Tab[]>
  activeTabId: Writable<string>
  activatedTabs: Writable<string[]>
  showNewTabOverlay: Writable<number>
  browserTabs: Writable<Record<string, BrowserTab>>
  activeTabsHistory: Writable<string[]>
  activeTabMagic: Writable<PageMagic>
  selectedTabs: Writable<Set<{ id: string; userSelected: boolean }>>
  lastSelectedTabId: Writable<string | null>
  activeScopeId: Writable<string | null>
  scopedActiveTabs: Writable<TabScopeObject[]>
  lastUsedScopes: Writable<string[]>

  offloadTabsTimeouts: Map<string, ReturnType<typeof setTimeout>>

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
    telemetry: Telemetry,
    oasis: OasisService,
    desktopManager: DesktopManager
  ) {
    const storage = new HorizonDatabase()
    this.db = storage.tabs
    this.resourceManager = resourceManager
    this.historyEntriesManager = historyEntriesManager
    this.telemetry = telemetry
    this.oasis = oasis
    this.desktopManager = desktopManager
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
    this.activeScopeId = useLocalStorageStore<string | null>('active-surf-scope', null)
    this.scopedActiveTabs = useLocalStorageStore<TabScopeObject[]>('scoped-active-tabs', [], true)
    this.lastUsedScopes = useLocalStorageStore<string[]>('last-used-scopes', [], true)
    this.activeTabMagic = writable<PageMagic>({
      running: false,
      showSidebar: false,
      initializing: false,
      responses: [],
      errors: []
    })

    this.offloadTabsTimeouts = new Map()

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

    this.unpinnedTabs = derived([this.activeTabs, this.activeScopeId], ([tabs, activeScopeId]) => {
      return tabs
        .filter(
          (tab) =>
            !tab.pinned && (activeScopeId !== null ? tab.scopeId === activeScopeId : !tab.scopeId)
        )
        .sort((a, b) => a.index - b.index)
    })

    this.magicTabs = derived([this.activeTabs], ([tabs]) => {
      return tabs.filter((tab) => tab.magic).sort((a, b) => a.index - b.index) as (
        | TabPage
        | TabSpace
        | TabResource
      )[]
    })

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

  get activeScopeIdValue() {
    return get(this.activeScopeId)
  }

  get scopedActiveTabsValue() {
    return get(this.scopedActiveTabs)
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
      scopeId: this.activeScopeIdValue ?? undefined,
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
    this.removeTabFromScopedActiveTabs(tabId)

    await tick()

    this.log.warn('Deleted tab', tabId, this.unpinnedTabsValue)
    if (get(this.desktopManager.isEnabled) && this.unpinnedTabsValue.length <= 0) {
      this.desktopManager.setVisible(true)
    } else if (this.activeTabIdValue === tabId) {
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
        await this.telemetry.trackDeletePageTab(
          trigger,
          getBrowserContextScopeType(this.activeScopeIdValue)
        )
      } else if (tab.type === 'space') {
        await this.telemetry.trackDeleteSpaceTab(
          trigger,
          getBrowserContextScopeType(this.activeScopeIdValue)
        )
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

  pinTab(tabId: string) {
    this.log.debug('Pinning tab', tabId)

    const tab = this.tabsValue.find((tab) => tab.id === tabId)
    if (!tab) {
      this.log.error('Tab not found', tabId)
      return
    }

    return this.update(tabId, { pinned: true, scopeId: undefined })
  }

  unpinTab(tabId: string) {
    this.log.debug('Unpinning tab', tabId)

    const tab = this.tabsValue.find((tab) => tab.id === tabId)
    if (!tab) {
      this.log.error('Tab not found', tabId)
      return
    }

    return this.update(tabId, { pinned: false, scopeId: this.activeScopeIdValue ?? undefined })
  }

  changeTabPinnedState(tabId: string, pinned: boolean) {
    return pinned ? this.pinTab(tabId) : this.unpinTab(tabId)
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

  activateTab(tabId: string) {
    this.log.debug('Activating tab', tabId)

    if (get(this.activatedTabs).includes(tabId)) {
      this.log.debug('Tab already activated', tabId)
      this.offloadTabsTimeouts.delete(tabId)
      return
    }

    this.activatedTabs.update((tabs) => {
      if (tabs.includes(tabId)) {
        return tabs
      }

      return [...tabs, tabId]
    })

    this.offloadTabsTimeouts.delete(tabId)
  }

  deactivateTab(tabId: string) {
    if (this.activeTabIdValue === tabId) {
      this.log.debug('Skip deactivating active tab', tabId)
      return
    }
    this.log.debug('Deactivating tab', tabId)
    this.activatedTabs.update((tabs) => tabs.filter((id) => id !== tabId))
  }

  addTabToScopedActiveTabs(tabOrId: Tab | string) {
    const tab = typeof tabOrId === 'string' ? this.tabsValue.find((t) => t.id === tabOrId) : tabOrId
    if (!tab) {
      this.log.error('Tab not found', tabOrId)
      return
    }

    const existingTabForSameSpace = this.scopedActiveTabsValue.find(
      (t) => t.scopeId === (tab.scopeId ?? null)
    )

    this.scopedActiveTabs.update((items) => {
      const newTabs = existingTabForSameSpace
        ? items.filter((t) => t.tabId !== existingTabForSameSpace.tabId)
        : items

      if (!newTabs.find((t) => t.tabId === tab.id)) {
        return [...newTabs, { tabId: tab.id, scopeId: tab.scopeId ?? null }]
      }

      return newTabs
    })
  }

  removeTabFromScopedActiveTabs(tabId: string) {
    this.scopedActiveTabs.update((items) => items.filter((t) => t.tabId !== tabId))
  }

  removeActiveTabFromScopedActiveTabs(scopeId?: string) {
    const targetScopeId = scopeId ?? this.activeScopeIdValue
    this.scopedActiveTabs.update((items) => items.filter((t) => t.scopeId !== targetScopeId))
  }

  async makeActive(tabId: string, trigger?: ActivateTabEventTrigger, hideHomescreen = true) {
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

    this.activateTab(tabId)
    this.activeTabId.set(tabId)

    if (!tab.pinned) {
      this.addTabToScopedActiveTabs(tab)
    }

    this.addToActiveTabsHistory(tabId)

    if (hideHomescreen) {
      this.desktopManager.setVisible(false)
    }

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
      this.telemetry.trackActivateTab(
        trigger,
        tab.type,
        getBrowserContextScopeType(this.activeScopeIdValue)
      )

      if (tab.type === 'space') {
        this.telemetry.trackActivateTabSpace(
          trigger,
          getBrowserContextScopeType(this.activeScopeIdValue)
        )
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
  cycle(previous: boolean): string | undefined {
    if (this.tabsValue.length === 0) {
      this.log.debug('No tabs in view')
      return
    }
    let ordered = [
      ...this.unpinnedTabsValue.sort((a, b) => a.index - b.index),
      ...this.pinnedTabsValue.sort((a, b) => a.index - b.index)
    ].filter((tab) => !tab.archived)

    let tabId: string
    const activeTabIndex = ordered.findIndex((tab) => tab.id === this.activeTabIdValue)

    if (!previous) {
      const nextTabIndex = activeTabIndex + 1
      tabId = nextTabIndex >= ordered.length ? ordered[0].id : ordered[nextTabIndex].id
    } else {
      const previousTabIndex = activeTabIndex - 1
      tabId = previousTabIndex < 0 ? ordered[ordered.length - 1].id : ordered[previousTabIndex].id
    }

    return tabId
  }

  showNewTab() {
    this.showNewTabOverlay.set(1)
  }

  async addPageTab(url: string, opts?: CreateTabOptions, tabData?: Partial<TabPage>) {
    this.log.debug('Creating new page tab', opts, tabData)

    if (!url) {
      this.showNewTab()
      return null
    }

    if (isDev && normalizeURL(url) === 'localhost:5173') {
      this.log.debug('Skipping creating Vite dev server tab')
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
      'page',
      getBrowserContextScopeType(this.activeScopeIdValue)
    )

    return newTab as TabPage
  }

  async addSpaceTab(space: OasisSpace, opts?: CreateTabOptions) {
    this.log.debug('Creating new space tab')
    const newTab = await this.create<TabSpace>(
      {
        title: space.dataValue.folderName,
        icon: '',
        spaceId: space.id,
        type: 'space',
        colors: space.dataValue.colors ?? ['#fff', '#fff']
      },
      opts
    )

    await this.telemetry.trackCreateTab(
      opts?.trigger ?? CreateTabEventTrigger.Other,
      opts?.active ?? false,
      'space',
      getBrowserContextScopeType(this.activeScopeIdValue)
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
      'resource',
      getBrowserContextScopeType(this.activeScopeIdValue)
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
    if (resource.type === 'application/pdf') {
      return this.addPageTab(`surf://resource/${resource.id}`, opts, {
        title: resource.metadata?.name
      })
    }

    return this.addResourceTab(resource, opts)
  }

  async addImporterTab(opts?: CreateTabOptions) {
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
      { active: true, ...opts }
    )

    return newTab
  }

  async addOnboardingTab(pinned = false, opts?: CreateTabOptions) {
    this.log.debug('Creating new onboarding tab')
    const newTab = await this.create<TabOnboarding>(
      {
        title: 'Surf Onboarding',
        icon: 'https://deta.surf/favicon-32x32.png',
        type: 'onboarding',
        pinned: pinned
      },
      { active: true, ...opts }
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

  async updateSurfResourceTabs(resourceId: string, updates: Partial<TabPage>) {
    this.log.debug('Updating surf resource tabs for resource', resourceId, updates)

    this.tabsValue.forEach((tab) => {
      if (tab.type !== 'page') return
      if (
        tab.resourceBookmark === resourceId &&
        tab.currentLocation?.startsWith('surf://resource')
      ) {
        this.update(tab.id, updates)
      }
    })
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

  async changeScope(
    scopeId: string | null,
    trigger: ChangeContextEventTrigger = ChangeContextEventTrigger.ContextSwitcher
  ) {
    const currentActiveScope = this.activeScopeIdValue
    this.log.debug('changing active scope from', currentActiveScope, 'to', scopeId)

    this.activeScopeId.set(scopeId)

    if (scopeId !== null) {
      this.activeScopeId.set(scopeId)

      this.lastUsedScopes.update((scopes) => {
        const filteredScopes = (scopes ?? []).filter((s) => s !== scopeId)
        return [scopeId, ...filteredScopes].slice(0, MAX_LAST_USED_SCOPES)
      })

      this.log.debug('preventing scoped tabs from being offloaded', scopeId)
      this.cancelScopedTabsOffloading(scopeId)
    }

    const desktopId = scopeId ?? '$$default'
    await this.desktopManager.setActive(desktopId)

    await tick()

    const activeTab = this.tabsValue.find((tab) => tab.id === this.activeTabIdValue)
    this.log.warn('Active tab', activeTab, 'Active scope', this.activeTabIdValue)

    if (!activeTab?.pinned && (!scopeId || scopeId !== activeTab?.scopeId)) {
      const lastStoredActiveTab = this.scopedActiveTabsValue.find(
        (tab) => tab.scopeId === scopeId
      )?.tabId
      const fallbackActiveTab = this.tabsValue.find((tab) => {
        if (scopeId) {
          return tab.scopeId === scopeId && !tab.pinned
        } else {
          return !tab.scopeId && !tab.pinned
        }
      })?.id

      this.log.warn(
        'lastStoredActiveTab',
        lastStoredActiveTab,
        'fallbackActiveTab',
        fallbackActiveTab
      )

      const newTabId = lastStoredActiveTab || fallbackActiveTab

      if (newTabId) {
        this.log.warn('newTabId', newTabId)
        await this.makeActive(newTabId, undefined, false)

        // if the tab was not found in the scoped active tabs, make the desktop visible while using the fallback tab
        if (!lastStoredActiveTab) {
          this.desktopManager.setVisible(true, { desktop: desktopId })
        }
      } else {
        this.log.warn('No tab found for default browsing context')
        this.desktopManager.setVisible(true, { desktop: desktopId })
      }
    }

    this.emit('changed-active-scope', scopeId)

    // offload tabs from the previous active scope (we intentionally skip it for the default browsing context e.g. no current active scope)
    if (currentActiveScope && currentActiveScope !== scopeId) {
      this.log.debug('triggering tab offloading timeout for previous active scope')
      this.triggerScopedTabsOffloading(currentActiveScope)
    }

    this.log.debug('changed active scope', scopeId)
    this.telemetry.trackContextSwitch(
      trigger,
      getBrowserContextScopeType(currentActiveScope),
      getBrowserContextScopeType(scopeId)
    )
  }

  async scopeTab(tabId: string, scopeId: string | null) {
    this.log.debug('Scoping tab', tabId, 'to', scopeId)

    const tab = this.tabsValue.find((tab) => tab.id === tabId)
    const currentScopeId = tab?.scopeId

    if (this.activeTabIdValue === tabId && scopeId !== this.activeScopeIdValue) {
      this.log.debug('Changing active tab', tabId)
      const lastActiveTabId = this.unpinnedTabsValue.find((tab) => tab.id !== tabId)?.id
      if (lastActiveTabId) {
        this.makeActive(lastActiveTabId)
      } else {
        this.makeActive(this.pinnedTabsValue[0].id)
      }
    }

    // if the tab is active for its scope, remove it from the list
    const tabIsActiveForItsScope = this.scopedActiveTabsValue.find((t) => t.tabId === tabId)
    if (tabIsActiveForItsScope) {
      this.scopedActiveTabs.update((items) => items.filter((t) => t.tabId !== tabId))
    }

    await this.update(tabId, { scopeId: scopeId ?? undefined })

    this.telemetry.trackMoveTabToContext(
      getBrowserContextScopeType(currentScopeId),
      getBrowserContextScopeType(scopeId)
    )
  }

  async deleteScopedTabs(scopeId: string) {
    this.log.debug('Deleting tabs for scope', scopeId)
    const tabsToDelete = this.tabsValue.filter((tab) => tab.scopeId === scopeId)

    if (tabsToDelete.length > 0) {
      this.log.debug('Deleting tabs', tabsToDelete)
      await Promise.all(tabsToDelete.map((tab) => this.delete(tab.id)))
    }
  }

  triggerScopedTabsOffloading(scopeId: string) {
    this.log.debug('Triggering offloading of scoped tabs for scope', scopeId)
    const tabsToUpdate = this.tabsValue.filter(
      (tab) => tab.scopeId === scopeId && !tab.pinned // && tab.id !== this.activeTabIdValue
    )

    if (tabsToUpdate.length > 0) {
      this.log.debug('Triggering offloading of tabs', tabsToUpdate)
      for (const tab of tabsToUpdate) {
        const timeout = setTimeout(() => {
          this.offloadTabsTimeouts.delete(tab.id)
          this.deactivateTab(tab.id)
        }, SCOPED_TAB_DEACTIVATION_TIMEOUT)

        this.offloadTabsTimeouts.set(tab.id, timeout)
      }
    }
  }

  cancelScopedTabsOffloading(scopeId: string) {
    this.log.debug('Cancelling offloading of scoped tabs for scope', scopeId)
    const tabsToUpdate = this.tabsValue.filter((tab) => tab.scopeId === scopeId && !tab.pinned)

    if (tabsToUpdate.length > 0) {
      this.log.debug('Cancelling offloading of tabs', tabsToUpdate)
      for (const tab of tabsToUpdate) {
        const timeout = this.offloadTabsTimeouts.get(tab.id)
        this.log.debug('Cancelling offloading of tab', tab.id, timeout)
        if (timeout) {
          clearTimeout(timeout)
          this.offloadTabsTimeouts.delete(tab.id)
        }
      }
    }
  }

  export() {
    const data = JSON.stringify(this.tabsValue)
    return data
  }

  async import(data: string) {
    const tabs = JSON.parse(data) as Tab[]

    await Promise.all(tabs.map((tab) => this.db.create(tab)))

    this.tabs.set(tabs)
  }

  static provide(
    resourceManager: ResourceManager,
    historyEntriesManager: HistoryEntriesManager,
    telemetry: Telemetry,
    oasis: OasisService,
    desktopManager: DesktopManager
  ) {
    const tabsService = new TabsManager(
      resourceManager,
      historyEntriesManager,
      telemetry,
      oasis,
      desktopManager
    )
    setContext(TABS_CONTEXT_KEY, tabsService)
    return tabsService
  }

  static use() {
    return getContext<TabsManager>(TABS_CONTEXT_KEY)
  }
}

export const createTabsManager = TabsManager.provide
export const useTabsManager = TabsManager.use
