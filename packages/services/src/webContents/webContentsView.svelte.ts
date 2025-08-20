import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  type HistoryEntry,
  type WebContentsError,
  WebContentsViewActionType,
  type WebContentsViewData,
  type WebContentsViewEventListener,
  type WebContentsViewEventListenerCallback,
  type WebContentsViewEvents,
  WebContentsViewEventType,
  WebContentsViewManagerActionType,
  WebViewEventSendNames,
  type WebViewSendEvents,
  type Fn,
  type WebContentsViewAction,
  type WebContentsViewActionOutputs,
  type WebContentsViewActionPayloads,
  type WebContentsViewCreateOptions,
  type WebContentsViewEvent
} from '@deta/types'
import {
  useLogScope,
  EventEmitterBase,
  shouldIgnoreWebviewErrorCode,
  getHostname,
  processFavicons,
  useDebounce,
  isPDFViewerURL,
  parseUrlIntoCanonical,
  copyToClipboard
} from '@deta/utils'
import { HistoryEntriesManager } from '../history'
import { ConfigService } from '../config'
import { KeyboardManager, useKeyboardManager } from '../shortcuts/index'
import type { NewWindowRequest } from '../ipc/events'
import type { ViewManager } from './viewManager.svelte'
import {
  WebContentsViewEmitterNames,
  type WebContentsEmitterEvents,
  type WebContentsViewEmitterEvents,
  WebContentsEmitterNames
} from './types'

const NAVIGATION_DEBOUNCE_TIME = 500

export class WebContents extends EventEmitterBase<WebContentsEmitterEvents> {
  log: ReturnType<typeof useLogScope>
  view: WebContentsView
  manager: ViewManager
  config: ConfigService
  historyEntriesManager: HistoryEntriesManager
  keyboardManager: KeyboardManager

  webContentsId: number
  partition: string
  wrapperElement: HTMLElement | null = null
  bounds: Writable<Electron.Rectangle | null>

  private _eventListeners: Array<WebContentsViewEventListener> = []
  private _unsubs: Fn[] = []
  private _newWindowHandlerRegistered = false
  private _lastReceivedFavicons: string[] = []
  private _programmaticNavigation = false

  constructor(
    view: WebContentsView,
    webContentsId: number,
    opts: WebContentsViewCreateOptions,
    domElement?: HTMLElement
  ) {
    super()

    this.log = useLogScope(`WebContentsView ${view.id}`)
    this.manager = view.manager
    this.config = view.manager.config
    this.historyEntriesManager = view.historyEntriesManager
    this.keyboardManager = useKeyboardManager()

    this.view = view
    this.webContentsId = webContentsId
    this.partition = opts.partition || `persist:${view.id}`
    this.wrapperElement = domElement || null
    this.bounds = writable(opts.bounds || null)

    this.attachListeners()
  }

  get id() {
    return this.view.id
  }
  get boundsValue() {
    return get(this.bounds)
  }

  private handleNewWindowRequest(details: NewWindowRequest) {
    this.log.debug('New window request received', this.view.id, details)
    this.manager.handleNewWindowRequest(this.view.id, details)
  }

  private handleDOMReady() {
    this.view.domReady.set(true)

    if (!this._newWindowHandlerRegistered && this.webContentsId) {
      window.api.registerNewWindowHandler(this.webContentsId, (details: NewWindowRequest) => {
        this.handleNewWindowRequest(details)
      })

      this._newWindowHandlerRegistered = true
    }
  }

  private handleDidStartLoading() {
    this.view.isLoading.set(true)
    this.view.error.set(null)

    this.emit(WebContentsEmitterNames.LOADING_CHANGED, true, null)
  }

  private handleDidStopLoading() {
    this.view.isLoading.set(false)
    this.emit(WebContentsEmitterNames.LOADING_CHANGED, false, null)
  }

