import { IPC_EVENTS_MAIN } from '@deta/services/src/ipc/events'
import {
  WebContentsViewActionType,
  WebContentsViewEventType,
  WebContentsViewEventTypeNames,
  WebContentsViewManagerActionType,
  type WebContentsViewCreateOptions
} from '@deta/types'
import { app, BrowserWindow, WebContentsView, session } from 'electron'
import { validateIPCSender } from './ipcHandlers'
import { IPCListenerUnsubscribe } from '@deta/services/src/ipc'
import { EventEmitterBase } from '@deta/utils'
import path, { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isDev } from '@deta/utils/src/system'
import { PDFViewerEntryPoint } from './utils'

export class WCView {
  id: string
  isOverlay: boolean
  attached: boolean
  wcv: WebContentsView
  eventListeners: Array<() => void> = []

  constructor(opts: WebContentsViewCreateOptions) {
    const wcvSession = session.fromPartition('persist:horizon')
    const view = new WebContentsView({
      webPreferences: {
        // partition: opts.partition || undefined,
        session: wcvSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: opts.sandbox ?? true,
        webSecurity: !isDev,
        scrollBounce: true,
        defaultFontSize: 16,
        autoplayPolicy: 'document-user-activation-required',
        preload: opts.preload || path.resolve(__dirname, '../preload/webview.js'),
        additionalArguments: opts.additionalArguments || [],
        transparent: opts.transparent
      }
    })

    this.wcv = view
    this.id = opts.id || view.webContents.id + ''
    this.isOverlay = opts.isOverlay ?? false
    this.attached = false

    if (opts.bounds) {
      console.log(
        '[main] webcontentsview-create: setting bounds for view with id',
        this.id,
        'to',
        opts.bounds
      )
      this.wcv.setBounds(opts.bounds)
    }

    if (opts.navigationHistory) {
      console.log(
        '[main] webcontentsview-create: setting navigation history for view with id',
        this.id,
        'to',
        opts.navigationHistory
      )
      this.wcv.webContents.navigationHistory.restore({
        index: opts.navigationHistoryIndex,
        entries: opts.navigationHistory
      })
    }

    console.log('[main] webcontentsview-create: view created successfully with id', this.id)
  }

  setBounds(bounds: Electron.Rectangle) {
    console.log(
      '[main] webcontentsview-setBounds: setting bounds for view with id',
      this.id,
      'to',
      bounds
    )
    this.wcv.setBounds(bounds)
  }

  async loadURL(url: string) {
    try {
      await this.wcv.webContents.loadURL(url)
    } catch (error) {
      console.error(`[main] Failed to load URL for WebContentsView ${this.id}:`, error)
    }
  }

