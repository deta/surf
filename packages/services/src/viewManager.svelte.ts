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
  type WebContentsViewCreateOptions
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
  generateID,
  isDev
} from '@deta/utils'
import { HistoryEntriesManager } from './history'
import { ConfigService, useConfig } from './config'
import { KVStore, useKVTable } from './kv'
import { KeyboardManager, useKeyboardManager } from './shortcuts/index'

const NAVIGATION_DEBOUNCE_TIME = 500

export type WebContentsViewParsedEvents = {
  'loading-changed': (isLoading: boolean, error: WebContentsError | null) => void
  'page-title-updated': (newTitle: string, oldTitle: string) => void
  'page-favicon-updated': (newFaviconUrl: string, oldFaviconUrl: string) => void
  navigated: (newUrl: string, oldUrl: string, isProgrammatic: boolean) => void
  'media-playback-changed': (isPlaying: boolean) => void
  'fullscreen-changed': (isFullScreen: boolean) => void
  'focus-changed': (isFocused: boolean) => void
  'hover-target-url-changed': (url: string | null) => void
  'found-in-page': (result: WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE]) => void
  keydown: (event: WebViewSendEvents[WebViewEventSendNames.KeyDown]) => void
  'preload-event': <T extends keyof WebViewSendEvents>(
    type: T,
    payload: WebViewSendEvents[T]
  ) => void
}

export class WebContents extends EventEmitterBase<WebContentsViewParsedEvents> {
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

  private handleDOMReady() {
    this.view.domReady.set(true)

    if (!this._newWindowHandlerRegistered && this.webContentsId) {
      window.api.registerNewWindowHandler(this.webContentsId, (details) => {
        // TODO: Handle new window creation
        // dispatch('new-window', details)
      })

      this._newWindowHandlerRegistered = true
    }
  }

  private handleDidStartLoading() {
    this.view.isLoading.set(true)
    this.view.error.set(null)

    this.emit('loading-changed', true, null)
  }

  private handleDidStopLoading() {
    this.view.isLoading.set(false)
    this.emit('loading-changed', false, null)
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

    this.emit('loading-changed', false, parsedError)
  }