  private handleDidFailLoading(
    event: WebContentsViewEvents[WebContentsViewEventType.DID_FAIL_LOAD]
  ) {
    if (!event.isMainFrame) {
      return
    }

    this.log.debug('Failed to load', event.errorCode, event.errorDescription, event.validatedURL)

    // Ignore errors that are not related to the webview itself or don't need an error page to be shown
    if (shouldIgnoreWebviewErrorCode(event.errorCode)) {
      this.log.debug('Ignoring error code', event.errorCode)
      return
    }

    const parsedError = {
      code: event.errorCode,
      description: event.errorDescription,
      url: event.validatedURL
    }

    this.view.error.set(parsedError)

    this.emit(WebContentsEmitterNames.LOADING_CHANGED, false, parsedError)
  }

  private async handleDidFinishLoad() {
    // dispatch('did-finish-load')
    this.view.didFinishLoad.set(true)
    const url = await this.getURL()
    // handleNavigation(url)

    this.emit(WebContentsEmitterNames.LOADING_CHANGED, false, null)
  }

  private handlePageTitleUpdated(
    event: WebContentsViewEvents[WebContentsViewEventType.PAGE_TITLE_UPDATED]
  ) {
    const oldTitle = this.view.titleValue
    if (oldTitle === event.title) {
      this.log.debug('Page title did not change, skipping update')
      return
    }

    const newTitle = event.title
    this.view.title.set(newTitle)
    // dispatch('title-change', newTitle)

    if (this.view.currentHistoryEntryValue) {
      this.historyEntriesManager.updateEntry(this.view.currentHistoryEntryValue.id, {
        title: newTitle
      })
    }

    this.emit(WebContentsEmitterNames.PAGE_TITLE_UPDATED, newTitle, oldTitle)
  }

  private async handlePageFaviconUpdated(
    event: WebContentsViewEvents[WebContentsViewEventType.PAGE_FAVICON_UPDATED]
  ) {
    // Store the favicons for later theme changes
    this._lastReceivedFavicons = event.favicons

    // Get the current URL's domain for caching
    const currentUrl = await this.getURL()
    const domain = getHostname(currentUrl) || ''

    if (!domain) {
      this.log.warn('Failed to parse URL for favicon domain', currentUrl)
    }

    // Use the favicon utility to get the best favicon
    const isDarkMode = this.config.settingsValue.app_style === 'dark'
    const bestFavicon = processFavicons(this._lastReceivedFavicons, domain, isDarkMode)

    this.updateFavicon(bestFavicon)
  }

  private handleUpdateTargetURL(
    event: WebContentsViewEvents[WebContentsViewEventType.UPDATE_TARGET_URL]
  ) {
    this.view.hoverTargetURL.set(event.url)
    this.emit(WebContentsEmitterNames.HOVER_TARGET_URL_CHANGED, event.url)
  }

