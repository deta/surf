import {
  WebContentsViewActionType,
  WebContentsViewManagerActionType,
  type WebContentsViewAction,
  type WebContentsViewActionOutputs,
  type WebContentsViewActionPayloads,
  type WebContentsViewCreateOptions
} from '@deta/types'
import type { TabsManager } from './tabs'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'
import { wait, useLogScope, EventEmitterBase } from '@deta/utils'

type Fn = () => void

export class WebContentsView {
  log: ReturnType<typeof useLogScope>
  manager: WebContentsViewManager

  id: string
  webContentsId: number
  isOverlay: boolean
  parentViewID: string | undefined
  bounds: Writable<Electron.Rectangle | null>
  screenshot: Writable<{ image: string; quality: 'low' | 'medium' | 'high' } | null>
  backgroundColor: Writable<string | null>

  unsubs: Fn[] = []

  constructor(
    manager: WebContentsViewManager,
    id: string,
    webContentsId: number,
    opts: { isOverlay?: boolean; parentViewID?: string; bounds: Electron.Rectangle | null }
  ) {
    this.log = useLogScope(`WebContentsView ${id}`)
    this.manager = manager

    this.id = id
    this.webContentsId = webContentsId
    this.isOverlay = opts.isOverlay ?? false
    this.parentViewID = opts.parentViewID
    this.bounds = writable(opts.bounds || null)
    this.screenshot = writable(null)
    this.backgroundColor = writable(null)

    this.unsubs.push(
      this.bounds.subscribe((bounds) => {
        if (bounds) {
          this.saveBounds(bounds)
        }
      })
    )
  }

  get boundsValue() {
    return get(this.bounds)
  }

  get screenshotValue() {
    return get(this.screenshot)
  }

  get backgroundColorValue() {
    return get(this.backgroundColor)
  }

  async action<T extends WebContentsViewActionType>(
    type: T,
    ...args: WebContentsViewActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewActionPayloads[T]]
  ) {
    const action = { type, payload: args[0] } as WebContentsViewAction
    return window.api.webContentsViewAction(this.id, action.type, action.payload) as Promise<
      WebContentsViewActionOutputs[T]
    >
  }

  private async saveBounds(bounds: Electron.Rectangle) {
    await this.action(WebContentsViewActionType.SET_BOUNDS, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
  }

  async setBounds(bounds: Electron.Rectangle) {
    this.bounds.set(bounds)
  }

  async loadURL(url: string) {
    await this.action(WebContentsViewActionType.LOAD_URL, { url })
  }

  async reload(ignoreCache: boolean = false) {
    await this.action(WebContentsViewActionType.RELOAD, { ignoreCache })
  }

  async goBack() {
    await this.action(WebContentsViewActionType.GO_BACK)
  }

  async goForward() {
    await this.action(WebContentsViewActionType.GO_FORWARD)
  }

  async insertText(text: string) {
    await this.action(WebContentsViewActionType.INSERT_TEXT, { text })
  }

  async getURL() {
    return this.action(WebContentsViewActionType.GET_URL)
  }

  async focus() {
    await this.action(WebContentsViewActionType.FOCUS)
  }

  async setAudioMuted(muted: boolean) {
    await this.action(WebContentsViewActionType.SET_AUDIO_MUTED, muted)
  }

  async setZoomFactor(factor: number) {
    await this.action(WebContentsViewActionType.SET_ZOOM_FACTOR, factor)
  }

  async openDevTools(mode: 'right' | 'bottom' | 'detach' = 'detach') {
    await this.action(WebContentsViewActionType.OPEN_DEV_TOOLS, { mode })
  }

  async send(channel: string, ...args: any[]) {
    await this.action(WebContentsViewActionType.SEND, { channel, args })
  }

  async findInPage(
    text: string,
    options?: { forward?: boolean; matchCase?: boolean; findNext?: boolean }
  ) {
    return this.action(WebContentsViewActionType.FIND_IN_PAGE, { text, options })
  }

  async stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection') {
    await this.action(WebContentsViewActionType.STOP_FIND_IN_PAGE, { action })
  }

  async executeJavaScript(code: string, userGesture = false) {
    return this.action(WebContentsViewActionType.EXECUTE_JAVASCRIPT, { code, userGesture })
  }

  async downloadURL(url: string, options?: Electron.DownloadURLOptions) {
    await this.action(WebContentsViewActionType.DOWNLOAD_URL, { url, options })
  }

  async isCurrentlyAudible() {
    return this.action(WebContentsViewActionType.IS_CURRENTLY_AUDIBLE)
  }

  async getNavigationHistory() {
    return this.action(WebContentsViewActionType.GET_NAVIGATION_HISTORY)
  }

  async capturePage(quality: 'low' | 'medium' | 'high' = 'low') {
    return this.action(WebContentsViewActionType.CAPTURE_PAGE, { quality })
  }

  async activate() {
    return this.manager.activate(this.id)
  }

  async hide() {
    await this.action(WebContentsViewActionType.HIDE)
  }

  async refreshBackgroundColor() {
    try {
      // first grab the background color of the view by executing JavaScript in the view
      const backgroundColor = await this.executeJavaScript(
        `document.body ? getComputedStyle(document.body).backgroundColor : 'rgba(255, 255, 255, 1)'`
      )

      if (backgroundColor) {
        this.log.debug(`Setting background color`, backgroundColor)
        this.backgroundColor.set(backgroundColor)
      } else {
        this.log.warn(`Failed to get background color`)
        this.backgroundColor.set(null)
      }
    } catch (error) {
      this.log.error('Error while refreshing background color:', error)
      this.backgroundColor.set(null)
    }
  }

  async takeViewScreenshot(quality: 'low' | 'medium' | 'high' = 'low') {
    this.log.debug('Refreshing screenshot with quality:', quality)
    const dataURL = await this.capturePage(quality)

    if (dataURL) {
      this.screenshot.set({ image: dataURL, quality })
    } else {
      this.log.warn('Failed to capture screenshot for view:', this.id)
      this.screenshot.set(null)
    }
  }

  async refreshScreenshot() {
    await this.takeViewScreenshot('low')

    if (this.manager.tabsManager.showNewTabOverlayValue === 1) {
      this.takeViewScreenshot('high').then(() => {
        // no-op
      })
    }
  }

  onDestroy() {
    // Clean up any resources or listeners associated with this view
    this.action(WebContentsViewActionType.DESTROY)
    // Clean up subscription handlers
    this.unsubs.forEach((unsub) => unsub())
  }
}

