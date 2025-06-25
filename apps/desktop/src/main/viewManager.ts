import { IPC_EVENTS_MAIN } from '@horizon/core/src/lib/service/ipc/events'
import type { WebContentsViewCreateOptions } from '@horizon/types'
import { app, BrowserWindow, WebContentsView } from 'electron'
import { validateIPCSender } from './ipcHandlers'
import { IPCListenerUnsubscribe } from '@horizon/core/src/lib/service/ipc/ipc'
import { EventEmitterBase } from '@horizon/core/src/lib/service/events'
import path, { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isDev } from '@horizon/utils/src/system'

export class WCView {
  id: string
  wcv: WebContentsView

  constructor(opts: WebContentsViewCreateOptions) {
    const view = new WebContentsView({
      webPreferences: {
        partition: opts.partition || undefined,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: opts.sandbox ?? true,
        webSecurity: true,
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

    if (opts.bounds) {
      console.log(
        '[main] webcontentsview-create: setting bounds for view with id',
        this.id,
        'to',
        opts.bounds
      )
      this.wcv.setBounds(opts.bounds)
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
      // Fallback to about:blank if loading fails
      await this.wcv.webContents.loadURL('about:blank')
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
}

export type WCViewManagerEvents = {
  create: (view: WCView) => void
  destroy: (view: WCView) => void
}

export class WCViewManager extends EventEmitterBase<WCViewManagerEvents> {
  window: BrowserWindow
  views: Map<string, WCView>
  activeViewId: string | null = null

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

    this.attachIPCEvents()
  }

  async createView(opts: WebContentsViewCreateOptions) {
    try {
      console.log('[main] webcontentsview-create: creating new view with options', opts)

      const view = new WCView({
        ...opts,
        sandbox: true
      })

      console.log('[main] webcontentsview-create: registering id', view.id)
      this.views.set(view.id, view)
      this.activeViewId = view.id

      this.window.contentView.addChildView(view.wcv)
      console.log('[main] webcontentsview-create: added view to window with id', view.id)

      this.emit('create', view)

      if (opts.url) {
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
    this.activeViewId = view.id

    this.window.contentView.addChildView(view.wcv)
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

  bringViewToFront(id: string) {
    try {
      console.log('[main] webcontentsview-bringToFront: bringing view with id', id, 'to front')

      const view = this.views.get(id)
      if (!view) {
        console.warn('[main] webcontentsview-bringToFront: no view found with id', id)
        return false
      }

      // Remove and re-add to bring to front
      if (this.window.contentView.removeChildView) {
        this.window.contentView.removeChildView(view.wcv)
      }

      this.window.contentView.addChildView(view.wcv)
      console.log('[main] Activated WebContentsView, brought to top for id:', view.id)

      this.activeViewId = view.id

      return true
    } catch (e) {
      console.warn('[main] Could not activate WebContentsView', e)
      return false
    }
  }

  showActiveView() {
    console.log(
      '[main] webcontentsview-showActiveView: showing active view with id',
      this.activeViewId
    )

    if (!this.activeViewId) {
      console.warn('[main] webcontentsview-showActiveView: no active view to show')
      return
    }

    const view = this.views.get(this.activeViewId)
    if (!view) {
      console.warn(
        '[main] webcontentsview-showActiveView: no view found with id',
        this.activeViewId
      )
      return
    }

    this.bringViewToFront(view.id)
    console.log('[main] webcontentsview-showActiveView: view with id', view.id, 'brought to front')
  }

  hideView(id: string) {
    console.log('[main] webcontentsview-hide: hiding view with id', id)
    const view = this.views.get(id)
    if (!view) {
      console.warn('[main] webcontentsview-hide: no view found with id', id)
      return
    }

    try {
      this.window.contentView.removeChildView(view.wcv)
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
        this.window.contentView.removeChildView(view.wcv)
      } catch (e) {
        console.warn('[main] Could not hide WebContentsView', e)
      }
    })
  }

  destroyView(view: WCView) {
    try {
      console.log('[main] webcontentsview-destroy: destroying view with id', view.id)
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
  }

  attachIPCEvents() {
    console.log('[main] webcontentsview-attachIPCEvents: attaching IPC event listeners')
    this.ipcEventListeners = [
      IPC_EVENTS_MAIN.webContentsViewCreate.handle(async (event, data) => {
        try {
          if (!validateIPCSender(event)) return null

          console.log('[main] webcontentsview-create: IPC event received', data)
          const view = await (data.overlayId ? this.createOverlayView(data) : this.createView(data))
          if (view) {
            return { viewId: view.id, webContentsId: view.wcv.webContents.id }
          } else {
            return null
          }
        } catch (error) {
          console.error('[main] webcontentsview-create: error handling IPC event', error)
          return null
        }
      }),

      IPC_EVENTS_MAIN.webContentsViewAction.handle(async (event, { viewId, action }) => {
        try {
          if (!validateIPCSender(event)) return null

          const { type, payload } = action

          console.log('[main] webcontentsview-activate: IPC event received', viewId, type, payload)

          if (type === 'hide-all') {
            console.log('[main] webcontentsview-hideAll: hiding all views')
            this.hideAllViews()
            return true
          } else if (type === 'show-active') {
            console.log('[main] webcontentsview-showActive: showing active view')
            this.showActiveView()
            return true
          }

          const view = this.views.get(viewId)
          if (!view) {
            console.warn('[main] webcontentsview-activate: no view found with id', viewId)
            return true
          }

          if (type === 'activate') {
            console.log('[main] webcontentsview-activate: activating view with id', viewId)
            return this.bringViewToFront(view.id)
          } else if (type === 'reload') {
            console.log('[main] webcontentsview-reload: reloading view with id', viewId)
            view.reload()
            return true
          } else if (type === 'go-forward') {
            console.log('[main] webcontentsview-go-forward: going forward in view with id', viewId)
            view.goForward()
            return true
          } else if (type === 'go-back') {
            console.log('[main] webcontentsview-go-back: going back in view with id', viewId)
            view.goBack()
            return true
          } else if (type === 'destroy') {
            console.log('[main] webcontentsview-close: closing view with id', viewId)
            this.destroyView(view)
            return true
          } else if (type === 'set-bounds') {
            console.log(
              '[main] webcontentsview-setBounds: setting bounds for view with id',
              viewId,
              'to',
              payload.bounds
            )
            view.setBounds(payload.bounds)
            return true
          } else if (type === 'load-url') {
            console.log(
              '[main] webcontentsview-loadURL: loading URL',
              payload.url,
              'for view with id',
              viewId
            )
            await view.loadURL(payload.url)
            return true
          } else if (type === 'hide') {
            console.log('[main] webcontentsview-hide: hiding view with id', viewId)
            this.hideView(viewId)
            return true
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