  private handleDidNavigate(event: WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE]) {
    const newUrl = event.url
    this.log.debug('did navigate', newUrl)

    if (this.view.urlValue === newUrl) {
      return
    }

    this.handleNavigation(newUrl)
  }

  private handleDidNavigateInPage(
    event: WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE_IN_PAGE]
  ) {
    if (!event.isMainFrame) return

    if (this.view.urlValue === event.url) {
      return
    }

    this.handleNavigation(event.url)
  }

  private handleNavigation(newUrl: string) {
    const oldUrl = this.view.urlValue

    if (isPDFViewerURL(newUrl, window.api.PDFViewerEntryPoint)) {
      try {
        const urlParams = new URLSearchParams(new URL(newUrl).search)
        newUrl = decodeURIComponent(urlParams.get('path') || '') || newUrl
      } catch (err) {
        this.log.error('URL parsing error:', err)
      }
    }

    this.view.url.set(newUrl)

    this.emit(WebContentsEmitterNames.NAVIGATED, newUrl, oldUrl, this._programmaticNavigation)

    if (this._programmaticNavigation) {
      this.log.debug('Programmatic navigation, skipping history entry')
      this._programmaticNavigation = false
      return
    }

    this.persistNavigationHistory()
    this.addHistoryEntry(newUrl)
  }

  private handleWebviewMediaPlaybackChanged(state: boolean) {
    this.isCurrentlyAudible().then((v) => {
      if (state && !v) return
      this.view.isMediaPlaying.set(state)
      this.emit(WebContentsEmitterNames.MEDIA_PLAYBACK_CHANGED, state)
    })
  }

  private handleHtmlFullScreenChange(isFullScreen: boolean) {
    this.view.isFullScreen.set(isFullScreen)
    this.emit(WebContentsEmitterNames.FULLSCREEN_CHANGED, isFullScreen)
  }

  private handleFocusChange(isFocused: boolean) {
    this.view.isFocused.set(isFocused)
    this.emit(WebContentsEmitterNames.FOCUS_CHANGED, isFocused)
  }

  private handleFoundInPage(event: WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE]) {
    this.view.foundInPageResult.set(event)
    this.emit(WebContentsEmitterNames.FOUND_IN_PAGE, event)
  }

  private handleKeyDown(event: WebViewSendEvents[WebViewEventSendNames.KeyDown]) {
    this.log.debug('Key down event in webview:', event)
    this.keyboardManager.handleKeyDown(event as KeyboardEvent)
    this.emit(WebContentsEmitterNames.KEYDOWN, event)
  }

  private handlePreloadIPCEvent(
    event: WebContentsViewEvents[WebContentsViewEventType.IPC_MESSAGE]
  ) {
    if (event.channel !== 'webview-page-event') return

    const eventType = event.args[0] as keyof WebViewSendEvents
    const eventData = event.args[1] as WebViewSendEvents[keyof WebViewSendEvents]

    if (eventType === WebViewEventSendNames.KeyDown) {
      this.handleKeyDown(eventData as WebViewSendEvents[WebViewEventSendNames.KeyDown])
      return
    }

    this.emit(WebContentsEmitterNames.PRELOAD_EVENT, eventType, eventData)
  }

  attachListeners() {
    const unsubWebContentsEvents = window.preloadEvents.onWebContentsViewEvent(
      (event: WebContentsViewEvent) => {
        // only handle events for our own view
        if (event.viewId !== this.view.id) {
          return
        }

        let skipDispatch = false

        if (event.type === WebContentsViewEventType.DID_FINISH_LOAD) {
          this.refreshBackgroundColor()
        }

        const matchingListeners = this._eventListeners.filter(
          (listener) => listener.type === event.type
        )
        if (matchingListeners.length > 0) {
          this.log.debug('Found matching listeners for event', event.type, matchingListeners.length)
          matchingListeners.forEach((listener) => {
            const result = listener.callback(event.payload as never) // TODO fix type casting
            if (result === false) {
              skipDispatch = true
            }
          })
        }

        if (skipDispatch) {
          this.log.debug('Skipping event dispatch for', event.type)
          return
        }

        if (event.type === WebContentsViewEventType.DID_START_LOADING) {
          this.handleDidStartLoading()
        } else if (event.type === WebContentsViewEventType.DID_STOP_LOADING) {
          this.handleDidStopLoading()
        } else if (event.type === WebContentsViewEventType.DOM_READY) {
          this.handleDOMReady()
        } else if (event.type === WebContentsViewEventType.DID_FAIL_LOAD) {
          this.handleDidFailLoading(event.payload)
        } else if (event.type === WebContentsViewEventType.DID_FINISH_LOAD) {
          this.handleDidFinishLoad()
        } else if (event.type === WebContentsViewEventType.PAGE_TITLE_UPDATED) {
          this.handlePageTitleUpdated(event.payload)
        } else if (event.type === WebContentsViewEventType.PAGE_FAVICON_UPDATED) {
          this.handlePageFaviconUpdated(event.payload)
        } else if (event.type === WebContentsViewEventType.UPDATE_TARGET_URL) {
          this.handleUpdateTargetURL(event.payload)
        } else if (event.type === WebContentsViewEventType.DID_NAVIGATE) {
          this.handleDidNavigate(event.payload)
        } else if (event.type === WebContentsViewEventType.DID_NAVIGATE_IN_PAGE) {
          this.handleDidNavigateInPage(event.payload)
        } else if (event.type === WebContentsViewEventType.MEDIA_STARTED_PLAYING) {
          this.handleWebviewMediaPlaybackChanged(true)
        } else if (event.type === WebContentsViewEventType.MEDIA_PAUSED) {
          this.handleWebviewMediaPlaybackChanged(false)
        } else if (event.type === WebContentsViewEventType.ENTER_HTML_FULL_SCREEN) {
          this.handleHtmlFullScreenChange(true)
        } else if (event.type === WebContentsViewEventType.LEAVE_HTML_FULL_SCREEN) {
          this.handleHtmlFullScreenChange(false)
        } else if (event.type === WebContentsViewEventType.FOCUS) {
          this.handleFocusChange(true)
        } else if (event.type === WebContentsViewEventType.BLUR) {
          this.handleFocusChange(false)
        } else if (event.type === WebContentsViewEventType.FOUND_IN_PAGE) {
          this.handleFoundInPage(event.payload)
        } else if (event.type === WebContentsViewEventType.IPC_MESSAGE) {
          this.handlePreloadIPCEvent(event.payload)
        }
      }
    )

    this._unsubs.push(unsubWebContentsEvents)

    this._unsubs.push(
      this.config.settings.subscribe(
        useDebounce(() => {
          this.updateFaviconForTheme()
        }, 500)
      )
    )

    this._unsubs.push(
      this.bounds.subscribe((bounds) => {
        if (bounds) {
          this.saveBounds(bounds)
        }
      })
    )

    // setup resize observer to resize the webview when the wrapper changes size
    if (this.wrapperElement) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!this.wrapperElement) return

        const currentBounds = this.wrapperElement.getBoundingClientRect()
        this.log.debug('Resizing web contents view to', currentBounds)
        this.bounds.set({
          x: currentBounds.x,
          y: currentBounds.y,
          width: currentBounds.width,
          height: currentBounds.height
        })
      })

      resizeObserver.observe(this.wrapperElement)

      this._unsubs.push(() => {
        this.log.debug('Unsubscribing from resize observer')
        resizeObserver.disconnect()
      })
    }
  }

  addEventListener<T extends WebContentsViewEventType>(
    type: T,
    callback: WebContentsViewEventListenerCallback<T>
  ) {
    this._eventListeners.push({ type, callback } as any)

    return () => {
      this.removeEventListener(type, callback)
    }
  }

  removeEventListener<T extends WebContentsViewEventType>(
    type: T,
    callback: WebContentsViewEventListenerCallback<T>
  ) {
    this._eventListeners = this._eventListeners.filter((listener) => {
      return !(listener.type === type && listener.callback === callback)
    })
  }

  addPageEventListener(callback: (args: any[]) => boolean | void) {
    return this.addEventListener(WebContentsViewEventType.IPC_MESSAGE, (payload) => {
      if (payload.channel === 'webview-page-event') {
        callback(payload.args)
      }
    })
  }

  removePageEventListener(callback: (args: any[]) => boolean | void) {
    return this.removeEventListener(WebContentsViewEventType.IPC_MESSAGE, (payload) => {
      if (payload.channel === 'webview-page-event') {
        callback(payload.args)
      }
    })
  }

  async updateFaviconForTheme() {
    if (this._lastReceivedFavicons.length === 0) return

    const currentUrl = await this.getURL()
    const domain = getHostname(currentUrl) || ''

    if (!domain) {
      this.log.warn('Failed to parse URL for favicon domain', currentUrl)
    }

    const isDarkMode = this.config.settingsValue.app_style === 'dark'
    const bestFavicon = processFavicons(this._lastReceivedFavicons, domain, isDarkMode)
    this.updateFavicon(bestFavicon)
  }

  private async persistNavigationHistory() {
    const result = await this.getNavigationHistory()

    this.view.navigationHistory.set(result.entries)
    this.view.navigationHistoryIndex.set(result.index)
  }

  private async saveBounds(bounds: Electron.Rectangle) {
    await this.action(WebContentsViewActionType.SET_BOUNDS, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
  }

  addHistoryEntry = useDebounce(async (newUrl: string) => {
    try {
      const oldUrl = this.view.currentHistoryEntryValue?.url
      const newCanonicalUrl = parseUrlIntoCanonical(newUrl) ?? newUrl

      if (oldUrl && parseUrlIntoCanonical(oldUrl) === newCanonicalUrl) {
        this.log.debug('did Skipping history entry for same URL')
        return
      }

      this.log.debug('did Adding history entry', newUrl, 'oldUrl', oldUrl)

      const entry: HistoryEntry = await this.historyEntriesManager.addEntry({
        type: 'navigation',
        url: newUrl,
        title: this.view.titleValue
      } as HistoryEntry)

      this.view.historyStackIds.update((stack) => {
        const index = this.view.navigationHistoryIndexValue

        // If we are not at the end of the stack, we need to truncate the stack
        if (index < stack.length - 1) {
          stack = stack.slice(0, index + 1)
        }

        return [...stack, entry.id]
      })

      // currentHistoryIndex.update((n) => n + 1)
      // dispatch('navigation', { url: newUrl, oldUrl: oldUrl || src })
    } catch (error) {
      this.log.error('Failed to add history entry', error)
    } finally {
      this._programmaticNavigation = false
    }
  }, NAVIGATION_DEBOUNCE_TIME)

  updateFavicon = useDebounce(async (newFaviconURL: string) => {
    const url = await this.getURL()
    if (url) {
      if (isPDFViewerURL(url, window.api.PDFViewerEntryPoint)) return
    }

    if (this.view.faviconURLValue === newFaviconURL) {
      return
    }

    this.view.faviconURL.set(newFaviconURL)
    this.emit(
      WebContentsEmitterNames.PAGE_FAVICON_UPDATED,
      newFaviconURL,
      this.view.faviconURLValue
    )
  }, 250)

  async action<T extends WebContentsViewActionType>(
    type: T,
    ...args: WebContentsViewActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewActionPayloads[T]]
  ) {
    const action = { type, payload: args[0] } as WebContentsViewAction
    return window.api.webContentsViewAction(this.view.id, action.type, action.payload) as Promise<
      WebContentsViewActionOutputs[T]
    >
  }

  getBoundingClientRect = (): DOMRect | null => {
    if (!this.wrapperElement) {
      this.log.error('WebContents wrapper element is not defined')
      return null
    }

    return this.wrapperElement.getBoundingClientRect()
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
    return this.manager.activate(this.view.id)
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
        this.view.backgroundColor.set(backgroundColor)
      } else {
        this.log.warn(`Failed to get background color`)
        this.view.backgroundColor.set(null)
      }
    } catch (error) {
      this.log.error('Error while refreshing background color:', error)
      this.view.backgroundColor.set(null)
    }
  }

  async takeViewScreenshot(quality: 'low' | 'medium' | 'high' = 'low') {
    this.log.debug('Refreshing screenshot with quality:', quality)
    const dataURL = await this.capturePage(quality)
    if (dataURL) {
      this.view.screenshot.set({ image: dataURL, quality })
    } else {
      this.log.warn('Failed to capture screenshot for view:', this.view.id)
      this.view.screenshot.set(null)
    }
  }

  async refreshScreenshot() {
    await this.takeViewScreenshot('low')

    // if (this.manager.tabsManager.showNewTabOverlayValue === 1) {
    this.takeViewScreenshot('high').then(() => {
      // no-op
    })
    //}
  }

  /**
   * Cleans up the view and its resources.
   * This method is called before the view gets fully destroyed.
   */
  onDestroy() {
    // Clean up any resources or listeners associated with this view
    this.action(WebContentsViewActionType.DESTROY)
    // Clean up subscription handlers
    this._unsubs.forEach((unsub) => unsub())

    // Unregister the new window handler if it was registered
    if (this._newWindowHandlerRegistered) {
      window.api.unregisterNewWindowHandler(this.webContentsId)
    }
  }
}

