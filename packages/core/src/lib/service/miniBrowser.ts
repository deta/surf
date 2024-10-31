import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { Resource, ResourceManager } from './resources'
import { generateID, useLogScope } from '@horizon/utils'
import { OpenInMiniBrowserEventFrom, ResourceTagsBuiltInKeys } from '@horizon/types'
import { getContext, setContext } from 'svelte'
import type { TabPage } from '../types'
import type BrowserTab from '../components/Browser/BrowserTab.svelte'
import type { Telemetry } from './telemetry'

// export type MiniBrowserSelected = MiniBrowserSelectedResource | MiniBrowserSelectedWebPage

// export type MiniBrowserSelectedResource = {
//   type: 'resource'
//   data: Resource
//   highlightSimilarText?: string
//   jumpToTimestamp?: number
// }

// export type MiniBrowserSelectedWebPage = {
//   type: 'webpage'
//   data: string
// }

export type MiniBrowserSelected = {
  id: string
  type: 'tab'
  data: TabPage
  resource?: Resource
  browserTab?: BrowserTab
  selection?: {
    text?: string
    timestamp?: number
  }
}

export const MINI_BROWSER_SERVICE_CONTEXT_KEY = 'miniBrowserService'
export const MINI_BROWSER_CONTEXT_KEY = 'miniBrowser'

export class MiniBrowser {
  key: string
  isOpen: Writable<boolean>
  selected: Writable<MiniBrowserSelected | null> = writable(null)

  private log: ReturnType<typeof useLogScope>
  private resourceManager: ResourceManager
  private telemetry: Telemetry

  constructor(key: string, resourceManager: ResourceManager) {
    this.log = useLogScope('MiniBrowser')
    this.resourceManager = resourceManager
    this.telemetry = resourceManager.telemetry

    this.key = key
    this.isOpen = writable(false)
    this.selected = writable(null)
  }

  get isOpenValue() {
    return get(this.isOpen)
  }

  private createTab(url?: string, resource?: Resource) {
    const tab = {
      id: `webview-mini-browser-${generateID()}`,
      type: 'page',
      currentLocation: url,
      initialLocation: url,
      title: resource?.metadata?.name ?? url ?? 'Untitled',
      icon: '',
      historyStackIds: [],
      currentHistoryIndex: -1,
      archived: false,
      index: 0,
      pinned: false,
      magic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resourceBookmark: resource?.id,
      resourceBookmarkedManually: false,
      chatResourceBookmark: resource?.id
    } as TabPage

    return tab
  }

  async openResource(
    resourceOrId: string | Resource,
    opts?: {
      highlightSimilarText?: string
      jumptToTimestamp?: number
      from?: OpenInMiniBrowserEventFrom
    }
  ) {
    let resource: Resource | null
    if (typeof resourceOrId === 'string') {
      resource = await this.resourceManager.getResource(resourceOrId)
    } else {
      resource = resourceOrId
    }

    if (!resource) {
      this.log.error('Resource not found', resourceOrId)
      throw new Error('Resource not found')
    }

    this.log.debug('Opening resource', resource)

    const canonicalUrl = resource?.tags?.find(
      (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
    )?.value

    const url = canonicalUrl || canonicalUrl || resource?.metadata?.sourceURI
    const tab = this.createTab(url, resource)

    this.selected.set({
      id: generateID(),
      type: 'tab',
      data: tab,
      resource: resource,
      selection: {
        text: opts?.highlightSimilarText,
        timestamp: opts?.jumptToTimestamp
      }
    })

    this.isOpen.set(true)

    this.telemetry.trackOpenInMiniBrowser('resource', opts?.from)
  }

  openWebpage(
    url: string,
    opts?: {
      highlightSimilarText?: string
      jumptToTimestamp?: number
      from?: OpenInMiniBrowserEventFrom
    }
  ) {
    this.log.debug('Opening webpage', url)

    const tab = this.createTab(url)

    this.selected.set({
      id: generateID(),
      type: 'tab',
      data: tab,
      resource: undefined,
      selection: {
        text: opts?.highlightSimilarText,
        timestamp: opts?.jumptToTimestamp
      }
    })

    this.isOpen.set(true)

    this.telemetry.trackOpenInMiniBrowser('page', opts?.from)
  }

  openTab(
    tab: TabPage,
    opts?: {
      highlightSimilarText?: string
      jumptToTimestamp?: number
      from?: OpenInMiniBrowserEventFrom
    }
  ) {
    this.selected.set({
      id: generateID(),
      type: 'tab',
      data: tab,
      selection: {
        text: opts?.highlightSimilarText,
        timestamp: opts?.jumptToTimestamp
      }
    })

    this.isOpen.set(true)

    this.telemetry.trackOpenInMiniBrowser('page', opts?.from)
  }

  show() {
    this.isOpen.set(true)
  }

  hide() {
    this.isOpen.set(false)
  }

  close() {
    this.selected.set(null)
    this.isOpen.set(false)
  }

  static provide(resourceManager: ResourceManager, key = MINI_BROWSER_CONTEXT_KEY) {
    const miniBrowserService = new MiniBrowser(key, resourceManager)

    setContext(key, miniBrowserService)

    return miniBrowserService
  }

  static use(key = MINI_BROWSER_CONTEXT_KEY) {
    const miniBrowserService = getContext<MiniBrowser | null>(key)

    if (!miniBrowserService) {
      throw new Error('MiniBrowser not provided')
    }

    return miniBrowserService
  }
}

export class MiniBrowserService {
  private log: ReturnType<typeof useLogScope>
  private resourceManager: ResourceManager