export type OverlayState = {
  extensionPopupOpen: boolean
  selectPopupOpen: boolean
  rightClickMenuOpen: boolean
  dialogOpen: boolean
}

export type ViewManagerEvents = {
  created: (view: WebContentsView) => void
  deleted: (viewId: string) => void
  activated: (view: WebContentsView) => void
  'show-views': () => void
  'hide-views': () => void
}

export class WebContentsViewManager extends EventEmitterBase<ViewManagerEvents> {
  log: ReturnType<typeof useLogScope>
  tabsManager: TabsManager

  views: Map<string, WebContentsView> = new Map()
  viewOverlays: Map<string, string> = new Map() // Maps a view to its overlay view if it has one
  overlayState: Writable<OverlayState>

  activeViewId: Writable<string | null>
  shouldHideViews: Readable<boolean>

  constructor(tabsManager: TabsManager) {
    super()

    this.log = useLogScope('WebContentsViewManager')
    this.tabsManager = tabsManager

    this.overlayState = writable({
      extensionPopupOpen: false,
      selectPopupOpen: false,
      rightClickMenuOpen: false,
      dialogOpen: false
    })

    this.activeViewId = writable(null)

    /*
        derived([this.tabsManager.activeTab], ([$activeTab]) => {
            if ($activeTab?.type === 'page') {
                const view = this.views.get($activeTab.id);
                return view ? view.id : null;
            }

            return null;
        })
        */

    this.shouldHideViews = derived(
      [
        this.tabsManager.showNewTabOverlay,
        this.overlayState,
        this.tabsManager.desktopManager.activeDesktopVisible,
        this.tabsManager.showBrowsingContextSelector
      ],
      ([
        $showNewTabOverlay,
        $overlayState,
        $activeDesktopVisible,
        $showBrowsingContextSelector
      ]) => {
        return (
          $showNewTabOverlay !== 0 ||
          $overlayState.selectPopupOpen ||
          $overlayState.extensionPopupOpen ||
          $overlayState.rightClickMenuOpen ||
          $overlayState.dialogOpen ||
          $activeDesktopVisible ||
          $showBrowsingContextSelector
        )
      }
    )
  }