/**
 * Represents a view that hosts web content in the application. This class manages the lifecycle
 * and state of a web view, including its navigation history, visual state (screenshots),
 * and interaction with the underlying Electron webContents.
 *
 * Each WebContentsView is responsible for:
 * - Managing the web content's lifecycle (mount, unmount, destroy)
 * - Tracking navigation history and state
 * - Handling view-specific events (title changes, favicon updates, etc.)
 * - Managing visual state (screenshots, background color)
 * - Coordinating with the ViewManager for focus and activation
 */
export class WebContentsView extends EventEmitterBase<WebContentsViewEmitterEvents> {
  log: ReturnType<typeof useLogScope>
  manager: ViewManager
  historyEntriesManager: HistoryEntriesManager

  id: string
  webContents = $state<WebContents | null>(null)

  private initialData: WebContentsViewData

  data: Readable<WebContentsViewData>

  url: Writable<string>
  screenshot: Writable<{ image: string; quality: 'low' | 'medium' | 'high' } | null>
  backgroundColor: Writable<string | null>
  title: Writable<string>
  faviconURL: Writable<string>

  historyStackIds: Writable<string[]>
  historyStackIndex: Writable<number>
  navigationHistory: Writable<Electron.NavigationEntry[]>
  navigationHistoryIndex: Writable<number>