  globalBrowser: MiniBrowser
  scopedBrowsers: Writable<{ [key: string]: MiniBrowser }>

  isOpen: Readable<boolean>
  openScopedBrowsers: Readable<string[]>

  constructor(resourceManager: ResourceManager) {
    this.log = useLogScope('MiniBrowser')
    this.resourceManager = resourceManager

    this.globalBrowser = MiniBrowser.provide(resourceManager)
    this.scopedBrowsers = writable({})

    this.isOpen = derived(this.globalBrowser.isOpen, ($isOpen) => $isOpen)
    this.openScopedBrowsers = derived(this.scopedBrowsers, ($scopedBrowsers) => {
      return Object.keys($scopedBrowsers).filter((key) => get($scopedBrowsers[key].isOpen))
    })
  }

  createScopedBrowser(scope: string) {
    const key = `${MINI_BROWSER_CONTEXT_KEY}-${scope}`
    const miniBrowser = MiniBrowser.provide(this.resourceManager, key)

    this.scopedBrowsers.update((browsers) => {
      browsers[key] = miniBrowser
      return browsers
    })

    return miniBrowser
  }

  // return the scoped browser, if it doesn't yet exist throw an error if errorIfNotFound is true, otherwise return null
  useScopedBrowser(scope: string, errorIfNotFound?: true): MiniBrowser
  useScopedBrowser(scope: string, errorIfNotFound?: false): MiniBrowser | null
  useScopedBrowser(scope: string, errorIfNotFound = true): MiniBrowser | null {
    const key = `${MINI_BROWSER_CONTEXT_KEY}-${scope}`
    const miniBrowser = get(this.scopedBrowsers)[key]

    if (!miniBrowser) {
      if (!errorIfNotFound) {
        return null
      }

      throw new Error(`Scoped MiniBrowser not found: ${scope}`)
    }

    return miniBrowser
  }

  destroyScopedBrowser(scope: string) {
    const key = `${MINI_BROWSER_CONTEXT_KEY}-${scope}`
    this.scopedBrowsers.update((browsers) => {
      delete browsers[key]
      return browsers
    })
  }

  // return a derived store with the scoped browser, if it doesn't yet exist return null but listen for changes
  useScopedBrowserAsStore(scope: string) {
    const key = `${MINI_BROWSER_CONTEXT_KEY}-${scope}`

    return derived(this.scopedBrowsers, ($scopedBrowsers) => {
      if ($scopedBrowsers[key]) {
        return $scopedBrowsers[key]
      }

      return null
    })
  }

  static provide(resourceManager: ResourceManager) {
    const service = new MiniBrowserService(resourceManager)

    setContext(MINI_BROWSER_SERVICE_CONTEXT_KEY, service)

    return service
  }

  static use() {
    const service = getContext<MiniBrowserService | null>(MINI_BROWSER_SERVICE_CONTEXT_KEY)

    if (!service) {
      throw new Error('MiniBrowserService not provided')
    }

    return service
  }

  static useScopedBrowser(scope: string) {
    return MiniBrowserService.use().useScopedBrowser(scope)
  }

  static useScopedMiniBrowserAsStore(scope: string) {
    return MiniBrowserService.use().useScopedBrowserAsStore(scope)
  }
}

export const createMiniBrowserService = MiniBrowserService.provide
export const useMiniBrowserService = MiniBrowserService.use
export const useGlobalMiniBrowser = () => MiniBrowserService.use().globalBrowser
export const useScopedMiniBrowser = MiniBrowserService.useScopedBrowser
export const useScopedMiniBrowserAsStore = MiniBrowserService.useScopedMiniBrowserAsStore