  get viewsValue() {
    const viewsArray: WebContentsView[] = []
    this.views.forEach((view) => {
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

  async changeOverlayState(changes: Partial<OverlayState>) {
    this.overlayState.update((state) => {
      const newState = { ...state, ...changes }
      return newState
    })
  }

  trackOverlayView(viewId: string, overlayViewId: string) {
    this.viewOverlays.set(viewId, overlayViewId)
  }

  async create(options: WebContentsViewCreateOptions) {
    this.log.debug('Creating WebContentsView with options:', options)
    const { viewId, webContentsId } = await window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.CREATE,
      options
    )

    const view = new WebContentsView(this, viewId, webContentsId, {
      isOverlay: options.isOverlay,
      parentViewID: options.parentViewID,
      bounds: options.bounds || null
    })

    this.views.set(viewId, view)
    this.emit('created', view)

    this.log.debug(`created with ID: ${viewId}`, view)

    if (options.parentViewID) {
      const parentView = this.views.get(options.parentViewID)
      if (parentView) {
        this.trackOverlayView(parentView.id, view.id)
      } else {
        this.log.warn(
          `Parent view with ID ${options.parentViewID} does not exist. Cannot track overlay view.`
        )
      }
    }

    if (options.activate) {
      await this.activate(view.id)
    }

    return view
  }

  async activate(viewId: string) {
    const view = this.views.get(viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`)
      return false
    }

    this.log.debug(`Activating WebContentsView with ID: ${viewId}`, view)

    if (view.parentViewID) {
      this.log.debug(`View with ID ${viewId} has a parent view ID: ${view.parentViewID}`)
      const parentView = this.views.get(view.parentViewID)
      if (parentView) {
        this.log.debug(`Refreshing parent view with ID: ${parentView.id}`, parentView)
        await parentView.refreshScreenshot()
      } else {
        this.log.warn(
          `Parent view with ID ${view.parentViewID} does not exist. Cannot refresh screenshot.`
        )
      }
    }

    await this.hideAll()

    const overlayViewId = this.viewOverlays.get(view.id)
    if (overlayViewId) {
      this.log.debug(`Overlay view ID found for ${view.id}: ${overlayViewId}`, view)
      // If this view is an overlay, we might want to handle the parent view's state
      const overlayView = this.views.get(overlayViewId)
      if (overlayView) {
        this.log.debug(`Activating overlay view with ID: ${overlayViewId}`, overlayView)
        await this.activate(overlayView.id)
        return true
      } else {
        this.log.warn(`Overaly view with ID ${overlayViewId} does not exist.`)
        this.viewOverlays.delete(view.id) // Clean up if the overlay view does not exist
      }
    }

    await view.action(WebContentsViewActionType.ACTIVATE)
    this.activeViewId.set(view.id)

    this.emit('activated', view)

    return true
  }

  async destroy(viewId: string) {
    const view = this.views.get(viewId)
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`)
      return false
    }

    this.log.debug(`Destroying WebContentsView with ID: ${viewId}`, view)

    view.onDestroy()
    this.views.delete(viewId)
    this.emit('deleted', viewId)

    if (viewId === this.activeViewIdValue && (!view.isOverlay || !this.shouldHideViewsValue)) {
      const activeTab = this.tabsManager.activeTabValue
      this.log.debug(`Active view with ID ${viewId} destroyed. Checking for new active view.`)
      if (activeTab?.type === 'page' && activeTab.id !== viewId) {
        const activeView = this.views.get(activeTab.id)
        if (activeView) {
          await this.activate(activeView.id)
        } else {
          // If no active view is found, reset the active view ID
          this.activeViewId.set(null)
        }
      }
    }

    if (!!view.parentViewID) {
      this.log.debug(`Removing overlay view for parentViewID: ${view.parentViewID}`, view.id)
      this.viewOverlays.delete(view.parentViewID)
    }

    return true
  }

  async hideAll() {
    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  async showViews() {
    this.emit('show-views')

    const activeTab = this.tabsManager.activeTabValue
    if (activeTab?.type === 'page') {
      const activeView = this.views.get(activeTab.id)
      if (activeView) {
        this.activate(activeView.id)
      } else {
        this.log.warn(`Active view with ID ${activeTab.id} does not exist.`)
      }
    }
  }

  async hideViews(emitEvent = true) {
    if (emitEvent) {
      const activeView = this.getActiveView()
      if (activeView) {
        await activeView.refreshScreenshot()
      }
    }

    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  getActiveView(): WebContentsView | null {
    const activeViewId = this.activeViewIdValue
    if (activeViewId) {
      return this.views.get(activeViewId) || null
    }
    return null
  }
}

export const createViewManager = (tabsManager: TabsManager): WebContentsViewManager => {
  const viewManager = new WebContentsViewManager(tabsManager)
  tabsManager.attachViewManager(viewManager)
  return viewManager
}
