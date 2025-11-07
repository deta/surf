import { useLogScope } from '@deta/utils/io'

import { Resource, ResourceNote, useResourceManager } from '../resources'
import { useViewManager, WebContentsView } from '../views'
import { type CreateTabOptions, type TabItem, TabsServiceEmitterNames, useTabs } from '../tabs'
import { formatAIQueryToTitle } from './utils'
import { MentionItemType, type MentionItem } from '@deta/editor'
import {
  type AIChatMessageSource,
  type CitationClickEvent,
  type Fn,
  isWebResourceType,
  type NavigateURLOptions,
  NotebookDefaults,
  type OpenResourceOptions,
  type OpenTarget,
  ResourceTagsBuiltInKeys,
  ResourceTypes
} from '@deta/types'
import { useNotebookManager } from '../notebooks'
import { ViewManagerEmitterNames, ViewType } from '../views/types'
import { type AIQueryPayload, useMessagePortPrimary } from '../messagePort'
import {
  DEFAULT_SEARCH_ENGINE,
  getFormattedDate,
  isDev,
  isOffline,
  parseStringIntoBrowserLocation,
  parseStringIntoUrl,
  ResourceTag,
  SEARCH_ENGINES,
  SearchResourceTags,
  wait
} from '@deta/utils'
import { useConfig } from '../config'
import type { NewWindowRequest, OpenURL } from '../ipc/events'
import { useAI } from '../ai'
import { extractAndCreateWebResource } from '../mediaImporter'

export class BrowserService {
  private readonly resourceManager = useResourceManager()
  private readonly viewManager = useViewManager()
  private readonly tabsManager = useTabs()
  private readonly notebookManager = useNotebookManager()
  private readonly config = useConfig()
  private readonly ai = useAI()
  private readonly messagePort = useMessagePortPrimary()
  private readonly log = useLogScope('BrowserService')

  private _unsubs: Fn[] = []
  private newNoteView: WebContentsView | null = null

  static self: BrowserService

  constructor() {
    this.attachListeners()
    this.prepareNewEmptyNoteView()

    if (isDev) {
      // @ts-ignore
      window.browser = this
    }
  }

  attachListeners() {
    this._unsubs.push(
      this.viewManager.on(ViewManagerEmitterNames.NEW_WINDOW_REQUEST, (details) => {
        this.handleNewWindowRequest(details)
      }),

      this.viewManager.on(ViewManagerEmitterNames.SIDEBAR_CHANGE, (isOpen, view) => {
        this.handleSidebarChange(isOpen, view)
      }),

      this.tabsManager.on(TabsServiceEmitterNames.ACTIVATED, (tab) => {
        this.handleActiveTabChange(tab)
      }),

      this.messagePort.openResource.on(
        async ({ resourceId, target, offline, from_notebook_tree_sidebar }, viewId) => {
          if (target === 'auto') {
            target = await this.getViewOpenTarget(viewId, {
              rerouteOnboarding: true,
              from_notebook_tree_sidebar
            })
          }
          this.openResource(resourceId, { target, offline })
        }
      ),

      this.messagePort.openNotebook.on(
        async ({ notebookId, target, from_notebook_tree_sidebar }, viewId) => {
          if (target === 'auto') {
            target = await this.getViewOpenTarget(viewId, { from_notebook_tree_sidebar })
          }

          this.navigateToUrl(`surf://surf/notebook/${notebookId}`, { target })
        }
      ),

      this.messagePort.navigateURL.on(async ({ url, target }, viewId) => {
        this.handleTeletypeNavigateURL(url, target, viewId)
      }),

      this.messagePort.citationClick.on(async (data, viewId) => {
        this.handleCitationClick(data, viewId)
      }),

      this.messagePort.createNote.on(
        async ({ name, content, target, notebookId, isNewTabPage }, viewId) => {
          if (!target) {
            target = this.getViewLocation(viewId) ?? 'tab'
          }

          if (isNewTabPage && target === 'tab') {
            target = 'active_tab'
          }

          this.log.debug(`Creating note from ${viewId} in ${target}:`, content)

          await this.createAndOpenNote(
            { name, content },
            {
              target: target,
              notebookId: notebookId ?? 'auto'
            }
          )

          if (isNewTabPage && target === 'sidebar') {
            this.closeNewTab()
          }
        }
      )
    )
  }

