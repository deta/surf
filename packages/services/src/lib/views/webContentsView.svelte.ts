import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

import {
  type HistoryEntry,
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
  WEBVIEW_MOUSE_CLICK_WINDOW_EVENT,
  WEB_CONTENTS_ERRORS,
  type WebContentsErrorParsed,
  type ResourceDataPDF,
  type Download,
  ViewLocation
} from '@deta/types'
import {
  useLogScope,
  EventEmitterBase,
  shouldIgnoreWebviewErrorCode,
  processFavicons,
  useDebounce,
  isInternalViewerURL,
  copyToClipboard,
  useTimeout
} from '@deta/utils'
import { getTextElementsFromHtml } from '@deta/utils/dom'
import {
  compareURLs,
  getHostname,
  getViewTypeData,
  getViewType,
  parseUrlIntoCanonical,
  ResourceTag,
  cleanupPageTitle
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
  type BookmarkPageOpts,
  ViewType,
  type ViewTypeData,
  ViewManagerEmitterNames
} from './types'
import { Resource, ResourceManager } from '../resources'
import { WebParser } from '@deta/web-parser'
import { type MentionItem } from '@deta/editor'
import { type DownloadsManager, useDownloadsManager } from '../downloads.svelte'
import { type AIQueryPayload } from '../messagePort'

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

  private async handleLocationChange() {
    const url = await this.getURL()
    if (this.view.typeValue === ViewType.Page && url !== 'about:blank') {
      this.runAppDetection()
    }

    this.notifyAboutMount()
  }

  private handleDOMReady() {
    this.view.domReady.set(true)
    this.emit(WebContentsEmitterNames.DOM_READY)

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

    if (this.view.errorValue) {
      this.activate()
    }

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

    const error = {
      code: event.errorCode,
      description: event.errorDescription,
      url: event.validatedURL
    }

    const parsedError = WEB_CONTENTS_ERRORS[error.code]

    this.view.error.set(parsedError)
    this.view.title.set(parsedError.title || 'Failed to load')
    this.view.url.set(event.validatedURL)

    this.hide()

    this.emit(WebContentsEmitterNames.LOADING_CHANGED, false, error)
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

    this.handleLocationChange()
  }

  private handlePageTitleUpdated(
    event: WebContentsViewEvents[WebContentsViewEventType.PAGE_TITLE_UPDATED]
  ) {
    const oldTitle = this.view.titleValue
    const newTitle = cleanupPageTitle(event.title)

    this.log.debug('Page title updated', event.title, newTitle)
    if (oldTitle === newTitle) {
      this.log.debug('Page title did not change, skipping update')
      return
    }

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
    const isDarkMode = this.config?.settingsValue?.app_style === 'dark'
    const bestFavicon = processFavicons(this._lastReceivedFavicons, domain, isDarkMode)

    this.updateFavicon(bestFavicon)
  }

  private handleUpdateTargetURL(
    event: WebContentsViewEvents[WebContentsViewEventType.UPDATE_TARGET_URL]
  ) {
    this.view.hoverTargetURL.set(event.url)
    this.emit(WebContentsEmitterNames.HOVER_TARGET_URL_CHANGED, event.url)
  }

  private handleWillNavigate(event: WebContentsViewEvents[WebContentsViewEventType.WILL_NAVIGATE]) {
    this.emit(WebContentsEmitterNames.WILL_NAVIGATE)
  }
  private handleDidNavigate(event: WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE]) {
    const newUrl = event.url
    this.log.debug('did navigate', newUrl)

    if (this.view.urlValue === newUrl) {
      return
    }

    this.emit(WebContentsEmitterNames.DID_NAVIGATE)
    this.handleNavigation(newUrl)
  }

  private handleDidNavigateInPage(
    event: WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE_IN_PAGE]
  ) {
    if (!event.isMainFrame) return

    if (this.view.urlValue === event.url) {
      return
    }

    this.emit(WebContentsEmitterNames.DID_NAVIGATE_IN_PAGE)
    this.handleNavigation(event.url)
  }

  private handleNavigation(newUrl: string) {
    const oldUrl = this.view.urlValue

    // @ts-ignore
    if (isInternalViewerURL(newUrl, window.api.PDFViewerEntryPoint)) {
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
    this.view.detectedApp.set(null)

    this.emit(WebContentsEmitterNames.NAVIGATED, newUrl, oldUrl, this._programmaticNavigation)

    if (this._programmaticNavigation) {
      this.log.debug('Programmatic navigation, skipping history entry')
      this._programmaticNavigation = false
      return
    }

    this.persistNavigationHistory()
    this.addHistoryEntry(newUrl)
    this.handleLocationChange()
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
    this.syncWrapperBounds()
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

  handleMessagePortMessage(event: any) {
    this.log.debug('Message port message event in webview:', event)
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
    } else if (eventType === WebViewEventSendNames.FullscreenChange) {
      this.handleHtmlFullScreenChange(
        (eventData as WebViewSendEvents[WebViewEventSendNames.FullscreenChange]).fullscreen
      )
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
        } else if (event.type === WebContentsViewEventType.WILL_NAVIGATE) {
          this.handleWillNavigate(event.payload)
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

    this._unsubs.push(
      this.manager.on(ViewManagerEmitterNames.WINDOW_RESIZE, () => {
        this.syncWrapperBounds()
      })
    )

    // this._unsubs.push(
    //   this.manager.messagePort.updateView.on(this.view.id, async (payload) => {
    //     this.log.debug('Update view payload received:', payload)

    //     const response = await this.manager.messagePort.requestCapture.request(this.view.id)
    //     this.log.debug('Request capture response received:', response)
    //   })
    // )

    // setup resize observer to resize the webview when the wrapper changes size
    if (this.wrapperElement) {
      const resizeObserver = new ResizeObserver((_entries) => {
        this.syncWrapperBounds()
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

  syncWrapperBounds() {
    if (!this.wrapperElement) {
      return
    }

    if (this.view.isFullScreenValue) {
      this.bounds.set({
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight
      })
    } else {
      const currentBounds = this.wrapperElement.getBoundingClientRect()
      this.bounds.set({
        x: currentBounds.x,
        y: currentBounds.y,
        width: currentBounds.width,
        height: currentBounds.height
      })
    }
  }

  async waitForAppDetection(timeout: number) {
    const canonicalUrl = parseUrlIntoCanonical(this.view.urlValue)
    if (this.view.detectedAppValue && this.view.detectedAppValue.canonicalUrl === canonicalUrl) {
      this.log.debug('app already detected', this.view.detectedAppValue)
      return Promise.resolve(this.view.detectedAppValue)
    }

    let timeoutId: ReturnType<typeof setTimeout>
    let unsubscribe = () => {}

    return new Promise((resolve) => {
      unsubscribe = this.view.detectedApp.subscribe((detectedApp) => {
        if (detectedApp) {
          clearTimeout(timeoutId)
          unsubscribe()
          this.log.debug('detected app', detectedApp)
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
      if (isInternalViewerURL(url, window.api.PDFViewerEntryPoint)) return
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

  async sendMessage(type: string, data?: any) {
    // @ts-ignore
    window.api.postMessageToView(this.view.id, { type, data })
  }

  async runNoteQuery(payload: AIQueryPayload) {
    this.log.debug('Running note query', payload)
    return this.manager.messagePort.noteRunQuery.send(this.view.id, payload)
  }

  async insertNoteMentionQuery(mention?: MentionItem, query?: string) {
    this.log.debug('Inserting note mention query', mention, query)
    return this.manager.messagePort.noteInsertMentionQuery.send(this.view.id, { query, mention })
  }

  async updatePageQuery(query: string) {
    this.log.debug('Updating page query', query)
    return this.manager.messagePort.changePageQuery.send(this.view.id, { query })
  }

  async triggerRefreshNoteContent() {
    this.log.debug('Triggering refresh note content')
    return this.manager.messagePort.noteRefreshContent.send(this.view.id)
  }

  async notifyAboutMount(location?: ViewLocation) {
    const uiLocation = location || this.view.uiLocationValue
    if (!uiLocation) return

    if (
      ![ViewType.Resource, ViewType.Notebook, ViewType.NotebookHome].includes(this.view.typeValue)
    ) {
      return
    }

    this.log.debug('Notifying about mount', uiLocation)
    this.manager.messagePort.viewMounted.send(this.id, { location: uiLocation })
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

  async loadURL(url: string, force = false) {
    const validNotebookTypes = [ViewType.Notebook, ViewType.NotebookHome, ViewType.Resource]

    const oldViewTypeData = this.view.typeDataValue
    const newViewTypeData = getViewTypeData(url)

    const currentIsValid = validNotebookTypes.includes(oldViewTypeData.type)
    const newIsValid = validNotebookTypes.includes(newViewTypeData.type)

    const oldIsRawResource = oldViewTypeData.type === ViewType.Resource && oldViewTypeData.raw
    const newIsRawResource = newViewTypeData.type === ViewType.Resource && newViewTypeData.raw

    // const currentIsResource = this.view.typeValue === ViewType.Resource
    // const newIsResource = getViewType(url) === ViewType.Resource

    // const canNavigateBetweenNotebooks = currentIsNotebook && newIsNotebook
    // const canNavigateBetweenResources = currentIsResource && newIsResource

    this.log.debug('Loading URL', url, { currentIsValid, newIsValid, newIsRawResource, force })

    if (!force && currentIsValid && newIsValid && !newIsRawResource && !oldIsRawResource) {
      this.manager.messagePort.navigateURL.send(this.view.id, { url })
      return
    }

    await this.action(WebContentsViewActionType.LOAD_URL, { url })
  }

  async reload(ignoreCache: boolean = false) {
    await this.action(WebContentsViewActionType.RELOAD, { ignoreCache })
  }

  private handlePostManualNavigation() {
    const entry = this.view.navigationHistoryValue?.[this.view.navigationHistoryIndexValue || 0]
    if (
      entry &&
      entry.url === this.view.urlValue &&
      entry.title &&
      !entry.title.startsWith('surf://')
    ) {
      this.log.debug('URL matches current history entry', entry)
      this.view.title.set(entry.title)
    }
  }

  async goBack() {
    await this.action(WebContentsViewActionType.GO_BACK)
    // this.handlePostManualNavigation()
  }

  async goForward() {
    await this.action(WebContentsViewActionType.GO_FORWARD)
    // this.handlePostManualNavigation()
  }

  async insertText(text: string) {
    await this.action(WebContentsViewActionType.INSERT_TEXT, { text })
  }

  async changePermanentlyActive(value: boolean) {
    await this.action(WebContentsViewActionType.CHANGE_PERMANENTLY_ACTIVE, value)
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

  async getZoomFactor(): number {
    return await this.action(WebContentsViewActionType.GET_ZOOM_FACTOR)
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
      // Use theme-aware fallback color
      const isDarkMode = this.config?.settingsValue?.app_style === 'dark'
      const fallbackColor = isDarkMode ? '#1a1a1a' : 'rgba(255, 255, 255, 1)'

      // first grab the background color of the view by executing JavaScript in the view
      const backgroundColor = await this.executeJavaScript(
        `document.body ? getComputedStyle(document.body).backgroundColor : '${fallbackColor}'`
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

  runAppDetection = useDebounce(async () => {
    this.log.debug('Running app detection')
    this.sendPageAction(WebViewEventReceiveNames.GetApp)
  }, 350)

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
    let url = parseUrlIntoCanonical(this.view.urlValue) ?? this.view.urlValue

    this.log.debug('detecting existing resource for', url)
    const matchingResources = await this.view.resourceManager.getResourcesFromSourceURL(url)
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
        this.view.setExtractedResourceId(null)
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

      const isCreatedForChat = (bookmarkedResource.tags ?? []).find(
        (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
      )

      const isFromLiveSpace = isHideInEverything && isFromSpaceSource
      const manuallySaved = !isSilent && !isFromLiveSpace && !isCreatedForChat

      this.view.setExtractedResourceId(bookmarkedResource.id, manuallySaved)
    } else {
      this.log.debug('no bookmarked resource found')
      this.view.setExtractedResourceId(null, false)
    }
  }

  async highlightSelection(selectionData: PageHighlightSelectionData) {
    const { source, text: answerText, timestamp } = selectionData
    const pdfPage = source?.metadata?.page ?? null

    if (timestamp !== undefined && timestamp !== null) {
      this.log.debug('seeking to timestamp', timestamp)
      this.sendPageAction(WebViewEventReceiveNames.SeekToTimestamp, {
        timestamp: timestamp
      })

      return
    }

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

  cleanup() {
    // Clean up subscription handlers
    this._unsubs.forEach((unsub) => unsub())

    // Unregister the new window handler if it was registered
    if (this._newWindowHandlerRegistered) {
      // @ts-ignore
      window.api.unregisterNewWindowHandler(this.webContentsId)
    }
  }

  /**
   * Cleans up the view and its resources.
   * This method is called before the view gets fully destroyed.
   */
  onDestroy() {
    this.log.debug('Destroying web contents view')
    // Clean up any resources or listeners associated with this view
    this.action(WebContentsViewActionType.DESTROY)

    this.cleanup()
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
  downloadsManager: DownloadsManager

  id: string
  webContents = $state<WebContents | null>(null)

  private initialData: WebContentsViewData
  private bookmarkingPromises = new Map<string, Promise<Resource>>()
  private updatingResourcePromises = new Map<string, Promise<Resource>>()
  private preventUnmounting: boolean = false

  data: Readable<WebContentsViewData>

  url: Writable<string>
  screenshot: Writable<{
    image: string
    quality: 'low' | 'medium' | 'high'
  } | null>
  backgroundColor: Writable<string | null>
  title: Writable<string>
  faviconURL: Writable<string>
  permanentlyActive: Writable<boolean>
  uiLocation: Writable<ViewLocation | null>

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
  error: Writable<WebContentsErrorParsed | null> = writable(null)
  hoverTargetURL: Writable<string | null> = writable(null)
  foundInPageResult: Writable<
    WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE] | null
  > = writable(null)

  currentHistoryEntry: Readable<HistoryEntry | undefined>
  type: Readable<ViewType>
  typeData: Readable<ViewTypeData>

  private unsubs: Fn[] = []

  constructor(data: WebContentsViewData, manager: ViewManager) {
    super()

    this.log = useLogScope(`View ${data.id}`)
    this.manager = manager
    this.resourceManager = manager.resourceManager
    this.historyEntriesManager = manager.historyEntriesManager
    this.downloadsManager = useDownloadsManager()

    this.id = data.id
    this.initialData = data

    this.url = writable(data.url || '')
    this.title = writable(data.title || '')
    this.screenshot = writable(null)
    this.backgroundColor = writable(null)
    this.faviconURL = writable(data.faviconUrl || '')
    this.permanentlyActive = writable(data.permanentlyActive || false)
    this.uiLocation = writable<ViewLocation | null>(null)

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
        this.extractedResourceId,
        this.permanentlyActive
      ],
      ([
        $url,
        $title,
        $faviconURL,
        $navigationHistoryIndex,
        $navigationHistory,
        $extractedResourceId,
        $permanentlyActive
      ]) => {
        return {
          id: this.id,
          partition: this.initialData.partition,
          url: $url,
          title: $title,
          faviconUrl: $faviconURL,
          permanentlyActive: $permanentlyActive,
          navigationHistoryIndex: $navigationHistoryIndex,
          navigationHistory: $navigationHistory || [],
          extractedResourceId: $extractedResourceId
        } as WebContentsViewData
      }
    )

    this.typeData = derived([this.url], ([url]) => {
      return getViewTypeData(url)
    })

    this.type = derived(this.typeData, (typeData) => {
      return typeData.type
    })

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
  get typeValue() {
    return get(this.type)
  }
  get typeDataValue() {
    return get(this.typeData)
  }
  get permanentlyActiveValue() {
    return get(this.permanentlyActive)
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
  get didFinishLoadValue() {
    return get(this.didFinishLoad)
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
  get uiLocationValue() {
    return get(this.uiLocation)
  }
  get historyStackIdsValue() {
    return get(this.historyStackIds)
  }
  get historyStackIndexValue() {
    return get(this.historyStackIndex)
  }

  setExtractedResourceId(resourceId: string | null, createdByUser?: boolean) {
    this.extractedResourceId.set(resourceId)

    if (createdByUser !== undefined) {
      this.resourceCreatedByUser.set(createdByUser)
    }
  }

  async highlightSelection(selection: PageHighlightSelectionData) {
    this.selectionHighlight.set(selection)

    const webContents = await this.waitForWebContentsReady()
    if (!webContents) {
      this.log.error('WebContents is not available for highlighting selection')
      return
    }

    await webContents.waitForAppDetection(5000)

    this.log.debug('Highlighting selection', selection)
    await webContents.highlightSelection(selection)
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
  async mount(
    domElement: HTMLElement,
    opts: Partial<WebContentsViewCreateOptions> = {},
    location: ViewLocation = ViewLocation.Tab
  ) {
    this.log.debug('Mounting view with options:', opts, domElement)

    const options = {
      id: this.id,
      partition: this.initialData.partition,
      url: this.urlValue,
      navigationHistoryIndex: this.navigationHistoryIndexValue ?? -1,
      navigationHistory: this.navigationHistoryValue ?? [],
      activate: true,
      permanentlyActive: this.permanentlyActiveValue ?? false,
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

    let webContentsId = this.webContents?.webContentsId
    if (!this.webContents) {
      // @ts-ignore
      const result = await window.api.webContentsViewManagerAction(
        WebContentsViewManagerActionType.CREATE,
        options
      )

      webContentsId = result.webContentsId
    } else {
      this.log.debug('View is already mounted, skipping creating view')
      this.webContents.cleanup()
    }

    if (!webContentsId) {
      this.log.error('Failed to create webContents:', options)
      throw new Error('Failed to create webContents')
    }

    this.uiLocation.set(location)

    const webContents = new WebContents(this, webContentsId, options, domElement)
    this.webContents = webContents

    this.webContents.notifyAboutMount(location)
    this.emit(WebContentsViewEmitterNames.MOUNTED, webContents)

    this.log.debug('View rendered successfully:', this.id, webContents)

    this.manager.postMountedWebContents(this.id, webContents, options.activate)

    // reset preventUnmounting after successful mount
    this.preventUnmounting = false

    return webContents
  }

  async preloadWebContents(opts: Partial<WebContentsViewCreateOptions> = {}) {
    const options = {
      id: this.id,
      partition: this.initialData.partition,
      url: this.urlValue,
      navigationHistoryIndex: this.navigationHistoryIndexValue ?? -1,
      navigationHistory: this.navigationHistoryValue ?? [],
      activate: true,
      permanentlyActive: this.permanentlyActiveValue ?? false,
      ...opts
    } as WebContentsViewCreateOptions

    // @ts-ignore
    const { webContentsId } = await window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.CREATE,
      options
    )

    const webContents = new WebContents(this, webContentsId, options)
    this.webContents = webContents
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

  /**
   * Prevents the view from unmounting until the next mount.
   * This is used to move the view to a different part in the app without destroying the underlying WCV.
   */
  preventUnmountingUntilNextMount() {
    this.log.debug('Marking view as unmountable')
    this.preventUnmounting = true
  }

  changePermanentlyActive(value: boolean) {
    this.log.debug('Changing permanently active state:', value)
    this.initialData.permanentlyActive = value
    this.permanentlyActive.set(value)
    this.webContents?.changePermanentlyActive(value)
  }

  copyURL() {
    return copyToClipboard(this.urlValue)
  }

  async refreshResourceWithPage(
    resource: Resource,
    url: string,
    freshWebview = false
  ): Promise<Resource> {
    let updatingPromise = this.updatingResourcePromises.get(url)
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
        if (this.detectedAppValue?.resourceType === 'application/pdf') {
          resolve(resource)
          return
        }

        resource.updateExtractionState('running')

        // Run resource detection on a fresh webview to get the latest data
        const detectedResource = await this.extractResource(url, freshWebview)

        this.log.debug('extracted resource data', detectedResource)

        if (detectedResource) {
          this.log.debug('updating resource with fresh data', detectedResource.data)
          await this.resourceManager.updateResourceParsedData(resource.id, detectedResource.data)
          await this.resourceManager.updateResourceMetadata(resource.id, {
            name: (detectedResource.data as any).title || this.titleValue || '',
            sourceURI: url
          })
        }

        if ((resource.tags ?? []).find((x) => x.name === ResourceTagsBuiltInKeys.DATA_STATE)) {
          this.log.debug('updating resource data state to complete')
          await this.resourceManager.updateResourceTag(
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

    this.updatingResourcePromises.set(url, updatingPromise)
    updatingPromise.then(() => {
      this.updatingResourcePromises.delete(url)
    })

    return updatingPromise
  }

  async extractResource(url: string, freshWebview = false): Promise<DetectedResource | null> {
    this.log.debug('extracting resource data', freshWebview ? 'using fresh webview' : '')

    let detectedResource: DetectedResource | null = null

    if (freshWebview) {
      const webParser = new WebParser(url)
      detectedResource = await webParser.extractResourceUsingWebview(document)
    } else {
      if (!this.webContents) {
        return null
      }

      detectedResource = await this.webContents.detectResource()
    }

    if (!detectedResource) {
      this.log.debug('no resource detected')
      return null
    }

    return detectedResource
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
          } /* else if (!hasCreatedForChatTag && createdForChat) {
            await this.resourceManager.updateResourceTag(
              resource.id,
              ResourceTagsBuiltInKeys.CREATED_FOR_CHAT,
              'true'
            )
          }*/

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

      const detectedResource = await this.extractResource(url, freshWebview)
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
      let filename: string | null = null
      try {
        if (isPDFPage) {
          const resourceData = detectedResource.data as ResourceDataPDF
          const url = resourceData.url
          const pdfDownloadURL = resourceData?.downloadURL ?? url

          this.log.debug('downloading PDF', pdfDownloadURL)
          const downloadData = await new Promise<Download | null>((resolveDownload) => {
            if (!this.webContents) {
              resolveDownload(null)
            }

            const timeout = setTimeout(() => {
              this.downloadsManager.downloadInterceptors.delete(pdfDownloadURL)
              resolveDownload(null)
            }, 1000 * 60)

            this.downloadsManager.downloadInterceptors.set(pdfDownloadURL, (data) => {
              clearTimeout(timeout)
              this.downloadsManager.downloadInterceptors.delete(pdfDownloadURL)
              resolveDownload(data)
            })

            this.webContents?.downloadURL(pdfDownloadURL)
          })

          this.log.debug('download data', downloadData, downloadData?.resourceId)

          if (downloadData && downloadData.resourceId) {
            filename = downloadData.filename
            const resource = (await this.resourceManager.getResource(downloadData.resourceId))!

            if (url !== pdfDownloadURL) {
              await this.resourceManager.updateResourceTag(
                resource.id,
                ResourceTagsBuiltInKeys.CANONICAL_URL,
                url
              )
            }
            const hasSilentTag = (resource.tags ?? []).find(
              (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
            )
            if (hasSilentTag && !silent)
              await this.resourceManager.deleteResourceTag(
                resource.id,
                ResourceTagsBuiltInKeys.SILENT
              )

            const hasCreatedForChatTag = (resource.tags ?? []).find(
              (tag) => tag.name === ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
            )
            if (hasCreatedForChatTag && !createdForChat)
              await this.resourceManager.deleteResourceTag(
                resource.id,
                ResourceTagsBuiltInKeys.CREATED_FOR_CHAT
              )

            await this.resourceManager.updateResourceMetadata(resource.id, {
              name: this.titleValue ?? filename ?? '',
              sourceURI: url !== pdfDownloadURL ? url : undefined
            })

            resolve(resource)
            return
          } else {
            this.log.error('Failed to download PDF')
            reject(null)
            return
          }
        }

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

          this.resourceCreatedByUser.set(!silent && !createdForChat)
          this.setExtractedResourceId(fetchedResource.id)

          if (freshWebview) {
            this.log.debug('updating resource with fresh data', fetchedResource.id)
            this.refreshResourceWithPage(fetchedResource, url, true)
              .then((resource) => {
                this.log.debug('refreshed resource', resource)
              })
              .catch((e) => {
                fetchedResource.updateExtractionState('idle') // TODO: support error state
              })
          }

          return fetchedResource
        }
      }
    }

    this.log.debug('bookmarking', url, { silent, createdForChat, freshWebview })
    const resource = await this.createBookmarkResource(url, {
      silent,
      createdForChat,
      freshWebview
    })

    this.setExtractedResourceId(resource.id, !silent && !createdForChat)

    return resource
  }

  /**
   * Waits until the webContents have updated the domReady store
   */
  waitForWebContentsReady(timeout: number = 10000) {
    if (this.didFinishLoadValue && this.webContents) {
      return Promise.resolve(this.webContents)
    }

    let timeoutId: ReturnType<typeof setTimeout>
    let unsubscribe = () => {}

    return new Promise<WebContents | null>((resolve) => {
      unsubscribe = this.didFinishLoad.subscribe((didFinishLoad) => {
        if (didFinishLoad) {
          clearTimeout(timeoutId)
          unsubscribe()

          if (!this.webContents) {
            resolve(null)
          } else {
            resolve(this.webContents)
          }
        }
      })

      timeoutId = setTimeout(() => {
        unsubscribe()
        resolve(null)
      }, timeout)
    })
  }

  /**
   * Waits until the webContents have updated the domReady store
   */
  waitForNoteReady(timeout: number = 10000) {
    let timeoutId: ReturnType<typeof setTimeout>
    let unsubscribe = () => {}

    return new Promise<WebContents | null>((resolve) => {
      unsubscribe = this.manager.messagePort.noteReady.on((_) => {
        this.log.debug('note is ready')

        clearTimeout(timeoutId)
        if (unsubscribe) {
          unsubscribe()
        }
        resolve(this.webContents)
      }, this.id)

      timeoutId = setTimeout(() => {
        if (unsubscribe) {
          unsubscribe()
        }
        resolve(null)
      }, timeout)
    })
  }

  unmount() {
    if (this.preventUnmounting) {
      this.log.debug('Preventing unmounting of view:', this.id)
      return
    }

    this.log.debug('Unmounting view:', this.id)
    this.destroy()
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
