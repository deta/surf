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
  type WebContentsViewEvent,
  type DetectedWebApp,
  type DetectedResource,
  ResourceTagsBuiltInKeys,
  WebViewEventReceiveNames,
  type ResourceDataLink,
  ResourceTypes,
  type WebViewReceiveEvents,
  ResourceTagDataStateValue,
  type PageHighlightSelectionData,
  WEBVIEW_MOUSE_CLICK_WINDOW_EVENT
} from '@deta/types'
import {
  useLogScope,
  EventEmitterBase,
  shouldIgnoreWebviewErrorCode,
  processFavicons,
  useDebounce,
  isPDFViewerURL,
  copyToClipboard,
  useTimeout
} from '@deta/utils'
import { getTextElementsFromHtml } from '@deta/utils/dom'
import {
  compareURLs,
  getHostname,
  parseUrlIntoCanonical,
  ResourceTag
} from '@deta/utils/formatting'
import { HistoryEntriesManager } from '../history'
import { ConfigService } from '../config'
import { KeyboardManager, useKeyboardManager } from '../shortcuts/index'
import type { NewWindowRequest } from '../ipc/events'
import type { ViewManager } from './viewManager.svelte'
import {
  WebContentsViewEmitterNames,
  type WebContentsEmitterEvents,
  type WebContentsViewEmitterEvents,
  WebContentsEmitterNames,
  type BookmarkPageOpts
} from './types'
import { Resource, ResourceManager } from '../resources'
import { WebParser } from '@deta/web-parser'

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
  private _updatingResourcePromises = new Map<string, Promise<Resource>>()

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
      // @ts-ignore
      window.api.registerNewWindowHandler(this.webContentsId, (details: NewWindowRequest) => {
        this.handleNewWindowRequest(details)
      })

      this._newWindowHandlerRegistered = true
    }

    // NOTE: This is needed to be fired manually, as otherwise the titleValue won't be properly available
    // from the start -> i.e. used in loading indicator
    this.emit(WebContentsEmitterNames.PAGE_TITLE_UPDATED, this.view.titleValue, '')
  }

  private handleDidStartLoading() {
    this.view.isLoading.set(true)
    this.view.error.set(null)

    this.emit(WebContentsEmitterNames.DID_START_LOADING)
    this.emit(WebContentsEmitterNames.LOADING_CHANGED, true, null)
  }

  private handleDidStopLoading() {
    this.view.isLoading.set(false)
    this.emit(WebContentsEmitterNames.DID_STOP_LOADING)
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

    if (this.view.selectionHighlightValue) {
      this.highlightSelection(this.view.selectionHighlightValue)
    }
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

    // @ts-ignore
    if (isPDFViewerURL(newUrl, window.api.PDFViewerEntryPoint)) {
      try {
        const urlParams = new URLSearchParams(new URL(newUrl).search)
        newUrl = decodeURIComponent(urlParams.get('path') || '') || newUrl
      } catch (err) {
        this.log.error('URL parsing error:', err)
      }
    }

    if (this.view.urlValue === newUrl) {
      this.log.debug('Navigation to same URL, skipping update')
      this.emit(WebContentsEmitterNames.NAVIGATED, newUrl, oldUrl, this._programmaticNavigation)
      return
    }

    this.view.url.set(newUrl)
    this.view.selectionHighlight.set(null)

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

  private handleMouseClick(event: WebViewSendEvents[WebViewEventSendNames.MouseClick]) {
    this.log.debug('Mouse click event in webview:', event)
    // emit a global event on the window
    window.dispatchEvent(
      new CustomEvent(WEBVIEW_MOUSE_CLICK_WINDOW_EVENT, {
        detail: event
      })
    )
  }

  private handleDetectedApp(detectedApp: WebViewSendEvents[WebViewEventSendNames.DetectedApp]) {
    this.log.debug('Detected app event in webview:', detectedApp)
    this.view.detectedApp.set(detectedApp)

    this.debouncedDetectExistingResource()
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
    } else if (eventType === WebViewEventSendNames.MouseClick) {
      this.handleMouseClick(eventData as WebViewSendEvents[WebViewEventSendNames.MouseClick])
    } else if (eventType === WebViewEventSendNames.DetectedApp) {
      this.handleDetectedApp(eventData as WebViewSendEvents[WebViewEventSendNames.DetectedApp])
    }

    this.emit(WebContentsEmitterNames.PRELOAD_EVENT, eventType, eventData)
  }

  attachListeners() {
    // @ts-ignore
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

  async waitForAppDetection(timeout: number) {
    let timeoutId: ReturnType<typeof setTimeout>
    let unsubscribe = () => {}

    return new Promise((resolve) => {
      unsubscribe = this.view.detectedApp.subscribe((detectedApp) => {
        if (detectedApp) {
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(detectedApp)
        }
      })

      timeoutId = setTimeout(() => {
        unsubscribe()
        resolve(null)
      }, timeout)
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
      // @ts-ignore
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
    // @ts-ignore
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

  async sendPageAction<T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ) {
    await this.action(WebContentsViewActionType.SEND, {
      channel: 'webview-event',
      args: [{ type: name, data }]
    })
  }

  async findInPage(
    text: string,
    options?: { forward?: boolean; matchCase?: boolean; findNext?: boolean }
  ) {
    return this.action(WebContentsViewActionType.FIND_IN_PAGE, {
      text,
      options
    })
  }

  async stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection') {
    await this.action(WebContentsViewActionType.STOP_FIND_IN_PAGE, { action })
  }

  async executeJavaScript(code: string, userGesture = false) {
    return this.action(WebContentsViewActionType.EXECUTE_JAVASCRIPT, {
      code,
      userGesture
    })
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

  detectResource(totalTimeout = 10000, pageLoadTimeout = 5000) {
    return new Promise<DetectedResource | null>((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | null = null
      let pageLoadTimeoutId: ReturnType<typeof setTimeout> | null = null

      const handleEvent = (args: any[]) => {
        const eventType = args[0] as WebViewEventSendNames
        const eventData = args[1] as WebViewSendEvents[WebViewEventSendNames]

        if (eventType === WebViewEventSendNames.DetectedResource) {
          if (timeout) {
            clearTimeout(timeout)
          }

          this.addPageEventListener(handleEvent)
          resolve(eventData as WebViewSendEvents[WebViewEventSendNames.DetectedResource])

          return true // prevent the event from being dispatched
        }
      }

      const handleDidFinishLoad = () => {
        this.log.debug('webview finished loading, detecting resource')

        if (pageLoadTimeoutId) {
          clearTimeout(pageLoadTimeoutId)
        }

        this.sendPageAction(WebViewEventReceiveNames.GetResource)
      }

      timeout = setTimeout(() => {
        this.log.debug('Resource detection timed out')
        this.removePageEventListener(handleEvent)
        this.removeEventListener(WebContentsViewEventType.DID_FINISH_LOAD, handleDidFinishLoad)
        this.removeEventListener(WebContentsViewEventType.DOM_READY, handleDidFinishLoad)
        resolve(null)
      }, totalTimeout)

      this.addPageEventListener(handleEvent)

      if (!this.view.domReadyValue) {
        this.log.debug('waiting for webview to be ready before detecting resource')
        this.addEventListener(WebContentsViewEventType.DOM_READY, handleDidFinishLoad)
      } else if (this.view.isLoadingValue) {
        this.log.debug('waiting for webview to finish loading before detecting resource')
        this.addEventListener(WebContentsViewEventType.DID_FINISH_LOAD, handleDidFinishLoad)

        // If loading takes too long, detect resource immediately
        pageLoadTimeoutId = setTimeout(() => {
          if (this.view.isLoadingValue) {
            this.log.debug('webview is still loading, detecting resource immediately')
            this.removeEventListener(WebContentsViewEventType.DID_FINISH_LOAD, handleDidFinishLoad)
            handleDidFinishLoad()
          }
        }, pageLoadTimeout)
      } else {
        this.log.debug('webview is ready, detecting resource immediately')
        handleDidFinishLoad()
      }
    })
  }

  async refreshResourceWithPage(resource: Resource): Promise<Resource> {
    const url = this.view.urlValue

    let updatingPromise = this._updatingResourcePromises.get(url)
    if (updatingPromise !== undefined) {
      this.log.debug('already updating resource, piggybacking on existing promise')
      return new Promise(async (resolve, reject) => {
        try {
          const resource = await updatingPromise!
          resolve(resource)
        } catch (e) {
          reject(null)
        }
      })
    }

    updatingPromise = new Promise(async (resolve, reject) => {
      try {
        if (this.view.detectedAppValue?.resourceType === 'application/pdf') {
          resolve(resource)
          return
        }

        resource.updateExtractionState('running')

        // Run resource detection on a fresh webview to get the latest data
        const detectedResource = await this.detectResource()

        this.log.debug('extracted resource data', detectedResource)

        if (detectedResource) {
          this.log.debug('updating resource with fresh data', detectedResource.data)
          await this.view.resourceManager.updateResourceParsedData(
            resource.id,
            detectedResource.data
          )
          await this.view.resourceManager.updateResourceMetadata(resource.id, {
            name: (detectedResource.data as any).title || '',
            sourceURI: url
          })
        }

        if ((resource.tags ?? []).find((x) => x.name === ResourceTagsBuiltInKeys.DATA_STATE)) {
          this.log.debug('updating resource data state to complete')
          await this.view.resourceManager.updateResourceTag(
            resource.id,
            ResourceTagsBuiltInKeys.DATA_STATE,
            ResourceTagDataStateValue.COMPLETE
          )
        }

        resource.updateExtractionState('idle')

        resolve(resource)
      } catch (e) {
        this.log.error('error refreshing resource', e)
        resource.updateExtractionState('idle') // TODO: support error state
        reject(null)
      }
    })

    this._updatingResourcePromises.set(url, updatingPromise)
    updatingPromise.then(() => {
      this._updatingResourcePromises.delete(url)
    })

    return updatingPromise
  }

  debouncedDetectExistingResource = useDebounce(async () => {
    await this.detectExistingResource()
  }, 500)

  async detectExistingResource() {
    this.log.debug('detecting existing resource for', this.view.urlValue)

    const matchingResources = await this.view.resourceManager.getResourcesFromSourceURL(
      this.view.urlValue
    )
    let bookmarkedResource = matchingResources.find(
      (resource) =>
        resource.type !== ResourceTypes.ANNOTATION &&
        resource.type !== ResourceTypes.HISTORY_ENTRY &&
        !(resource.tags ?? []).some(
          (tag) =>
            tag.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION && tag.value === 'generated'
        ) &&
        !(
          (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING && tag.value === 'true'
          ) &&
          (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT && tag.value === 'true'
          )
        )
    )

    const detectedResourceType = this.view.detectedAppValue?.resourceType
    this.log.debug('bookmarked resource found', bookmarkedResource)

    if (bookmarkedResource) {
      const isPartialResource =
        (bookmarkedResource.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.DATA_STATE
        )?.value === ResourceTagDataStateValue.PARTIAL

      if (detectedResourceType === ResourceTypes.DOCUMENT_NOTION) {
        this.log.debug('updating bookmarked resource with fresh content', bookmarkedResource.id)
        await this.refreshResourceWithPage(bookmarkedResource)
      } else if (isPartialResource) {
        this.log.debug('updating partial resource with fresh content', bookmarkedResource.id)
        await this.refreshResourceWithPage(bookmarkedResource)
      }
    } else {
      // Note: we now let the context manager take care of creating resources when it needs them, keeping this around if we ever need it again.
      // log.debug('creating new silent resource', url)
      // bookmarkedResource = await createBookmarkResource(url, tab, {
      //   silent: true,
      //   createdForChat: true,
      //   freshWebview: false
      // })
    }

    // Check if the detected resource is different from the one we previously bookmarked
    // If it is and it is silent, delete it as it is no longer needed
    if (
      this.view.extractedResourceIdValue &&
      this.view.extractedResourceIdValue !== bookmarkedResource?.id
    ) {
      const resource = await this.view.resourceManager.getResource(
        this.view.extractedResourceIdValue
      )
      if (resource) {
        const isSilent =
          (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT)
            ?.value === 'true'

        // For PDFs we don't want to delete the resource as embedding it is expensive and we might need it later
        if (isSilent && resource.type !== 'application/pdf') {
          this.log.debug(
            'deleting chat resource bookmark as the tab has been updated',
            this.view.extractedResourceIdValue
          )
          await this.view.resourceManager.deleteResource(resource.id)
        }
      } else {
        this.log.error('resource not found', this.view.extractedResourceIdValue)
        this.view.extractedResourceId.set(null)
      }
    }

    if (bookmarkedResource) {
      const isSilent = (bookmarkedResource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
      )

      const isHideInEverything = (bookmarkedResource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING
      )

      const isFromSpaceSource = (bookmarkedResource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
      )

      const isFromLiveSpace = isHideInEverything && isFromSpaceSource
      const manuallySaved = !isSilent && !isFromLiveSpace

      this.view.extractedResourceId.set(bookmarkedResource.id)
      this.view.resourceCreatedByUser.set(manuallySaved)
    } else {
      this.log.debug('no bookmarked resource found')
      this.view.extractedResourceId.set(null)
      this.view.resourceCreatedByUser.set(false)
    }
  }

  async highlightSelection(selectionData: PageHighlightSelectionData) {
    const { source, text: answerText } = selectionData
    const pdfPage = source?.metadata?.page ?? null

    try {
      this.log.debug('highlighting text', answerText, source)

      const detectedResource = await this.detectResource()
      if (!detectedResource) {
        this.log.error('no resource detected')
        return
      }

      if (detectedResource.type === ResourceTypes.PDF) {
        if (pdfPage === null) {
          this.log.error("page attribute isn't present")
          return
        }

        let targetText = source.content
        if (!targetText) {
          this.log.debug('no source content, hydrating source', source.uid)
          const fetchedSource = await this.view.resourceManager.sffs.getAIChatDataSource(
            selectionData.sourceUid
          )
          if (fetchedSource) {
            targetText = fetchedSource.content
          } else {
            this.log.debug('no source found for chat message, using answer text')
            targetText = answerText ?? ''
          }
        }

        this.log.debug('highlighting PDF page', pdfPage, targetText)
        this.sendPageAction(WebViewEventReceiveNames.GoToPDFPage, {
          page: pdfPage,
          targetText: targetText
        })
        return
      }

      const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
      if (!content || !content.html) {
        this.log.debug('no content found from web parser')
        return
      }

      const textElements = getTextElementsFromHtml(content.html)
      if (!textElements) {
        this.log.debug('no text elements found')
        return
      }

      this.log.debug('text elements length', textElements.length)

      // will throw an error if the request takes longer than 20 seconds
      const timedGetAIDocsSimilarity = useTimeout(() => {
        return this.view.resourceManager.sffs.getAIDocsSimilarity(
          answerText ?? '',
          textElements,
          0.5
        )
      }, 20000)

      const docsSimilarity = await timedGetAIDocsSimilarity()
      if (!docsSimilarity || docsSimilarity.length === 0) {
        this.log.debug('no docs similarity found')
        return
      }

      this.log.debug('docs similarity', docsSimilarity)

      docsSimilarity.sort((a, b) => a.similarity - b.similarity)
      const texts: string[] = []
      for (const docSimilarity of docsSimilarity) {
        const doc = textElements[docSimilarity.index]
        if (doc && doc.includes(' ')) {
          texts.push(doc)
        }
      }

      this.sendPageAction(WebViewEventReceiveNames.HighlightText, {
        texts: texts
      })
    } catch (e) {
      this.log.error('error highlighting text', e)
    }
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
      // @ts-ignore
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
  resourceManager: ResourceManager
  historyEntriesManager: HistoryEntriesManager

  id: string
  webContents = $state<WebContents | null>(null)

  private initialData: WebContentsViewData
  private bookmarkingPromises: Map<string, Promise<Resource>> = new Map()

  data: Readable<WebContentsViewData>

  url: Writable<string>
  screenshot: Writable<{
    image: string
    quality: 'low' | 'medium' | 'high'
  } | null>
  backgroundColor: Writable<string | null>
  title: Writable<string>
  faviconURL: Writable<string>

  historyStackIds: Writable<string[]>
  historyStackIndex: Writable<number>
  navigationHistory: Writable<Electron.NavigationEntry[]>
  navigationHistoryIndex: Writable<number>

  resourceCreatedByUser: Writable<boolean> = writable(false)
  extractedResourceId: Writable<string | null> = writable(null)
  detectedApp: Writable<DetectedWebApp | null> = writable(null)
  detectedResource: Writable<DetectedResource | null> = writable(null)
  selectionHighlight: Writable<PageHighlightSelectionData | null> = writable(null)

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
    this.resourceManager = manager.resourceManager
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
      [
        this.url,
        this.title,
        this.faviconURL,
        this.navigationHistoryIndex,
        this.navigationHistory,
        this.extractedResourceId
      ],
      ([
        $url,
        $title,
        $faviconURL,
        $navigationHistoryIndex,
        $navigationHistory,
        $extractedResourceId
      ]) => {
        return {
          id: this.id,
          partition: this.initialData.partition,
          url: $url,
          title: $title,
          faviconUrl: $faviconURL,
          permanentlyActive: this.initialData.permanentlyActive,
          navigationHistoryIndex: $navigationHistoryIndex,
          navigationHistory: $navigationHistory || [],
          extractedResourceId: $extractedResourceId
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
  get detectedAppValue() {
    return get(this.detectedApp)
  }
  get detectedResourceValue() {
    return get(this.detectedResource)
  }
  get extractedResourceIdValue() {
    return get(this.extractedResourceId)
  }
  get resourceCreatedByUserValue() {
    return get(this.resourceCreatedByUser)
  }
  get selectionHighlightValue() {
    return get(this.selectionHighlight)
  }
  get dataValue() {
    return get(this.data)
  }

  addSelectionHighlight(selection: PageHighlightSelectionData) {
    this.selectionHighlight.set(selection)
  }

  highlightSelection(selection: PageHighlightSelectionData) {
    this.selectionHighlight.set(selection)
    if (this.webContents) {
      this.webContents.highlightSelection(selection)
    }
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
    // @ts-ignore
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

  async createBookmarkResource(url: string, opts?: BookmarkPageOpts): Promise<Resource> {
    this.log.debug('bookmarking', url, opts)

    const defaultOpts: BookmarkPageOpts = {
      silent: false,
      createdForChat: false,
      freshWebview: false
    }

    const { silent, createdForChat, freshWebview } = Object.assign({}, defaultOpts, opts)

    let bookmarkingPromise = this.bookmarkingPromises.get(url)
    if (bookmarkingPromise !== undefined) {
      this.log.debug('already bookmarking page, piggybacking on existing promise')

      /* 
        Because a page might already be bookmarked when the page gets loaded we have to make sure
        we are not bookmarking it twice if the user manually saves it quickly after the page loads
        or hits the bookmark button multiple times.

        Since the initial bookmarking call might create a silent resource we need to make sure that
        we are updating the resource with the correct options if the user manually saves it.

        This is a bit of a hacky solution but it works for now. 
      */
      return new Promise(async (resolve, reject) => {
        try {
          const resource = await bookmarkingPromise!

          // make sure the previous promise was using the same options, if not overwrite it with the new ones
          const hasSilentTag = (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
          )

          if (hasSilentTag && !silent) {
            await this.resourceManager.deleteResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.SILENT
            )
          } else if (!hasSilentTag && silent) {
            await this.resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.SILENT,
              'true'
            )
          }

          const hasCreatedForChatTag = (resource.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
          )

          if (hasCreatedForChatTag && !createdForChat) {
            await this.resourceManager.deleteResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
            )
          } else if (!hasCreatedForChatTag && createdForChat) {
            await this.resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.CREATED_FOR_CHAT,
              'true'
            )
          }

          resolve(resource)
        } catch (e) {
          reject(null)
        }
      })
    }

    bookmarkingPromise = new Promise(async (resolve, reject) => {
      if (!this.webContents) {
        reject(null)
        return
      }

      const detectedResource = await this.webContents?.detectResource()
      const resourceTags = [
        ResourceTag.canonicalURL(url),
        ResourceTag.viewedByUser(true),
        ...(silent ? [ResourceTag.silent()] : []),
        ...(createdForChat ? [ResourceTag.createdForChat()] : [])
      ]

      if (!detectedResource) {
        const resource = await this.resourceManager.createResourceLink(
          {
            title: this.titleValue ?? '',
            url: url
          } as ResourceDataLink,
          {
            name: this.titleValue ?? '',
            sourceURI: url,
            alt: ''
          },
          resourceTags
        )

        resolve(resource)
        return
      }

      const isPDFPage = detectedResource.type === ResourceTypes.PDF
      let filename = null
      try {
        // if (isPDFPage) {
        //   const resourceData = detectedResource.data as ResourceDataPDF
        //   const url = resourceData.url
        //   const pdfDownloadURL = resourceData?.downloadURL ?? url

        //   this.log.debug('downloading PDF', pdfDownloadURL)
        //   const downloadData = await new Promise<Download | null>((resolveDownload) => {
        //     const timeout = setTimeout(() => {
        //       downloadIntercepters.update((intercepters) => {
        //         intercepters.delete(pdfDownloadURL)
        //         return intercepters
        //       })
        //       resolveDownload(null)
        //     }, 1000 * 60)

        //     downloadIntercepters.update((intercepters) => {
        //       intercepters.set(pdfDownloadURL, (data) => {
        //         clearTimeout(timeout)
        //         downloadIntercepters.update((intercepters) => {
        //           intercepters.delete(pdfDownloadURL)
        //           return intercepters
        //         })
        //         resolveDownload(data)
        //       })
        //       return intercepters
        //     })

        //     downloadURL(pdfDownloadURL)
        //   })

        //   log.debug('download data', downloadData, downloadData.resourceId)

        //   if (downloadData && downloadData.resourceId) {
        //     filename = downloadData.filename
        //     const resource = (await resourceManager.getResource(downloadData.resourceId))!

        //     if (url !== pdfDownloadURL) {
        //       await resourceManager.updateResourceTag(
        //         resource.id,
        //         ResourceTagsBuiltInKeys.CANONICAL_URL,
        //         url
        //       )
        //     }
        //     const hasSilentTag = (resource.tags ?? []).find(
        //       (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
        //     )
        //     if (hasSilentTag && !silent)
        //       await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)

        //     const hasCreatedForChatTag = (resource.tags ?? []).find(
        //       (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
        //     )
        //     if (hasCreatedForChatTag && !createdForChat)
        //       await resourceManager.deleteResourceTag(
        //         resource.id,
        //         ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
        //       )

        //     if ($userConfigSettings.cleanup_filenames) {
        //       const filename = tab.title || downloadData.filename
        //       log.debug('cleaning up filename', filename, url)
        //       const completion = await ai.cleanupTitle(filename, url)
        //       if (!completion.error && completion.output) {
        //         log.debug('cleaned up filename', filename, completion.output)
        //         await resourceManager.updateResourceMetadata(resource.id, {
        //           name: completion.output,
        //           sourceURI: url !== pdfDownloadURL ? url : undefined
        //         })
        //       }
        //     } else {
        //       await resourceManager.updateResourceMetadata(resource.id, {
        //         name: tab.title,
        //         sourceURI: url !== pdfDownloadURL ? url : undefined
        //       })
        //     }

        //     resolve(resource)
        //     return
        //   } else {
        //     log.error('Failed to download PDF')
        //     reject(null)
        //     return
        //   }
        // }

        const title = filename ?? (detectedResource.data as any)?.title ?? this.titleValue ?? ''
        const resource = await this.resourceManager.createDetectedResource(
          detectedResource,
          {
            name: title,
            sourceURI: url,
            alt: ''
          },
          resourceTags
        )

        resolve(resource)
      } catch (error) {
        this.log.error('Error creating bookmark resource:', error)
        reject(null)
      }
    })

    this.bookmarkingPromises.set(url, bookmarkingPromise)
    bookmarkingPromise.then(() => {
      this.bookmarkingPromises.delete(url)
    })

    return bookmarkingPromise
  }

  async bookmarkPage(opts?: BookmarkPageOpts) {
    const defaultOpts: BookmarkPageOpts = {
      silent: false,
      createdForChat: false,
      freshWebview: false
    }

    const { silent, createdForChat, freshWebview } = Object.assign({}, defaultOpts, opts)

    const rawUrl = this.urlValue

    let url = parseUrlIntoCanonical(rawUrl) ?? rawUrl

    const surfResourceId = url.match(/^surf:\/\/resource\/([^\/]+)/)?.[1]
    if (surfResourceId) {
      return await this.resourceManager.getResource(surfResourceId)
    }

    // strip &t from url suffix
    let youtubeHostnames = [
      'youtube.com',
      'youtu.be',
      'youtube.de',
      'www.youtube.com',
      'www.youtu.be',
      'www.youtube.de'
    ]
    if (youtubeHostnames.includes(new URL(url).host)) {
      url = url.replace(/&t.*/g, '')
    }

    if (this.extractedResourceIdValue) {
      const fetchedResource = await this.resourceManager.getResource(this.extractedResourceIdValue)
      if (fetchedResource) {
        const isDeleted =
          (fetchedResource?.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.DELETED)
            ?.value === 'true'

        const fetchedCanonical = (fetchedResource?.tags ?? []).find(
          (tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL
        )

        if (!isDeleted && compareURLs(fetchedCanonical?.value || '', url)) {
          this.log.debug('already bookmarked', url, fetchedResource.id)

          if (!silent) {
            await this.resourceManager.markResourceAsSavedByUser(fetchedResource.id)
          }

          // Make sure the resource is up to date with at least the latest title and sourceURI
          // Updating the resource also makes sure that the resource is visible at the top of the Everything view
          await this.resourceManager.updateResourceMetadata(fetchedResource.id, {
            name: this.titleValue ?? '',
            sourceURI: url
          })

          this.resourceCreatedByUser.set(true)
          this.extractedResourceId.set(fetchedResource.id)
          // dispatch('update-tab', {
          //   resourceBookmark: fetchedResource.id,
          //   resourceBookmarkedManually: tab.resourceBookmarkedManually
          // })

          // if (freshWebview) {
          //   log.debug('updating resource with fresh data', fetchedResource.id)
          //   refreshResourceWithPage(fetchedResource, url, true)
          //     .then((resource) => {
          //       log.debug('refreshed resource', resource)
          //     })
          //     .catch((e) => {
          //       toasts.error('Failed to refresh resource')
          //       fetchedResource.updateExtractionState('idle') // TODO: support error state
          //     })
          // }

          return fetchedResource
        }
      }
    }

    this.log.debug('bookmarking', url)
    const resource = await this.createBookmarkResource(url, {
      silent,
      createdForChat,
      freshWebview
    })

    this.extractedResourceId.set(resource.id)
    this.resourceCreatedByUser.set(!silent)

    // dispatch('update-tab', {
    //   resourceBookmark: resource.id,
    //   chatResourceBookmark: resource.id,
    //   resourceBookmarkedManually: tab.resourceBookmarkedManually
    // })

    return resource
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