  async loadOverlay() {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.wcv.webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
    } else {
      this.wcv.webContents.loadFile(join(__dirname, '../renderer/overlay.html'))
    }
  }

  reload(ignoreCache = false) {
    if (ignoreCache) this.wcv.webContents.reloadIgnoringCache()
    else this.wcv.webContents.reload()
  }

  canGoBack() {
    return this.wcv.webContents.navigationHistory.canGoBack()
  }

  canGoForward() {
    return this.wcv.webContents.navigationHistory.canGoForward()
  }

  goBack() {
    if (this.canGoBack()) {
      this.wcv.webContents.navigationHistory.goBack()
    } else {
      console.warn(`[main] WebContentsView ${this.id} cannot go back`)
    }
  }

  goForward() {
    if (this.canGoForward()) {
      this.wcv.webContents.navigationHistory.goForward()
    } else {
      console.warn(`[main] WebContentsView ${this.id} cannot go forward`)
    }
  }

  insertText(text: string) {
    this.wcv.webContents.insertText(text)
  }

  getBounds(): Electron.Rectangle {
    return this.wcv.getBounds()
  }

  focus() {
    this.wcv.webContents.focus()
  }

  setAudioMuted(muted: boolean) {
    this.wcv.webContents.setAudioMuted(muted)
  }

  setZoomFactor(factor: number) {
    this.wcv.webContents.setZoomFactor(factor)
  }

  openDevTools(mode: Electron.OpenDevToolsOptions['mode'] = 'detach') {
    this.wcv.webContents.openDevTools({ mode })
  }

  findInPage(text: string, options: Electron.FindInPageOptions) {
    return this.wcv.webContents.findInPage(text, options)
  }

  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection') {
    this.wcv.webContents.stopFindInPage(action)
  }

  executeJavascript(code: string, userGesture = false) {
    return this.wcv.webContents.executeJavaScript(code, userGesture)
  }

  downloadURL(url: string, options?: Electron.DownloadURLOptions) {
    this.wcv.webContents.downloadURL(url, options)
  }

  isCurrentlyAudible() {
    return this.wcv.webContents.isCurrentlyAudible()
  }

  send(channel: string, args: any[]) {
    this.wcv.webContents.send(channel, ...args)
  }

  getNavigationHistory() {
    const entries = this.wcv.webContents.navigationHistory.getAllEntries()
    const index = this.wcv.webContents.navigationHistory.getActiveIndex()

    return { entries, index }
  }

  async capturePage(rect?: Electron.Rectangle, quality: 'low' | 'medium' | 'high' = 'low') {
    if (!this.wcv || !this.wcv.webContents || this.wcv.webContents.isDestroyed()) {
      console.warn(`[main] WebContentsView ${this.id} screenshot capture failed: no web contents`)
      return null
    }

    const nativeImage = await this.wcv.webContents.capturePage(rect)
    if (nativeImage.isEmpty()) {
      console.warn(`[main] WebContentsView ${this.id} screenshot capture failed: empty image`)
      return null
    }

    let opts = {
      quality: 'best'
    } as Electron.ResizeOptions

    if (quality === 'medium') {
      opts = {
        width: Math.floor(nativeImage.getSize().width / 1.5),
        height: Math.floor(nativeImage.getSize().height / 1.5),
        quality: 'better'
      }
    } else if (quality === 'low') {
      opts = {
        width: Math.floor(nativeImage.getSize().width / 3),
        height: Math.floor(nativeImage.getSize().height / 3),
        quality: 'good'
      }
    }

    const resizedImage = nativeImage.resize(opts)

    return resizedImage.toDataURL()
  }

  attachEventListener(
    event: WebContentsViewEventTypeNames,
    callback: (...args: any[]) => void
  ): () => void {
    this.wcv.webContents.addListener(event as any, callback)

    const unsub = () => {
      this.wcv.webContents.removeListener(event as any, callback)
      const index = this.eventListeners.indexOf(unsub)
      if (index > -1) {
        this.eventListeners.splice(index, 1)
      }
    }

    this.eventListeners.push(unsub)

    return unsub
  }

  onDestroy() {
    console.log('[main] webcontentsview-destroy: destroying view with id', this.id)
    this.eventListeners.forEach((unsub) => unsub())
    this.wcv.webContents.removeAllListeners()
    this.wcv.webContents.close()
  }
}

export type WCViewManagerEvents = {
  create: (view: WCView) => void
  destroy: (view: WCView) => void
}

export class WCViewManager extends EventEmitterBase<WCViewManagerEvents> {
  window: BrowserWindow
  views: Map<string, WCView>
  activeViewId: string | null = null
  activeOverlayViewId: string | null = null

  ipcEventListeners: IPCListenerUnsubscribe[] = []

  constructor(window: BrowserWindow) {
    super()

    this.window = window
    this.views = new Map<string, WCView>()

    this.window.on('close', () => {
      console.log('[main] webcontentsview-destroy: main window closed, cleaning up')
      this.cleanup()
    })

    this.window.webContents.on('destroyed', () => {
      console.log('[main] webcontentsview-destroy: web contents destroyed, cleaning up')
      this.cleanup()
    })

    this.window.webContents.on('did-navigate', () => {
      console.log(
        '[main] webcontentsview-destroy: web contents finished load, removing left over views'
      )
      this.destoryAllViews()
    })

    this.attachIPCEvents()
  }

