import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  WebContentsViewActionType,
  type WebContentsViewData,
  WebContentsViewManagerActionType,
  type Fn
} from '@deta/types'
import {
  useLogScope,
  EventEmitterBase,
  generateID,
  isDev,
  parseUrlIntoCanonical
} from '@deta/utils'
import { ConfigService, useConfig } from '../config'
import { KVStore, useKVTable } from '../kv'
import { WebContentsView, type WebContents } from './webContentsView.svelte'
import { ViewManagerEmitterNames, ViewType, type ViewManagerEmitterEvents } from './types'
import type { NewWindowRequest } from '../ipc/events'
import { ResourceManager, useResourceManager } from '../resources'
import { useMessagePortPrimary } from '../messagePort/messagePortEvents'
import { HistoryEntriesManager } from '../history'

export type OverlayState = {
  teletypeOpen: boolean
}

/**
 * Core service responsible for managing all web content views in the application.
 * Coordinates the creation, destruction, and activation of web views, handles
 * view overlays, and manages the visibility state of views.
 *
 * Key responsibilities:
 * - View lifecycle management (create, destroy)
 * - View activation and focus handling
 * - Overlay view management (for features like teletype)
 * - View persistence and state restoration
 * - Coordination with TabsService for browser-like functionality
 *
 * This service implements a singleton pattern and should be accessed via useViewManager().
 */
export class ViewManager extends EventEmitterBase<ViewManagerEmitterEvents> {
  log: ReturnType<typeof useLogScope>
  config: ConfigService
  kv: KVStore<WebContentsViewData>
  resourceManager: ResourceManager
  historyEntriesManager: HistoryEntriesManager
  messagePort: ReturnType<typeof useMessagePortPrimary>

  webContentsViews: Map<string, WebContents> = new Map()
  viewOverlays: Map<string, string> = new Map() // Maps a view to its overlay view if it has one
  overlayState: Writable<OverlayState>

  activeViewId: Writable<string | null>
  shouldHideViews: Readable<boolean>

  sidebarViewOpen = $state(true)
  activeSidebarView = $state() as WebContentsView | null

  views: Writable<WebContentsView[]>

  private unsubs: Fn[] = []
  private newHomepageView: WebContentsView | null = null
  private viewPoolWebPages: WebContentsView[] = [] // Pool of pre-created views for http(s)://
  private viewPoolSurfProtocol: WebContentsView[] = [] // Pool of pre-created views for surf://
  private readonly poolSize = 1 // Number of views to pre-create

  static self: ViewManager

  constructor(resourceManager?: ResourceManager) {
    super()

    this.log = useLogScope('ViewManager')
    this.config = useConfig()
    this.kv = useKVTable<WebContentsViewData>('views')
    this.resourceManager = resourceManager || useResourceManager()
    this.historyEntriesManager = new HistoryEntriesManager()
    this.messagePort = useMessagePortPrimary()

    this.overlayState = writable({
      teletypeOpen: false
    })

    this.activeViewId = writable(null)
    this.views = writable([])

    /*
        derived([this.tabsManager.activeTab], ([$activeTab]) => {
            if ($activeTab?.type === 'page') {
                const view = this.views.get($activeTab.id);
                return view ? view.id : null;
            }

            return null;
        })
        */

    this.shouldHideViews = derived([this.overlayState], ([$overlayState]) => {
      return $overlayState.teletypeOpen
    })

    this.attachListeners()
    this.prepareNewHomepage()
    this.refillPool()

    if (isDev) {
      // @ts-ignore
      window.viewManager = this
    }
  }

  get viewsValue() {
    return get(this.views)
  }

  get webContentsViewsValue() {
    const viewsArray: WebContents[] = []
    this.webContentsViews.forEach((view) => {
      viewsArray.push(view)
    })
    return viewsArray
  }

  get shouldHideViewsValue() {
    return get(this.shouldHideViews)
  }

  get overlayStateValue() {
    return get(this.overlayState)
  }

  get activeViewIdValue() {
    return get(this.activeViewId)
  }