  handleNewWindowRequest(details: NewWindowRequest) {
    this.log.debug('New window request received', details)

    if (details.disposition === 'new-window') {
      this.viewManager.openURLInSidebar(details.url)
      return
    }

    const active = details.disposition !== 'background-tab'
    this.tabsManager.create(details.url, {
      active,
      activate: true
    })
  }

  handleOpenURLRequest(details: OpenURL) {
    this.log.debug('Open URL request received', details)
    this.tabsManager.create(details.url, {
      active: details.active,
      activate: true
    })
  }

  handleSidebarChange(isOpen: boolean, view?: WebContentsView) {
    this.log.debug('Sidebar state changed, isOpen:', isOpen, 'view:', view?.id)
    if (!isOpen) {
      const activeTab = this.tabsManager.activeTabValue

      this.log.debug('Focusing active tab after sidebar closed', activeTab)
      activeTab?.view.webContents?.focus()
    }
  }

  async handleActiveTabChange(tab: TabItem) {
    this.log.debug('Active tab changed:', tab)
    if (
      this.viewManager.sidebarViewOpen &&
      this.viewManager.activeSidebarView?.typeValue &&
      [ViewType.Resource, ViewType.NotebookHome, ViewType.Notebook].includes(
        this.viewManager.activeSidebarView?.typeValue
      )
    ) {
      this.messagePort.activeTabChanged.send(this.viewManager.activeSidebarView.id, {
        tabId: tab.id,
        url: tab.view.urlValue ?? ''
      })
    }
  }

  async handleCitationClick(data: CitationClickEvent, viewId: string) {
    this.log.debug('Citation click event received', data, viewId)
    try {
      let resourceId = data.resourceId
      let url = data.url
      const resourceSource = await this.getCitationSourceAndResource(
        data.resourceId,
        data.selection?.source,
        data.selection?.sourceUid
      )
      if (resourceSource?.resourceId) {
        resourceId = resourceSource.resourceId
      }

      if (resourceSource?.source?.metadata?.url) {
        url = resourceSource.source.metadata.url
      }

      if (data.preview === 'auto') {
        data.preview = await this.getViewOpenTarget(viewId)
      }

      this.log.debug('Determined citation open target:', data.preview)

      if (resourceId) {
        const resource = await this.resourceManager.getResource(resourceId)
        if (resource?.type === ResourceTypes.PDF) {
          const pdfUrl = `surf://surf/resource/${resource.id}?raw`
          if (resource.url) {
            const tab = this.tabsManager.findTabByURL(resource.url)
            if (tab) {
              url = resource.url
            } else {
              url = pdfUrl
            }
          } else {
            url = pdfUrl
          }
        } else if (resource?.url) {
          url = resource.url
        } else if (resource) {
          url = `surf://surf/resource/${resource.id}`
        } else {
          this.log.error('Citation click event has invalid resourceId:', resourceId)
        }
      }

      if (!url) {
        this.log.error('Citation click event has no URL or resourceId:', data)
        return
      }

      if (data.preview === 'background_tab') {
        this.log.debug('Citation preview click event, opening in new background tab')
        await this.tabsManager.openOrCreate(
          url,
          {
            active: false,
            activate: true,
            ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
          },
          true
        )
      } else if (data.preview === 'sidebar') {
        this.log.debug('Opening citation in sidebar')
        const view = this.viewManager.openURLInSidebar(url)
        if (!data.skipHighlight && data.selection) {
          await view.highlightSelection(data.selection)
        }
      } else if (data.preview === 'active_tab') {
        this.log.debug('Citation click event, opening in active tab')
        this.tabsManager.changeActiveTabURL(url, {
          active: true,
          ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
        })
      } else {
        this.log.debug('Citation preview click event, opening in new active tab')
        await this.tabsManager.openOrCreate(
          url,
          {
            active: true,
            activate: true,
            ...(data.skipHighlight ? {} : { selectionHighlight: data.selection })
          },
          true
        )
      }
    } catch (err) {
      this.log.error('Failed to handle citation click event:', err)
    }
  }

