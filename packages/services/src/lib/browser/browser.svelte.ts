import { useLogScope } from '@deta/utils/io'

import { Resource, useResourceManager } from '../resources'
import { useViewManager, WebContentsView } from '../views'
import { type CreateTabOptions, type TabItem, useTabs } from '../tabs'
import { formatAIQueryToTitle } from './utils'
import { type MentionItem } from '@deta/editor'
import {
  type Fn,
  type NavigateURLOptions,
  type OpenResourceOptions,
  ResourceTagsBuiltInKeys,
  ResourceTypes
} from '@deta/types'
import { useNotebookManager } from '../notebooks'
import { ViewType } from '../views/types'
import { useMessagePortPrimary } from '../messagePort'
import {
  DEFAULT_SEARCH_ENGINE,
  isOffline,
  parseStringIntoBrowserLocation,
  SEARCH_ENGINES
} from '@deta/utils'
import { useConfig } from '../config'

export class BrowserService {
  private readonly resourceManager = useResourceManager()
  private readonly viewManager = useViewManager()
  private readonly tabsManager = useTabs()
  private readonly notebookManager = useNotebookManager()
  private readonly config = useConfig()
  private readonly messagePort = useMessagePortPrimary()
  private readonly log = useLogScope('BrowserService')

  private _unsubs: Fn[] = []

  static self: BrowserService

  constructor() {
    this.attachListeners()
  }

  attachListeners() {
    this._unsubs.push(
      this.messagePort.openResource.on(async ({ resourceId, target, offline }) => {
        this.openResource(resourceId, { target, offline })
      }),

      this.messagePort.navigateURL.on(async ({ url, target }) => {
        this.navigateToUrl(url, { target })
      }),

      this.messagePort.citationClick.on(async (data, viewId) => {
        const url = data.url ?? (data.resourceId ? `surf://resource/${data.resourceId}` : undefined)
        if (!url) {
          this.log.error('Citation click event has no URL or resourceId:', data)
          return
        }

        // Otherwise, open in a new tab to not disturb the user's current context
        if (data.preview === 'background_tab' || data.preview === 'tab') {
          this.log.debug('Citation preview click event, opening in new tab')
          this.tabsManager.openOrCreate(url, {
            active: data.preview === 'tab',
            activate: true,
            ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
          })

          return
        }

        // If we click was triggered from the active tab, open in sidebar (if sidebar is closed or showing NotebookHome)
        if (this.tabsManager.activeTabValue?.view.id === viewId) {
          this.log.debug('Citation preview click event from active tab')

          if (
            !this.viewManager.sidebarViewOpen ||
            this.viewManager.activeSidebarView?.typeValue !== ViewType.Resource
          ) {
            this.log.debug('Opening citation in sidebar')
            if (data.url) {
              const view = this.viewManager.openURLInSidebar(data.url)
              if (!data.skipHighlight && data.selection) {
                view.highlightSelection(data.selection)
              }
            } else if (data.resourceId) {
              const view = this.viewManager.openResourceInSidebar(data.resourceId)
              if (!data.skipHighlight && data.selection) {
                view.highlightSelection(data.selection)
              }
            }
          } else {
            this.log.debug('Opening citation in new tab')
            this.tabsManager.openOrCreate(url, {
              active: true,
              ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
            })
          }

          return
        }

        // For clicks from the sidebar, open in active tab
        if (this.viewManager.activeSidebarView?.id === viewId) {
          this.log.debug('Citation click event from active sidebar view')

          this.tabsManager.openOrCreate(url, {
            active: true,
            ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
          })

          // const view = this.viewManager.openURLInSidebar(url)
          // if (!data.skipHighlight && data.selection) {
          //   view.highlightSelection(data.selection)
          // }

          return
        }

        // For normal clicks, replace the active view
        this.log.debug('Citation click event, opening in active tab')
        this.tabsManager.changeActiveTabURL(url, {
          active: true,
          ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
        })
      })
    )
  }