  private attachListeners() {
    this.unsubs.push(
      this.shouldHideViews.subscribe((shouldHide) => {
        this.log.debug('shouldHideViews changed:', shouldHide)
        if (shouldHide) {
          this.hideViews()
        } else {
          this.showViews()
        }
      })
    )

    window.addEventListener('resize', () => this.handleWindowResize(), { passive: true })
    this.unsubs.push(() => {
      window.removeEventListener('resize', () => this.handleWindowResize())
    })

    // @ts-ignore
    // window.api.onMessagePort(({ portId, payload }) => {
    //   if (!portId) {
    //     this.log.error('Received port event without portId:', portId)
    //     return
    //   }

    //   const view = this.getViewById(portId)
    //   if (!view || !view.webContents) {
    //     this.log.error(
    //       'Received port event for non-existent portId or view without webContents:',
    //       portId
    //     )
    //     return
    //   }

    //   this.log.debug('Attaching message port to WebContentsView:', portId)
    //   view.webContents.handleMessagePortMessage(payload)
    // })
  }

  private async refillPool(type?: 'web' | 'surf') {
    if (!type) {
      await Promise.all([this.refillPool('web'), this.refillPool('surf')])

      return
    }

    this.log.debug('Refilling view pool', type)
    const viewPool = type === 'surf' ? this.viewPoolSurfProtocol : this.viewPoolWebPages
    const needed = this.poolSize - viewPool.length

    if (needed <= 0) return

    for (let i = 0; i < needed; i++) {
      const fullData = {
        id: generateID(),
        partition: 'persist:horizon',
        url: type === 'surf' ? 'surf://surf/resource/blank' : 'about:blank',
        title: 'New Tab',
        faviconUrl: '',
        navigationHistoryIndex: -1,
        navigationHistory: [],
        permanentlyActive: false,
        extractedResourceId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } satisfies WebContentsViewData

      this.log.debug('Creating WebContentsView with data:', fullData)
      const view = new WebContentsView(fullData, this)

      await view.preloadWebContents({ activate: false })
      viewPool.push(view)
    }
  }

  private reusePooledViewIfPossible(data: WebContentsViewData) {
    if (this.viewPoolWebPages.length === 0 && this.viewPoolSurfProtocol.length === 0) {
      return null
    }

    const url = new URL(data.url)

    let view: WebContentsView | undefined
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      view = this.viewPoolWebPages.pop()
    } else if (url.protocol === 'surf:') {
      view = this.viewPoolSurfProtocol.pop()
    }

    // Use any available pooled view for web pages
    if (!view) {
      return null
    }

    this.log.debug('Found matching pooled WebContentsView:', view)

    if (data.permanentlyActive !== undefined) {
      view.changePermanentlyActive(data.permanentlyActive)
    }

    view.url.set(data.url)
    view.title.set(data.title ?? url.hostname)
    view.detectedApp.set(null)

    view.webContents?.loadURL(data.url)

    // Refill the pool asynchronously
    setTimeout(() => this.refillPool(), 100)