  async handleTeletypeAsk(payload: AIQueryPayload, viewId: string) {
    try {
      const target = this.getViewLocation(viewId) ?? 'tab'

      const view = this.viewManager.getViewById(viewId)
      if (!view) {
        this.log.warn('View not found for ask action:', viewId)
        return
      }

      let notebookId: string | null = null

      const { type, id } = view.typeDataValue

      // 'drafts' is special and should be treated as no notebook
      if (type === ViewType.Notebook && id && id !== 'drafts') {
        notebookId = id
      }

      this.log.debug(`Asking question from ${viewId} in ${target}:`, payload, notebookId)

      if (payload.openTabUrl) {
        this.log.debug('Ask action has openTabUrl, opening URL first:', payload.openTabUrl)
        await this.navigateToUrl(payload.openTabUrl, { target: 'tab' })
        payload.mentions.unshift({
          id: 'active_tab',
          label: 'Active Tab',
          type: MentionItemType.ACTIVE_TAB,
          icon: 'sparkles'
        })
      }

      if (payload.mentions.length === 1) {
        payload.mentions[0] = {
          ...payload.mentions[0],
          data: {
            insertIntoEditor: true
          }
        }
      }

      payload.mentions.forEach((mention) => {
        payload.query = payload.query.replace(`@${mention.label}`, '').trim()
      })

      // if (target === 'sidebar' && mentions.length === 0) {
      //   this.log.debug('No mentions in sidebar, adding active tab mention')
      //   mentions.push({
      //     id: 'active_tab',
      //     label: 'Active Tab',
      //     type: MentionItemType.ACTIVE_TAB,
      //     icon: 'sparkles'
      //   })
      // }

      if (notebookId) {
        const notebook = await this.notebookManager.getNotebook(notebookId)
        if (notebook) {
          payload.mentions.push({
            id: notebookId,
            label: notebook.nameValue,
            type: MentionItemType.NOTEBOOK,
            data: {
              insertIntoEditor: true
            },
            icon: 'note'
          })
        }
      }

      await this.createNoteAndRunAIQuery(payload, {
        target: payload.openTabUrl ? 'sidebar' : target === 'tab' ? 'active_tab' : target,
        notebookId: notebookId ?? 'auto'
      })

      this.closeNewTab()
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }

  async handleTeletypeNavigateURL(
    url: string,
    target: NavigateURLOptions['target'],
    viewId?: string
  ) {
    if (target === 'auto') {
      target = viewId ? await this.getViewOpenTarget(viewId) : 'tab'
    }

    this.navigateToUrl(url, { target })
  }

  async getCitationSourceAndResource(
    resourceId?: string,
    source?: AIChatMessageSource,
    sourceUid?: string
  ) {
    if (!source && sourceUid) {
      const fetchedSource = await this.resourceManager.sffs.getAIChatDataSource(sourceUid)
      source = fetchedSource ?? undefined

      if (!resourceId && fetchedSource?.resource_id) {
        const resource = await this.resourceManager.getResource(fetchedSource.resource_id)
        if (resource) {
          resourceId = fetchedSource.resource_id
        }
      }
    }

    if (!resourceId && source?.metadata?.url) {
      this.log.debug(
        'no resource id provided, searching for existing resource with the same url',
        source.metadata.url
      )
      const matchingResources = await this.resourceManager.getResourcesFromSourceURL(
        source.metadata.url,
        [
          SearchResourceTags.ResourceType(ResourceTypes.ANNOTATION, 'ne'),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne')
        ]
      )

      if (matchingResources.length > 0) {
        this.log.debug('found existing resource with the same url', matchingResources[0])
        resourceId = matchingResources[0].id
      }
    }

    if (!source) {
      this.log.error('no source provided', sourceUid)
      return null
    }

    return { resourceId, source }
  }

  async prepareNewEmptyNoteView() {
    try {
      this.log.debug('Preparing new note view')

      const existingResources = await this.resourceManager.listResourcesByTags([
        SearchResourceTags.Deleted(false),
        SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE),
        SearchResourceTags.PreloadedResource(true)
      ])

      this.log.debug('Found existing preloaded resources:', existingResources)

      let resource: ResourceNote | null = null

      if (existingResources.length > 0) {
        resource = existingResources[0] as ResourceNote
      } else {
        resource = await this.resourceManager.createResourceNote(
          '',
          {
            name: 'Untitled Note'
          },
          [ResourceTag.preloadedResource(), ResourceTag.emptyResource()]
        )
      }

      this.newNoteView = await this.viewManager.create(
        {
          url: `surf://surf/resource/${resource.id}`,
          permanentlyActive: true
        },
        true
      )
      await this.newNoteView.preloadWebContents({ activate: false })
    } catch (error) {
      this.log.error('Error preparing new note view:', error)
    }
  }