  private async handleDidFinishLoad() {
    // dispatch('did-finish-load')
    this.view.didFinishLoad.set(true)
    const url = await this.getURL()
    // handleNavigation(url)

    this.emit('loading-changed', false, null)
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

    this.emit('page-title-updated', newTitle, oldTitle)
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
    this.emit('hover-target-url-changed', event.url)
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

    this.emit('navigated', newUrl, oldUrl, this._programmaticNavigation)

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
      this.emit('media-playback-changed', state)
    })
  }

  private handleHtmlFullScreenChange(isFullScreen: boolean) {
    this.view.isFullScreen.set(isFullScreen)
    this.emit('fullscreen-changed', isFullScreen)
  }

  private handleFocusChange(isFocused: boolean) {
    this.view.isFocused.set(isFocused)
    this.emit('focus-changed', isFocused)
  }

  private handleFoundInPage(event: WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE]) {
    this.view.foundInPageResult.set(event)
    this.emit('found-in-page', event)
  }

  private handleKeyDown(event: WebViewSendEvents[WebViewEventSendNames.KeyDown]) {
    this.log.debug('Key down event in webview:', event)
    this.keyboardManager.handleKeyDown(event as KeyboardEvent)
    this.emit('keydown', event)
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

    this.emit('preload-event', eventType, eventData)
  }

  attachListeners() {
    const unsubWebContentsEvents = window.preloadEvents.onWebContentsViewEvent((event) => {
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
    })

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
    this.emit('page-favicon-updated', newFaviconURL, this.view.faviconURLValue)
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

export type OverlayState = {
  teletypeOpen: boolean
}

export type WebContentsViewEmitterEvents = {
  mounted: (webContentsView: WebContents) => void
  destroyed: () => void
  'data-changed': (data: WebContentsViewData) => void
}

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
  navigationHistory: Writable<Electron.NavigationEntry[] | null>
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
    this.navigationHistory = writable(data.navigationHistory || null)
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
        this.emit('data-changed', data)
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

  async mount(domElement: HTMLElement, opts: Partial<WebContentsViewCreateOptions> = {}) {
    this.log.debug('Mounting view with options:', opts, domElement)

    const options = {
      id: this.id,
      partition: this.initialData.partition,
      url: this.urlValue,
      navigationHistoryIndex: this.navigationHistoryIndexValue ?? -1,
      navigationHistory: this.navigationHistoryValue || [],
      activate: true,
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

    this.emit('mounted', webContents)
    this.log.debug('View rendered successfully:', this.id, webContents)

    this.manager.postMountedWebContents(this.id, webContents, options.activate)

    return webContents
  }

  destroy() {
    this.log.debug('Destroying view:', this.id)

    this.onDestroy()
    this.manager.destroy(this.id)

    this.emit('destroyed')
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

export type ViewManagerEvents = {
  created: (view: WebContents) => void
  deleted: (viewId: string) => void
  activated: (view: WebContents) => void
  'show-views': () => void
  'hide-views': () => void
}

export class ViewManager extends EventEmitterBase<ViewManagerEvents> {
  log: ReturnType<typeof useLogScope>
  config: ConfigService
  kv: KVStore<WebContentsViewData>

  webContentsViews: Map<string, WebContents> = new Map()
  viewOverlays: Map<string, string> = new Map() // Maps a view to its overlay view if it has one
  overlayState: Writable<OverlayState>

  activeViewId: Writable<string | null>
  shouldHideViews: Readable<boolean>

  views: Writable<WebContentsView[]>

  private unsubs: Fn[] = []

  static self: ViewManager

  constructor() {
    super()

    this.log = useLogScope('ViewManager')
    this.config = useConfig()
    this.kv = useKVTable<WebContentsViewData>('views')

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

    if (isDev) {
      // @ts-ignore
      window.viewManager = this
    }
  }

  get viewsValue() {
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

  async changeOverlayState(changes: Partial<OverlayState>) {
    this.overlayState.update((state) => {
      const newState = { ...state, ...changes }
      return newState
    })
  }

  trackOverlayView(viewId: string, overlayViewId: string) {
    this.viewOverlays.set(viewId, overlayViewId)
  }

  create(data: Partial<WebContentsViewData>) {
    const fullData = {
      id: data.id || generateID(),
      partition: data.partition || 'persist:horizon',
      url: data.url || 'about:blank',
      title: data.title || '',
      faviconUrl: data.faviconUrl || '',
      navigationHistoryIndex: -1,
      navigationHistory: [],
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    }

    const view = new WebContentsView(fullData, this)
    this.views.update((views) => [...views, view])

    this.log.debug('Creating WebContentsView with data:', view)

    return view
  }

  async postMountedWebContents(viewId: string, webContents: WebContents, activate = true) {
    this.log.debug('Mounted WebContentsView:', viewId)

    this.webContentsViews.set(viewId, webContents)
    this.emit('created', webContents)

    this.log.debug(`created with ID: ${viewId}`, webContents)

    if (activate) {
      await this.activate(viewId)
    }

    return webContents
  }

  async activate(viewId: string) {
    const view = this.webContentsViews.get(viewId)
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

    await this.hideAll()

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

    await view.action(WebContentsViewActionType.ACTIVATE)
    this.activeViewId.set(view.id)

    this.emit('activated', view)

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
    this.emit('deleted', viewId)

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
    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  async showViews() {
    this.emit('show-views')

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
      if (activeView) {
        await activeView.refreshScreenshot()
      }
    }

    window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.HIDE_ALL)
  }

  getActiveView(): WebContents | null {
    const activeViewId = this.activeViewIdValue
    if (activeViewId) {
      return this.webContentsViews.get(activeViewId) || null
    }
    return null
  }

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub())
  }

  static getInstance(): ViewManager {
    if (!ViewManager.self) {
      ViewManager.self = new ViewManager()
    }

    return ViewManager.self
  }
}

export const useViewManager = (): ViewManager => {
  return ViewManager.getInstance()
}