  async createView(opts: WebContentsViewCreateOptions) {
    try {
      const { navigationHistory, ...logOptions } = opts
      console.log('[main] webcontentsview-create: creating new view with options', logOptions)

      const view = new WCView({
        ...opts,
        additionalArguments: [
          ...(opts.additionalArguments || []),
          `--pdf-viewer-entry-point=${PDFViewerEntryPoint}`
        ],
        sandbox: true
      })

      console.log('[main] webcontentsview-create: registering id', view.id)
      this.views.set(view.id, view)

      if (opts.activate) {
        if (opts.isOverlay) {
          this.activeOverlayViewId = view.id

          this.hideAllViews()
        } else {
          this.activeViewId = view.id
        }

        this.addChildView(view)
      }

      console.log('[main] webcontentsview-create: added view to window with id', view.id)

      this.attachViewIPCEvents(view)

      this.emit('create', view)

      if (opts.url && (opts.navigationHistory ?? []).length === 0) {
        console.log(
          '[main] webcontentsview-create: loading URL',
          opts.url,
          'for view with id',
          view.id
        )
        view.loadURL(opts.url)
      }

      return view
    } catch (e) {
      console.error('[main] webcontentsview-create: error creating view', e)
      return null
    }
  }

  async createOverlayView(opts: WebContentsViewCreateOptions) {
    const additionalArgs = [
      `--userDataPath=${app.getPath('userData')}`,
      `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
      `--overlayId=${opts.overlayId || 'default'}`,
      ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []),
      ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS ? ['--disable-tab-switching-shortcuts'] : [])
    ]

    console.log('createOverlayView: all additional args', additionalArgs)

    const view = new WCView({
      partition: 'persist:surf-app-session',
      preload: path.resolve(__dirname, '../preload/overlay.js'),
      additionalArguments: additionalArgs,
      sandbox: false,
      transparent: true,
      ...opts
    })

    view.wcv.setBorderRadius(18)

    console.log('[main] webcontentsview-create: registering id', view.id)
    this.views.set(view.id, view)
    this.activeOverlayViewId = view.id

    this.addChildView(view)
    console.log('[main] webcontentsview-create: added view to window with id', view.id)

    this.emit('create', view)

    if (opts.overlayId) {
      console.log(
        '[main] webcontentsview-create: loading overlay for view with id',
        view.id,
        'and overlayId',
        opts.overlayId
      )

      view.loadOverlay()
    }

    view.wcv.webContents.on('blur', () => {
      console.log('[main] webcontentsview-blur: view with id', view.id, 'lost focus, hiding it')
      this.hideView(view.id)
    })

    return view
  }

  setViewBounds(id: string, bounds: Electron.Rectangle) {
    console.log(
      '[main] webcontentsview-setBounds: setting bounds for view with id',
      id,
      'to',
      bounds
    )
    const view = this.views.get(id)
    if (!view) {
      console.warn('[main] webcontentsview-setBounds: no view found with id', id)
      return
    }

    view.setBounds(bounds)
  }

  async loadViewURL(id: string, url: string) {
    console.log('[main] webcontentsview-loadURL: loading URL', url, 'for view with id', id)
    const view = this.views.get(id)
    if (!view) {
      console.warn('[main] webcontentsview-loadURL: no view found with id', id)
      return
    }

    await view.loadURL(url)
  }

  addChildView(view: WCView) {
    this.window.contentView.addChildView(view.wcv)
    view.attached = true
  }

  removeChildView(view: WCView) {
    this.window.contentView.removeChildView(view.wcv)
    view.attached = false
  }

  bringViewToFront(id: string) {
    try {
      console.log('[main] webcontentsview-bringToFront: bringing view with id', id, 'to front')

      const view = this.views.get(id)
      if (!view) {
        console.warn('[main] webcontentsview-bringToFront: no view found with id', id)
        return false
      }

      // Remove and re-add to bring to front
      this.removeChildView(view)
      this.addChildView(view)
      console.log('[main] Activated WebContentsView, brought to top for id:', view.id)

      if (view.isOverlay) {
        this.activeOverlayViewId = view.id
      } else {
        this.activeViewId = view.id
      }

      return true
    } catch (e) {
      console.warn('[main] Could not activate WebContentsView', e)
      return false
    }
  }

  activateView(id: string) {
    console.log('[main] webcontentsview-activate: activating view with id', id)

    const view = this.views.get(id)
    if (!view) {
      console.warn('[main] webcontentsview-activate: no view found with id', id)
      return false
    }

    const success = this.bringViewToFront(view.id)

    view.focus()
    return success
  }

  showActiveView(id?: string) {
    const activeViewId = id || this.activeViewId
    console.log('[main] webcontentsview-showActiveView: showing active view with id', activeViewId)

    if (!activeViewId) {
      console.warn('[main] webcontentsview-showActiveView: no active view to show')
      return
    }

    const view = this.views.get(activeViewId)
    if (!view) {
      console.warn('[main] webcontentsview-activate: no view found with id', id)
      return false
    }

    if (!this.activeOverlayViewId || view.isOverlay) {
      console.log('[main] webcontentsview-activate: activating view with id', activeViewId)
      return this.activateView(activeViewId)
    }

    const overlayView = this.views.get(this.activeOverlayViewId)
    if (!overlayView) {
      console.warn('[main] webcontentsview-activate: no active overlay view found')
      return false
    }

    console.log(
      '[main] webcontentsview-activate: activating overlay view with id',
      this.activeOverlayViewId
    )
    return this.activateView(activeViewId)
  }

  hideView(id: string) {
    console.log('[main] webcontentsview-hide: hiding view with id', id)
    const view = this.views.get(id)
    if (!view) {
      console.warn('[main] webcontentsview-hide: no view found with id', id)
      return
    }

    try {
      this.removeChildView(view)
      console.log('[main] webcontentsview-hide: view with id', id, 'hidden successfully')
    } catch (e) {
      console.warn('[main] Could not hide WebContentsView', e)
    }
  }

  hideAllViews() {
    console.log('[main] webcontentsview-hideAllViews: hiding all views')
    this.views.forEach((view) => {
      try {
        console.log('[main] webcontentsview-hideAllViews: hiding view with id', view.id)
        this.removeChildView(view)
      } catch (e) {
        console.warn('[main] Could not hide WebContentsView', e)
      }
    })

    // focus the main window after hiding all views
    this.window.webContents.focus()
  }

  destroyView(view: WCView) {
    try {
      console.log('[main] webcontentsview-destroy: destroying view with id', view.id)

      view.onDestroy()

      if (this.activeViewId === view.id) {
        console.log('[main] webcontentsview-destroy: clearing active view id', view.id)
        this.activeViewId = null
      }

      if (this.activeOverlayViewId === view.id) {
        console.log('[main] webcontentsview-destroy: clearing active overlay view id', view.id)
        this.activeOverlayViewId = null
      }

      this.window.contentView.removeChildView(view.wcv)
      console.log('[main] Removed WebContentsView from window for id:', view.id)

      this.emit('destroy', view)
    } catch (e) {
      console.warn('[main] Could not remove child view', e)
    }

    this.views.delete(view.id)
  }

  destoryAllViews() {
    console.log('[main] webcontentsview-destroy: destroying all views')

    this.views.forEach((view) => {
      this.destroyView(view)
    })

    const remainingViews = this.window.contentView.children
    if (remainingViews.length > 0) {
      console.warn(
        '[main] webcontentsview-destroy: some views were not removed, remaining:',
        remainingViews.length
      )
      remainingViews.forEach((remainingView) => {
        this.window.contentView.removeChildView(remainingView)
      })
    }
  }

  attachViewIPCEvents(view: WCView) {
    // TODO: find way to automatically forward all events from WebContentsView to IPC without manually attaching each one

    view.attachEventListener('did-start-loading', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DID_START_LOADING,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('did-stop-loading', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DID_STOP_LOADING,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('did-finish-load', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DID_FINISH_LOAD,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('did-fail-load', (_e, ...args) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DID_FAIL_LOAD,
        viewId: view.id,
        payload: {
          errorCode: args[0],
          errorDescription: args[1],
          validatedURL: args[2],
          isMainFrame: args[3],
          frameProcessId: args[4],
          frameRoutingId: args[5]
        }
      })
    })

    view.attachEventListener('dom-ready', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DOM_READY,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener(
      'will-navigate',
      (details, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
        IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
          type: WebContentsViewEventType.WILL_NAVIGATE,
          viewId: view.id,
          payload: {
            details,
            url,
            isInPlace,
            isMainFrame,
            frameProcessId,
            frameRoutingId
          }
        })
      }
    )

    view.attachEventListener('did-navigate', (_e, url, httpResponseCode, httpStatusText) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DID_NAVIGATE,
        viewId: view.id,
        payload: {
          url,
          httpResponseCode,
          httpStatusText
        }
      })
    })

    view.attachEventListener(
      'did-navigate-in-page',
      (_e, url, isMainFrame, frameProcessId, frameRoutingId) => {
        IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
          type: WebContentsViewEventType.DID_NAVIGATE_IN_PAGE,
          viewId: view.id,
          payload: {
            url,
            isMainFrame,
            frameProcessId,
            frameRoutingId
          }
        })
      }
    )

    view.attachEventListener('update-target-url', (_e, url) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.UPDATE_TARGET_URL,
        viewId: view.id,
        payload: { url }
      })
    })

    view.attachEventListener('page-title-updated', (_e, title, explicitSet) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.PAGE_TITLE_UPDATED,
        viewId: view.id,
        payload: { title, explicitSet }
      })
    })

    view.attachEventListener('page-favicon-updated', (_e, favicons) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.PAGE_FAVICON_UPDATED,
        viewId: view.id,
        payload: { favicons }
      })
    })

    view.attachEventListener('media-started-playing', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.MEDIA_STARTED_PLAYING,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('media-paused', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.MEDIA_PAUSED,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('focus', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.FOCUS,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('blur', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.BLUR,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('found-in-page', (_e, result) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.FOUND_IN_PAGE,
        viewId: view.id,
        payload: { result }
      })
    })

    view.attachEventListener('ipc-message', (_e, channel, ...args) => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.IPC_MESSAGE,
        viewId: view.id,
        payload: { channel, args }
      })
    })

    view.attachEventListener('enter-html-full-screen', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.ENTER_HTML_FULL_SCREEN,
        viewId: view.id,
        payload: undefined
      })
    })

    view.attachEventListener('leave-html-full-screen', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.LEAVE_HTML_FULL_SCREEN,
        viewId: view.id,
        payload: undefined
      })
    })
  }

  attachIPCEvents() {
    console.log('[main] webcontentsview-attachIPCEvents: attaching IPC event listeners')
    this.ipcEventListeners = [
      IPC_EVENTS_MAIN.webContentsViewManagerAction.handle(async (event, { type, payload }) => {
        try {
          if (!validateIPCSender(event)) return null

          console.log('[main] webcontentsview-manager-action: IPC event received', type)

          if (type === WebContentsViewManagerActionType.CREATE) {
            const view = await (payload.overlayId
              ? this.createOverlayView(payload)
              : this.createView(payload))
            if (view) {
              return { viewId: view.id, webContentsId: view.wcv.webContents.id }
            } else {
              return null
            }
          } else if (type === WebContentsViewManagerActionType.HIDE_ALL) {
            console.log('[main] webcontentsview-hideAll: IPC event received, hiding all views')
            this.hideAllViews()
            return true
          } else if (type === WebContentsViewManagerActionType.SHOW_ACTIVE) {
            console.log(
              '[main] webcontentsview-showActive: IPC event received, showing active view'
            )
            this.showActiveView(payload?.id)
            return true
          } else {
            return null
          }
        } catch (error) {
          console.error('[main] webcontentsview-manager-action: error handling IPC event', error)
          return null
        }
      }),

      IPC_EVENTS_MAIN.webContentsViewAction.handle(async (event, { viewId, action }) => {
        try {
          if (!validateIPCSender(event)) return null

          const { type, payload } = action

          console.log('[main] webcontentsview-action: IPC event received', viewId, type, payload)
          const view = this.views.get(viewId)
          if (!view) {
            console.warn('[main] webcontentsview-activate: no view found with id', viewId)
            return true
          }

          if (type === WebContentsViewActionType.ACTIVATE) {
            return this.activateView(view.id)
          } else if (type === WebContentsViewActionType.RELOAD) {
            view.reload()
            return true
          } else if (type === WebContentsViewActionType.GO_FORWARD) {
            view.goForward()
            return true
          } else if (type === WebContentsViewActionType.GO_BACK) {
            view.goBack()
            return true
          } else if (type === WebContentsViewActionType.DESTROY) {
            this.destroyView(view)
            return true
          } else if (type === WebContentsViewActionType.SET_BOUNDS) {
            view.setBounds(payload)
            return true
          } else if (type === WebContentsViewActionType.LOAD_URL) {
            await view.loadURL(payload.url)
            return true
          } else if (type === WebContentsViewActionType.HIDE) {
            this.hideView(viewId)
            return true
          } else if (type === WebContentsViewActionType.INSERT_TEXT) {
            view.insertText(payload.text)
            return true
          } else if (type === WebContentsViewActionType.GET_URL) {
            return view.wcv.webContents.getURL()
          } else if (type === WebContentsViewActionType.FOCUS) {
            if (view.isOverlay && this.activeOverlayViewId !== view.id) {
              this.bringViewToFront(view.id)
            } else if (this.activeViewId !== view.id) {
              this.bringViewToFront(view.id)
            }

            view.focus()
            return true
          } else if (type === WebContentsViewActionType.SET_AUDIO_MUTED) {
            view.setAudioMuted(payload)
            return true
          } else if (type === WebContentsViewActionType.SET_ZOOM_FACTOR) {
            view.setZoomFactor(payload)
            return true
          } else if (type === WebContentsViewActionType.OPEN_DEV_TOOLS) {
            view.openDevTools(payload.mode)
            return true
          } else if (type === WebContentsViewActionType.SEND) {
            view.send(payload.channel, payload.args || [])
            return true
          } else if (type === WebContentsViewActionType.FIND_IN_PAGE) {
            return view.findInPage(payload.text, payload.options || {})
          } else if (type === WebContentsViewActionType.STOP_FIND_IN_PAGE) {
            view.stopFindInPage(payload.action)
            return true
          } else if (type === WebContentsViewActionType.EXECUTE_JAVASCRIPT) {
            return await view.executeJavascript(payload.code, payload.userGesture)
          } else if (type === WebContentsViewActionType.DOWNLOAD_URL) {
            view.downloadURL(payload.url, payload.options)
            return true
          } else if (type === WebContentsViewActionType.IS_CURRENTLY_AUDIBLE) {
            return view.isCurrentlyAudible()
          } else if (type === WebContentsViewActionType.GET_NAVIGATION_HISTORY) {
            return view.getNavigationHistory()
          } else if (type === WebContentsViewActionType.CAPTURE_PAGE) {
            let hideAgain = false
            if (!view.attached) {
              this.addChildView(view)
              hideAgain = true
            }

            const image = await view.capturePage(payload?.rect, payload?.quality)

            if (hideAgain) {
              this.removeChildView(view)
            }

            return image
          }

          return false
        } catch (error) {
          console.error('[main] webcontentsview-create: error handling IPC event', error)
          return null
        }
      })
    ]
  }

  removeIPCEvents() {
    console.log(
      '[main] webcontentsview-removeIPCEvents: removing IPC event listeners',
      this.ipcEventListeners.length
    )
    this.ipcEventListeners.forEach((listener) => {
      listener()
    })
    this.ipcEventListeners = []
  }

  cleanup() {
    this.destoryAllViews()
    this.removeIPCEvents()
  }
}

export const attachWCViewManager = (window: BrowserWindow) => new WCViewManager(window)