  async reuseNoteViewIfPossible(
    data?: {
      name?: string
      content?: string
    },
    opts?: {
      target?: OpenTarget
      notebookId?: string | 'auto'
    }
  ) {
    try {
      const target = opts?.target || 'sidebar'
      const { content, name } = data || {}

      const view = this.newNoteView

      if (!view || !view.typeDataValue.id) {
        this.log.debug('No preloaded new note view available')
        return null
      }

      const id = view.typeDataValue.id
      this.log.debug('Using preloaded new note view', id)

      const resource = await this.resourceManager.getResource(id)
      if (!resource) {
        this.log.error('Failed to get resource for preloaded new note view', id)
        this.newNoteView = null
        return null
      }

      // Make sure this view and resource are not used again
      await this.resourceManager.deleteResourceTag(id, ResourceTagsBuiltInKeys.PRELOADED_RESOURCE)
      this.newNoteView = null

      if (name) {
        try {
          this.log.debug('Updating name of preloaded new note view resource', id, name)
          await this.resourceManager.updateResourceMetadata(id, {
            name: name
          })
        } catch (error) {
          this.log.error('Failed to update name of preloaded new note view resource', id, error)
        }
      }

      if (content && resource instanceof ResourceNote) {
        try {
          this.log.debug('Updating content of preloaded new note view resource', id)
          await resource.updateContent(content)
          view.webContents?.triggerRefreshNoteContent()
        } catch (error) {
          this.log.error('Failed to update content of preloaded new note view resource', id, error)
        }
      }

      if (opts?.notebookId && opts.notebookId !== 'drafts') {
        this.log.debug(`Adding note to notebook ${opts.notebookId}`)
        await this.notebookManager.addResourcesToNotebook(opts.notebookId, [resource.id])
      }

      if (opts?.target !== 'sidebar') {
        view.changePermanentlyActive(false)
      }

      this.log.debug('Opening preloaded new note view in', target)
      await this.openView(view, { target })

      // prepare the next new note view
      setTimeout(() => this.prepareNewEmptyNoteView(), 100)

      return view
    } catch (error) {
      this.log.error('Error reusing new note view:', error)
      return null
    }
  }