    return view
  }

  handleNewWindowRequest(viewId: string, details: NewWindowRequest) {
    this.log.debug('New window request received', viewId, details)
    this.emit(ViewManagerEmitterNames.NEW_WINDOW_REQUEST, details)
  }

  handleWindowResize() {
    this.emit(ViewManagerEmitterNames.WINDOW_RESIZE)
  }

  async changeOverlayState(changes: Partial<OverlayState>) {
    this.overlayState.update((state) => {
      const newState = { ...state, ...changes }
      return newState
    })
  }

  trackOverlayView(viewId: string, overlayViewId: string) {
    this.viewOverlays.set(viewId, overlayViewId)
  }

  getViewById(viewId: string) {
    const view = this.viewsValue.find((v) => v.id === viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`)
      return null
    }

    return view
  }

  create(data: Partial<WebContentsViewData>, fresh = false) {
    const fullData = {
      id: data.id || generateID(),
      partition: data.partition || 'persist:horizon',
      url: data.url || 'about:blank',
      title: data.title || '',
      faviconUrl: data.faviconUrl || '',
      navigationHistoryIndex: data.navigationHistoryIndex ?? -1,
      navigationHistory: data.navigationHistory ?? [],
      permanentlyActive: data.permanentlyActive ?? false,
      extractedResourceId: data.extractedResourceId || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    } satisfies WebContentsViewData

    if (fullData.navigationHistory.length > 0) {
      fresh = true
    }

    if (!fresh) {
      const reusedView = this.reusePooledViewIfPossible(fullData)
      if (reusedView) {
        this.log.debug('Reusing pooled WebContentsView:', reusedView)
        this.views.update((views) => [...views, reusedView])
        return reusedView
      }
    }

    this.log.debug('Creating WebContentsView with data:', fullData)
    const view = new WebContentsView(fullData, this)
    this.views.update((views) => [...views, view])

    this.log.debug('Created WebContentsView:', view)
    return view
  }

  async postMountedWebContents(viewId: string, webContents: WebContents, activate = true) {
    this.log.debug('Mounted WebContentsView:', viewId)

    this.webContentsViews.set(viewId, webContents)
    this.emit(ViewManagerEmitterNames.CREATED, webContents)

    this.log.debug(`created with ID: ${viewId}`, webContents)

    if (activate) {
      await this.activate(viewId)
    }

    return webContents
  }

  /**
   * Activates a specific web contents view, making it visible and focused.
   * This method handles the complex logic of view activation, including:
   * - Managing overlay views
   * - Handling parent-child view relationships
   * - Ensuring proper view visibility state
   * - Coordinating with the window manager
   *
   * Before activating a view, it ensures all other views are hidden to maintain
   * proper view hierarchy and prevent visual conflicts.
   */
  async activate(viewId: string) {
    const view = this.viewsValue.find((v) => v.id === viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`)
      return false
    }

    this.log.debug(`Activating WebContentsView with ID: ${viewId}`, view)

    // if (view.parentViewID) {
    //   this.log.debug(`View with ID ${viewId} has a parent view ID: ${view.parentViewID}`)
    //   const parentView = this.webContentsViews.get(view.parentViewID)
    //   if (parentView) {
    //     this.log.debug(`Refreshing parent view with ID: ${parentView.id}`, parentView)
    //     await parentView.refreshScreenshot()
    //   } else {
    //     this.log.warn(
    //       `Parent view with ID ${view.parentViewID} does not exist. Cannot refresh screenshot.`
    //     )
    //   }
    // }

    if (!view.webContents) {
      this.log.warn(`WebContents for view with ID ${viewId} does not exist.`)
      return false
    }

    if (!view.dataValue.permanentlyActive) {
      await this.hideAll()
    }

    const overlayViewId = this.viewOverlays.get(view.id)
    if (overlayViewId) {
      this.log.debug(`Overlay view ID found for ${view.id}: ${overlayViewId}`, view)
      // If this view is an overlay, we might want to handle the parent view's state
      const overlayView = this.webContentsViews.get(overlayViewId)
      if (overlayView) {
        this.log.debug(`Activating overlay view with ID: ${overlayViewId}`, overlayView)
        await this.activate(overlayView.id)
        return true
      } else {
        this.log.warn(`Overaly view with ID ${overlayViewId} does not exist.`)
        this.viewOverlays.delete(view.id) // Clean up if the overlay view does not exist
      }
    }

    await view.webContents.action(WebContentsViewActionType.ACTIVATE)
    this.activeViewId.set(view.id)

    this.emit(ViewManagerEmitterNames.ACTIVATED, view.webContents)

    return true
  }

  async destroy(viewId: string) {
    const view = this.webContentsViews.get(viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`)
      return false
    }

    this.log.debug(`Destroying WebContentsView with ID: ${viewId}`, view)

    view.onDestroy()
    this.webContentsViews.delete(viewId)
    this.emit(ViewManagerEmitterNames.DELETED, viewId)

    // if (viewId === this.activeViewIdValue && (!view.isOverlay || !this.shouldHideViewsValue)) {
    //   const activeTab = this.tabsManager.activeTabValue
    //   this.log.debug(`Active view with ID ${viewId} destroyed. Checking for new active view.`)
    //   if (activeTab?.type === 'page' && activeTab.id !== viewId) {
    //     const activeView = this.views.get(activeTab.id)
    //     if (activeView) {
    //       await this.activate(activeView.id)
    //     } else {
    //       // If no active view is found, reset the active view ID
    //       this.activeViewId.set(null)
    //     }
    //   }
    // }

    // if (!!view.parentViewID) {
    //   this.log.debug(`Removing overlay view for parentViewID: ${view.parentViewID}`, view.id)
    //   this.viewOverlays.delete(view.parentViewID)
    // }

    return true
  }

  async hideAll() {
    // @ts-ignore
    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  async showViews() {
    this.emit(ViewManagerEmitterNames.SHOW_VIEWS)

    const view = this.getActiveView()
    if (view) {
      this.activate(view.id)
    }

    // const activeTab = this.tabsManager.activeTabValue
    // if (activeTab?.type === 'page') {
    //   const activeView = this.views.get(activeTab.id)
    //   if (activeView) {
    //     this.activate(activeView.id)
    //   } else {
    //     this.log.warn(`Active view with ID ${activeTab.id} does not exist.`)
    //   }
    // }
  }

  async hideViews(emitEvent = true) {
    if (emitEvent) {
      const activeView = this.getActiveView()
      if (activeView?.webContents) {
        await activeView.webContents.refreshScreenshot()
      }
    }

    // @ts-ignore
    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  updateViewBounds(viewId: string, bounds: Electron.Rectangle) {
    const view = this.getViewById(viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist. Cannot update bounds.`)
      return
    }

    if (!view.webContents) {
      this.log.warn(
        `WebContents for view with ID ${viewId} is not initialized. Cannot update bounds.`
      )
      return
    }

    this.log.debug(`Updating bounds for WebContentsView with ID: ${viewId}`, bounds)
    view.webContents.setBounds(bounds)
  }

  setSidebarState({ open, view }: { open?: boolean; view?: WebContentsView | null }) {
    if (view !== undefined) this.activeSidebarView = view
    if (open !== undefined) {
      this.sidebarViewOpen = open

      this.emit(ViewManagerEmitterNames.SIDEBAR_CHANGE, open, view ?? undefined)
    }
  }

  getActiveView(): WebContentsView | null {
    const activeViewId = this.activeViewIdValue
    if (activeViewId) {
      return this.getViewById(activeViewId)
    }
    return null
  }

  toggleSidebar() {
    this.setSidebarState({ open: !this.sidebarViewOpen })
  }

  openViewInSidebar(view: WebContentsView) {
    this.setSidebarState({ open: true, view })
    return view
  }

  openResourceInSidebar(resourceId: string) {
    return this.openURLInSidebar(`surf://surf/resource/${resourceId}`)
  }

  openURLInSidebar(url: string) {
    if (this.activeSidebarView && this.activeSidebarView.webContents) {
      const activeUrl = parseUrlIntoCanonical(this.activeSidebarView.dataValue.url)
      const requestedUrl = parseUrlIntoCanonical(url)
      if (activeUrl !== requestedUrl) {
        this.activeSidebarView.webContents.loadURL(url)
      }

      this.setSidebarState({ open: true, view: this.activeSidebarView })
      return this.activeSidebarView
    }

    const view = this.create({ url, permanentlyActive: true })
    this.setSidebarState({ open: true, view })
    return view
  }

  private async prepareNewHomepage() {
    try {
      this.log.debug('Preparing new homepage')
      this.newHomepageView = await this.create({ url: 'surf://surf/notebook' }, true)
      await this.newHomepageView.preloadWebContents({ activate: false })
    } catch (error) {
      this.log.error('Error preparing new homepage:', error)
    }
  }

  async openNewHomepage() {
    try {
      if (!this.newHomepageView) {
        return this.openURLInSidebar('surf://surf/notebook')
      }

      const view = await this.openViewInSidebar(this.newHomepageView)
      view.changePermanentlyActive(true)
      view.webContents?.activate()
      this.newHomepageView = null

      // prepare the next new homepage
      setTimeout(() => this.prepareNewHomepage(), 300)

      return view
    } catch (error) {
      this.log.error('Error opening new homepage:', error)
    }
  }

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())
    this.newHomepageView?.onDestroy()

    this.viewPoolSurfProtocol.forEach((view) => view.onDestroy())
    this.viewPoolSurfProtocol = []

    this.viewPoolWebPages.forEach((view) => view.onDestroy())
    this.viewPoolWebPages = []
  }

  static provide(resourceManager?: ResourceManager) {
    ViewManager.self = new ViewManager(resourceManager)
    return ViewManager.self
  }

  static use(): ViewManager {
    return ViewManager.self
  }
}

export const createViewManager = (resourceManager?: ResourceManager) =>
  ViewManager.provide(resourceManager)
export const useViewManager = () => ViewManager.use()