  async createNoteAndRunAIQuery(
    query: string,
    mentions: MentionItem[],
    opts?: {
      target?: 'tab' | 'sidebar'
      notebookId?: string | 'auto'
    }
  ) {
    try {
      const target = opts?.target || 'sidebar'

      this.log.debug(`Triggering ask action in ${target} for query: "${query}"`)

      const note = await this.resourceManager.createResourceNote('', {
        name: formatAIQueryToTitle(query)
      })

      if (opts?.notebookId === 'auto') {
        if (this.tabsManager.activeTabValue?.view.typeValue === ViewType.Notebook) {
          const viewData = this.tabsManager.activeTabValue.view.typeDataValue
          if (viewData.id) {
            opts.notebookId = viewData.id
          } else {
            opts.notebookId = undefined
          }
        } else {
          opts.notebookId = undefined
        }
      }

      if (opts?.notebookId) {
        this.log.debug(`Adding created note to notebook ${opts.notebookId}`)
        await this.notebookManager.addResourcesToNotebook(opts.notebookId, [note.id])
      }

      let view: WebContentsView
      if (target === 'sidebar') {
        if (
          this.tabsManager.activeTabValue?.view.typeValue === ViewType.NotebookHome &&
          this.tabsManager.activeTabIdValue
        ) {
          this.tabsManager.delete(this.tabsManager.activeTabIdValue)
        }

        view = this.viewManager.openResourceInSidebar(note.id)
      } else {
        const tab = await this.tabsManager.changeActiveTabURL(`surf://resource/${note.id}`)

        if (!tab) {
          this.log.error('Failed to change active tab URL')
          return
        }

        view = tab.view
      }

      const webContents = await view.waitForNoteReady()
      if (!webContents) {
        this.log.error('Failed to wait for web contents to be ready')
        return
      }

      await webContents.runNoteQuery(query, mentions)
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }

  async moveSidebarViewToTab() {
    const view = this.viewManager.activeSidebarView
    if (!view) {
      this.log.error('No active sidebar view to move')
      return
    }

    view.preventUnmountingUntilNextMount()
    view.changePermanentlyActive(false)

    this.viewManager.setSidebarState({ open: false, view: null })
    await this.tabsManager.createWithView(view, { active: true })
  }

  async moveTabToSidebar(tab: TabItem) {
    const view = tab.view

    view.preventUnmountingUntilNextMount()
    view.changePermanentlyActive(true)

    await this.tabsManager.delete(tab.id)
    this.viewManager.setSidebarState({ open: true, view })
  }

  async openResourceAsTab(resource: Resource, opts?: Partial<CreateTabOptions>) {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

    if (url) {
      await this.tabsManager.create(url, opts)
    } else {
      await this.tabsManager.createResourceTab(resource.id, opts)
    }
  }

  async openResourceInCurrentTab(resource: Resource) {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

    if (url) {
      return this.tabsManager.changeActiveTabURL(url)
    } else {
      return this.tabsManager.changeActiveTabURL(`surf://resource/${resource.id}`)
    }
  }

  async openResource(
    resourceId: string,
    opts?: { target?: OpenResourceOptions['target']; offline?: boolean }
  ) {
    this.log.debug('Opening resource:', resourceId, opts)

    const resource = await this.resourceManager.getResource(resourceId)
    if (!resource) {
      this.log.error('Resource not found:', resourceId)
      return
    }

    const target = opts?.target ?? 'tab'
    const offline = opts?.offline ?? isOffline()

    if (offline || resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE || !resource.url) {
      if (target === 'sidebar') {
        return this.viewManager.openResourceInSidebar(resource.id)
      } else if (target === 'active_tab') {
        const tab = await this.openResourceInCurrentTab(resource)
        return tab?.view
      } else {
        const tab = await this.tabsManager.createResourceTab(resource.id, {
          active: target === 'tab'
        })

        return tab.view
      }
    } else {
      if (target === 'sidebar') {
        return this.viewManager.openURLInSidebar(resource.url)
      } else if (target === 'active_tab') {
        const tab = await this.tabsManager.changeActiveTabURL(resource.url)
        return tab?.view
      } else {
        const tab = await this.tabsManager.create(resource.url, {
          active: target === 'tab'
        })

        return tab.view
      }
    }
  }

  getSearchUrl(query: string): string {
    const defaultSearchEngine =
      SEARCH_ENGINES.find((e) => e.key === this.config.settingsValue.search_engine) ??
      SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)

    if (!defaultSearchEngine)
      throw new Error('No search engine / default engine found, config error?')

    this.log.debug('Using configured search engine', defaultSearchEngine.key)

    const searchURL = defaultSearchEngine.getUrl(encodeURIComponent(query))
    return searchURL
  }

  async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const defaultSearchEngine =
        SEARCH_ENGINES.find((e) => e.key === this.config.settingsValue.search_engine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)

      if (!defaultSearchEngine)
        throw new Error('No search engine / default engine found, config error?')

      if (defaultSearchEngine.getCompletions) {
        this.log.debug('Fetching search suggestions from', defaultSearchEngine.key)
        const suggestions = await defaultSearchEngine.getCompletions(query)
        return suggestions
      } else {
        this.log.debug(
          'Search engine does not support suggestions:',
          defaultSearchEngine.key,
          'using fallback'
        )

        const fallbackSearchEngine = SEARCH_ENGINES.find((e) => e.key === 'google')
        if (!fallbackSearchEngine || !fallbackSearchEngine.getCompletions) {
          this.log.error(
            'Fallback search engine does not support suggestions, returning empty list'
          )
          return []
        }

        const suggestions = await fallbackSearchEngine.getCompletions(query)
        return suggestions
      }
    } catch (error) {
      this.log.error('Error fetching search suggestions:', error)
      return []
    }
  }

  async navigateToUrl(rawUrl: string, opts?: { target?: NavigateURLOptions['target'] }) {
    this.log.debug('Navigating to URL:', rawUrl, opts)
    const target = opts?.target ?? 'tab'

    let url = parseStringIntoBrowserLocation(rawUrl)
    if (!url) {
      url = this.getSearchUrl(rawUrl)
    }

    if (target === 'sidebar') {
      return this.viewManager.openURLInSidebar(url)
    } else if (target === 'active_tab') {
      const tab = await this.tabsManager.changeActiveTabURL(url)
      return tab?.view
    } else {
      const tab = await this.tabsManager.create(url, { active: target === 'tab' })
      return tab?.view
    }
  }

  async navigateToWebSearch(query: string, opts?: { target?: NavigateURLOptions['target'] }) {
    this.log.debug('Navigating to web search:', query, opts)
    const url = this.getSearchUrl(query)
    return this.navigateToUrl(url, opts)
  }

  onDestroy() {
    this._unsubs.forEach((unsub) => unsub())
  }

  static provide() {
    BrowserService.self = new BrowserService()
    return BrowserService.self
  }

  static use() {
    if (!BrowserService.self) {
      BrowserService.self = new BrowserService()
    }

    return BrowserService.self
  }
}

export const createBrowser = () => BrowserService.provide()
export const useBrowser = () => BrowserService.use()