  domReady: Writable<boolean> = writable(false)
  didFinishLoad: Writable<boolean> = writable(false)
  isLoading: Writable<boolean> = writable(false)
  isAudioMuted: Writable<boolean> = writable(false)
  isMediaPlaying: Writable<boolean> = writable(false)
  isFullScreen: Writable<boolean> = writable(false)
  isFocused: Writable<boolean> = writable(false)
  error: Writable<WebContentsError | null> = writable(null)
  hoverTargetURL: Writable<string | null> = writable(null)
  foundInPageResult: Writable<
    WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE] | null
  > = writable(null)

  currentHistoryEntry: Readable<HistoryEntry | undefined>

  private unsubs: Fn[] = []

  constructor(data: WebContentsViewData, manager: ViewManager) {
    super()

    this.log = useLogScope(`View ${data.id}`)
    this.manager = manager
    this.historyEntriesManager = new HistoryEntriesManager()

    this.id = data.id
    this.initialData = data

    this.url = writable(data.url || '')
    this.title = writable(data.title || '')
    this.screenshot = writable(null)
    this.backgroundColor = writable(null)
    this.faviconURL = writable(data.faviconUrl || '')

    this.historyStackIds = writable([])
    this.historyStackIndex = writable(-1)
    this.navigationHistory = writable(data.navigationHistory ?? [])
    this.navigationHistoryIndex = writable(data.navigationHistoryIndex ?? -1)

    this.currentHistoryEntry = derived(
      [this.historyStackIds, this.historyStackIndex, this.navigationHistory],
      ([historyStackIds, currentHistoryIndex, navigationHistory]) => {
        // debouncedHistoryChange(navigationHistory, historyStackIds, currentHistoryIndex)
        return this.historyEntriesManager.getEntry(historyStackIds[currentHistoryIndex])
      }
    )

    this.data = derived(
      [this.url, this.title, this.faviconURL, this.navigationHistoryIndex, this.navigationHistory],
      ([$url, $title, $faviconURL, $navigationHistoryIndex, $navigationHistory]) => {
        return {
          id: this.id,
          partition: this.initialData.partition,
          url: $url,
          title: $title,
          faviconUrl: $faviconURL,
          navigationHistoryIndex: $navigationHistoryIndex,
          navigationHistory: $navigationHistory || []
        } as WebContentsViewData
      }
    )

    this.unsubs.push(
      this.data.subscribe((data) => {
        this.log.debug('Data changed:', data)
        this.emit(WebContentsViewEmitterNames.DATA_CHANGED, data)
      })
    )
  }

  get screenshotValue() {
    return get(this.screenshot)
  }
  get backgroundColorValue() {
    return get(this.backgroundColor)
  }
  get urlValue() {
    return get(this.url)
  }
  get titleValue() {
    return get(this.title)
  }
  get faviconURLValue() {
    return get(this.faviconURL)
  }
  get isAudioMutedValue() {
    return get(this.isAudioMuted)
  }
  get isLoadingValue() {
    return get(this.isLoading)
  }
  get domReadyValue() {
    return get(this.domReady)
  }
  get errorValue() {
    return get(this.error)
  }
  get isMediaPlayingValue() {
    return get(this.isMediaPlaying)
  }
  get isFullScreenValue() {
    return get(this.isFullScreen)
  }
  get isFocusedValue() {
    return get(this.isFocused)
  }
  get currentHistoryEntryValue() {
    return get(this.currentHistoryEntry)
  }
  get navigationHistoryValue() {
    return get(this.navigationHistory)
  }
  get navigationHistoryIndexValue() {
    return get(this.navigationHistoryIndex)
  }

  get dataValue() {
    return get(this.data)
  }

  /**
   * Mounts the web contents view to a DOM element, creating the underlying Electron webContents.
   * This method initializes the view with its initial URL and configuration, sets up event handlers,
   * and coordinates with the ViewManager for activation.
   *
   * The mounting process:
   * 1. Calculates view bounds from the DOM element
   * 2. Creates Electron webContents with specified options
   * 3. Sets up event handlers and IPC communication
   * 4. Activates the view if specified
   */
  async mount(domElement: HTMLElement, opts: Partial<WebContentsViewCreateOptions> = {}) {
    this.log.debug('Mounting view with options:', opts, domElement)

    const options = {
      id: this.id,
      partition: this.initialData.partition,
      url: this.urlValue,
      navigationHistoryIndex: this.navigationHistoryIndexValue ?? -1,
      navigationHistory: this.navigationHistoryValue ?? [],
      activate: true,
      permanentlyActive: this.initialData.permanentlyActive || false,
      ...opts
    } as WebContentsViewCreateOptions

    if (domElement && !options.bounds) {
      const rect = domElement.getBoundingClientRect()
      options.bounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    }

    this.log.debug('Creating WebContents with options:', options)
    const { webContentsId } = await window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.CREATE,
      options
    )

    const webContents = new WebContents(this, webContentsId, options, domElement)
    this.webContents = webContents

    this.emit(WebContentsViewEmitterNames.MOUNTED, webContents)
    this.log.debug('View rendered successfully:', this.id, webContents)

    this.manager.postMountedWebContents(this.id, webContents, options.activate)

    return webContents
  }

  async attachMounted(webContentsId: number, domElement?: HTMLElement) {
    this.log.debug('Attaching mounted view:', this.id, webContentsId)

    const options = {
      id: this.id,
      partition: this.initialData.partition,
      url: this.urlValue,
      navigationHistoryIndex: this.navigationHistoryIndexValue ?? -1,
      navigationHistory: this.navigationHistoryValue ?? []
    } as WebContentsViewCreateOptions

    const webContents = new WebContents(this, webContentsId, options, domElement)
    this.webContents = webContents

    if (domElement && !options.bounds) {
      const rect = domElement.getBoundingClientRect()
      options.bounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }

      webContents.setBounds(options.bounds)
    }

    this.emit(WebContentsViewEmitterNames.MOUNTED, webContents)
    this.log.debug('View attached successfully:', this.id, webContents)

    return webContents
  }

  copyURL() {
    return copyToClipboard(this.urlValue)
  }

  destroy() {
    this.log.debug('Destroying view:', this.id)

    this.onDestroy()
    this.manager.destroy(this.id)

    this.emit(WebContentsViewEmitterNames.DESTROYED)
  }

  onDestroy() {
    if (this.webContents) {
      this.webContents.onDestroy()
      this.webContents = null
    }

    this.unsubs.forEach((unsub) => unsub())
    this.unsubs = []
  }
}