  async createAndOpenNote(
    data?: {
      name?: string
      content?: string
    },
    opts?: {
      target?: OpenTarget
      notebookId?: string | 'auto'
    }
  ) {
    try {
      const target = opts?.target || 'sidebar'
      let { content, name } = data || {}

      if (!name) {
        name = NotebookDefaults.NOTE_DEFAULT_NAME
      }

      this.log.debug(`Creating note in ${target} with content: "${content}"`)

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

      const reusedNoteView = await this.reuseNoteViewIfPossible(data, opts)
      if (reusedNoteView) {
        this.log.debug('Reused existing new note view')
        return reusedNoteView
      }

      const note = await this.resourceManager.createResourceNote(
        content ?? '',
        {
          name
        },
        undefined,
        true
      )

      if (opts?.notebookId && opts.notebookId !== 'drafts') {
        this.log.debug(`Adding created note to notebook ${opts.notebookId}`)
        await this.notebookManager.addResourcesToNotebook(opts.notebookId, [note.id])
      }

      const view = await this.openResource(note.id, {
        target
      })

      if (!view) {
        this.log.error('Failed to open created note view')
        return null
      }

      await view.waitForNoteReady()

      return view
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }

  async createNoteAndRunAIQuery(
    payload: AIQueryPayload,
    opts?: {
      target?: OpenTarget
      notebookId?: string | 'auto'
    }
  ) {
    try {
      this.log.debug(
        `Triggering ask action in ${opts?.target} for query: "${payload.query}"`,
        payload.mentions,
        payload.tools
      )

      const view = await this.createAndOpenNote({ name: formatAIQueryToTitle(payload.query) }, opts)
      if (!view) {
        this.log.error('Failed to create and open note view')
        return
      }

      let webContents = view.webContents
      if (!webContents) {
        webContents = await view.waitForNoteReady()
        if (!webContents) {
          this.log.error('Failed to wait for web contents to be ready')
          return
        }
      }

      // Make sure to clear existing context to avoid confusion
      this.ai.contextManager.clear()

      await webContents.runNoteQuery(payload)
    } catch (error) {
      this.log.error('Failed to trigger ask action:', error)
    }
  }

  async closeNewTab() {
    if (
      this.tabsManager.activeTabValue?.view.typeValue === ViewType.NotebookHome &&
      this.tabsManager.activeTabIdValue
    ) {
      this.tabsManager.delete(this.tabsManager.activeTabIdValue)
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
      return this.tabsManager.changeActiveTabURL(`surf://surf/resource/${resource.id}`)
    }
  }

  async openNotebookInCurrentTab(notebookId: string) {
    return this.tabsManager.changeActiveTabURL(`surf://surf/notebook/${notebookId}`)
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

    let url: string | null = null

    if (offline || !resource.url || !isWebResourceType(resource.type)) {
      url =
        `surf://surf/resource/${resource.id}` + (resource.type === ResourceTypes.PDF ? '?raw' : '')
    } else {
      url = resource.url
    }

    if (target === 'sidebar') {
      return this.viewManager.openURLInSidebar(url)
    } else if (target === 'active_tab') {
      const tab = await this.tabsManager.changeActiveTabURL(url)
      return tab?.view
    } else {
      const tab = await this.tabsManager.create(url, {
        active: target === 'tab',
        activate: true
      })

      return tab.view
    }
  }

  async openView(view: WebContentsView, opts?: { target?: OpenResourceOptions['target'] }) {
    this.log.debug('Opening resource:', view.id, opts)

    const target = opts?.target ?? 'tab'

    if (target === 'sidebar') {
      return this.viewManager.openViewInSidebar(view)
    } else if (target === 'active_tab') {
      const activeTabId = this.tabsManager.activeTabIdValue
      const tab = await this.tabsManager.createWithView(view, {
        active: true,
        activate: true
      })

      if (activeTabId) {
        await this.tabsManager.delete(activeTabId)
      }

      return tab?.view
    } else {
      const tab = await this.tabsManager.createWithView(view, {
        active: target === 'tab',
        activate: true
      })

      return tab.view
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
      const tab = await this.tabsManager.create(url, { active: target === 'tab', activate: true })
      return tab?.view
    }
  }

  async navigateToWebSearch(query: string, opts?: { target?: NavigateURLOptions['target'] }) {
    this.log.debug('Navigating to web search:', query, opts)
    const url = this.getSearchUrl(query)
    return this.navigateToUrl(url, opts)
  }

  async replaceActiveTabUrl(rawUrl: string) {
    this.log.debug('Replacing active tab URL with:', rawUrl)
    let url = parseStringIntoBrowserLocation(rawUrl)
    if (!url) {
      url = this.getSearchUrl(rawUrl)
    }

    const tab = await this.tabsManager.changeActiveTabURL(url)
    return tab?.view
  }

  async openAskInSidebar() {
    this.navigateToUrl(`surf://surf/notebook?mention_active_tab=true`, { target: 'sidebar' })
  }

  /**
   * For a given viewId, determine the current location of the view: 'tab' or 'sidebar'.
   */
  getViewLocation(viewId: string) {
    if (this.viewManager.activeSidebarView?.id === viewId) {
      return 'sidebar'
    } else if (this.tabsManager.activeTabValue?.view.id === viewId) {
      return 'tab'
    } else {
      const tab = this.tabsManager.getTabByViewId(viewId)
      return tab ? 'tab' : null
    }
  }

  async getViewOpenTarget(
    viewId: string,
    opts: { rerouteOnboarding: boolean; from_notebook_tree_sidebar: boolean } = {
      rerouteOnboarding: false,
      from_notebook_tree_sidebar: false
    }
  ) {
    const view = this.viewManager.getViewById(viewId)
    const viewTypeData = view?.typeDataValue
    const viewLocation = this.getViewLocation(viewId) ?? 'tab'

    this.log.debug('Determining open target for view', viewId, viewTypeData, viewLocation)

    if (viewTypeData?.type === ViewType.Resource) {
      if (viewLocation === 'sidebar') {
        if (opts.from_notebook_tree_sidebar) {
          return 'sidebar'
        }
        return 'tab'
      } else if (viewLocation === 'tab') {
        if (opts.from_notebook_tree_sidebar) {
          return 'active_tab'
        }

        // when you click a resource link in the onboarding note we want to open it in the same tab
        if (opts.rerouteOnboarding) {
          const resource = await this.resourceManager.getResource(viewTypeData.id || '')
          if (
            (resource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.ONBOARDING)
          ) {
            return 'active_tab'
          }
        }

        return 'sidebar'
      }
    } else if (
      viewTypeData?.type === ViewType.NotebookHome ||
      viewTypeData?.type === ViewType.Notebook
    ) {
      if (viewLocation === 'sidebar') {
        return 'sidebar'
      } else if (viewLocation === 'tab') {
        return 'active_tab'
      }
    }

    return viewLocation
  }

  async cloneAndOpenView(
    view: WebContentsView,
    opts?: { historyOffset?: number; target?: OpenResourceOptions['target'] }
  ) {
    this.log.debug('Opening clone of view:', view.id, opts)

    const navigationEntries = view.navigationHistoryValue
    const navigationIndex = view.navigationHistoryIndexValue

    this.log.debug('View navigation history:', navigationEntries, navigationIndex)

    const newHistoryIndex = Math.min(
      Math.max(0, navigationIndex + (opts?.historyOffset ?? 0)),
      navigationEntries.length - 1
    )
    const newNavigationEntry = navigationEntries[newHistoryIndex]

    this.log.debug('Target view navigation entry:', newNavigationEntry, newHistoryIndex)
    if (!newNavigationEntry) {
      this.log.error('No navigation entry found for cloned view')
      return null
    }

    const newView = await this.viewManager.create(
      {
        url: newNavigationEntry.url,
        navigationHistory: navigationEntries,
        navigationHistoryIndex: newHistoryIndex
      },
      true
    )

    return this.openView(newView, opts)
  }

  async saveLink(rawUrl: string, notebookId?: string) {
    try {
      const url = parseStringIntoUrl(rawUrl)
      if (!url) {
        this.log.error('Invalid URL', rawUrl)
        return
      }

      const { resource } = await extractAndCreateWebResource(
        this.resourceManager,
        url.href,
        undefined,
        [ResourceTag.rightClickSave()]
      )

      if (notebookId) {
        await this.notebookManager.addResourcesToNotebook(notebookId, [resource.id])
      }
    } catch (err) {
      this.log.error('Failed to save link', err)
    }
  }

  onDestroy() {
    this._unsubs.forEach((unsub) => unsub())

    if (this.newNoteView) {
      this.newNoteView.destroy()
      this.newNoteView = null
    }
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
