import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import {
  WebContentsViewActionType,
  WebContentsViewEventType,
  WebContentsViewEventTypeNames,
  WebContentsViewManagerActionType,
  type WebContentsViewCreateOptions
} from '@deta/types'
import { app, BrowserWindow, WebContentsView, session, nativeTheme } from 'electron'
import { validateIPCSender } from './ipcHandlers'
import { IPCListenerUnsubscribe } from '@deta/services/ipc'
import { EventEmitterBase, useLogScope } from '@deta/utils'
import path from 'path'
import { isDev } from '@deta/utils/system'
import { checkIfSurfProtocolUrl, PDFViewerEntryPoint } from './utils'
import { MessageChannelMain } from 'electron/main'
import { getUserConfig } from './config'

const log = useLogScope('ViewManager')

type ContentData = {
  title: string
}

export class WCView {
  manager: WCViewManager

  id: string
  isOverlay: boolean
  attached: boolean
  opts: WebContentsViewCreateOptions
  wcv: WebContentsView
  eventListeners: Array<() => void> = []

  contentData: ContentData = {
    title: ''
  }

  constructor(opts: WebContentsViewCreateOptions, manager: WCViewManager, extraOpts?: any) {
    this.manager = manager
    this.opts = opts

    log.log('[main] webcontentsview-create: creating new WebContentsView with options', opts)

    const parition = opts.partition || 'persist:horizon'
    const wcvSession = session.fromPartition(parition)

    // Get user theme to set initial background color and prevent white flash
    const userConfig = getUserConfig()
    const isDarkMode = userConfig.settings?.app_style === 'dark'
    const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff'

    const view = new WebContentsView({
      ...extraOpts,
      webPreferences: {
        session: wcvSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: opts.sandbox ?? true,
        webSecurity: !isDev,
        scrollBounce: true,
        defaultFontSize: 16,
        spellcheck: false,
        autoplayPolicy: 'document-user-activation-required',
        preload: opts.preload || path.resolve(__dirname, '../preload/webcontents.js'),
        additionalArguments: opts.additionalArguments || [],
        transparent: opts.transparent,
        webviewTag: true,
        backgroundColor
      }
    })

    this.wcv = view
    this.id = opts.id || view.webContents.id + ''
    this.isOverlay = opts.isOverlay ?? false
    this.attached = false

    if (opts.bounds) {
      log.log(
        '[main] webcontentsview-create: setting bounds for view with id',
        this.id,
        'to',
        opts.bounds
      )
      this.wcv.setBounds(opts.bounds)
    }

    if (
      opts.navigationHistory &&
      opts.navigationHistoryIndex !== undefined &&
      opts.navigationHistory.length > 0 &&
      opts.navigationHistoryIndex >= 0
    ) {
      log.log(
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

    log.log('[main] webcontentsview-create: view created successfully with id', this.id)
  }

  setBounds(bounds: Partial<Electron.Rectangle>) {
    log.log(
      '[main] webcontentsview-setBounds: setting bounds for view with id',
      this.id,
      'to',
      bounds
    )

    const currentBounds = this.wcv.getBounds()
    const fullBounds = {
      ...currentBounds,
      ...bounds
    }

    this.wcv.setBounds(fullBounds)
  }

  recreateWCVWithDifferentWebPreferences(webPreferences: Electron.WebPreferences) {
    const currentBounds = this.wcv.getBounds()
    const currentNavigationHistory = this.wcv.webContents.navigationHistory.getAllEntries()
    const currentNavigationHistoryIndex = this.wcv.webContents.navigationHistory.getActiveIndex()

    this.eventListeners.forEach((unsub) => unsub())
    this.wcv.webContents.removeAllListeners()
    this.wcv.webContents.close()

    log.log('[main] webcontentsview-recreate: re-creating WebContentsView with new preferences')

    const wcvSession = session.fromPartition('persist:horizon')

    // Get user theme to set initial background color and prevent white flash
    const userConfig = getUserConfig()
    const isDarkMode = userConfig.settings?.app_style === 'dark'
    const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff'

    this.wcv = new WebContentsView({
      webPreferences: {
        session: wcvSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: !isDev,
        scrollBounce: true,
        defaultFontSize: 16,
        autoplayPolicy: 'document-user-activation-required',
        preload: this.opts.preload || path.resolve(__dirname, '../preload/webcontents.js'),
        additionalArguments: this.opts.additionalArguments || [],
        transparent: this.opts.transparent,
        backgroundColor,
        ...webPreferences
      }
    })

    if (currentBounds) {
      this.wcv.setBounds(currentBounds)
    }

    if (currentNavigationHistory.length > 0 && currentNavigationHistoryIndex >= 0) {
      this.wcv.webContents.navigationHistory.restore({
        index: currentNavigationHistoryIndex,
        entries: currentNavigationHistory
      })
    }
    this.manager.recreatedWCV(this)
  }
  loadRightPreload(newUrl: string, oldUrl: string) {
    log.log('[main] webcontentsview: check if we need to re-create WCV', newUrl, oldUrl)

    if (!oldUrl) {
      log.log('[main] webcontentsview: no old URL to compare against')
      return
    }

    const newIsSurfUrl = checkIfSurfProtocolUrl(newUrl) && !newUrl.startsWith(PDFViewerEntryPoint)
    const oldIsSurfUrl = checkIfSurfProtocolUrl(oldUrl) && !oldUrl.startsWith(PDFViewerEntryPoint)

    // if we load a surf:// URL, we need to re-create the WebContentsView with a different preload
    if (newIsSurfUrl && !oldIsSurfUrl) {
      log.log(
        '[main] webcontentsview: loading surf:// URL, re-creating WCV with resource view preload'
      )
      this.recreateWCVWithDifferentWebPreferences({
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.resolve(__dirname, '../preload/resource.js')
      })
    } else if (!newIsSurfUrl && oldIsSurfUrl) {
      log.log(
        '[main] webcontentsview: loading non-surf:// URL, re-creating WCV with webcontents preload'
      )
      this.recreateWCVWithDifferentWebPreferences({
        preload: path.resolve(__dirname, '../preload/webcontents.js')
      })
    }
  }

  async loadURL(url: string) {
    try {
      const oldUrl = this.wcv.webContents.getURL()

      this.loadRightPreload(url, oldUrl)

      await this.wcv.webContents.loadURL(url)
    } catch (error) {
      log.error(`[main] Failed to load URL for WebContentsView ${this.id}:`, error)
    }
  }

  async loadOverlay() {
    this.wcv.webContents.loadURL('surf-internal://Core/Overlay/overlay.html')
    // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    //   this.wcv.webContents.loadURL(
    //     `${process.env['ELECTRON_RENDERER_URL']}/Overlay/overlay.html?overlayId=${this.opts.overlayId}`
    //   )
    // } else {
    //   this.wcv.webContents.loadFile(
    //     join(__dirname, `../renderer/Overlay/overlay.html?overlayId=${this.opts.overlayId}`)
    //   )
    // }
  }

  changePermanentlyActive(value: boolean) {
    this.opts.permanentlyActive = value
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
      const newUrl = this.wcv.webContents.navigationHistory.getEntryAtIndex(
        this.wcv.webContents.navigationHistory.getActiveIndex() - 1
      )?.url
      log.log('[main] WebContentsView', this.id, 'navigating back to URL', newUrl)

      this.loadRightPreload(newUrl, this.wcv.webContents.getURL())

      this.wcv.webContents.navigationHistory.goBack()
    } else {
      log.warn(`[main] WebContentsView ${this.id} cannot go back`)
    }
  }

  goForward() {
    if (this.canGoForward()) {
      const newUrl = this.wcv.webContents.navigationHistory.getEntryAtIndex(
        this.wcv.webContents.navigationHistory.getActiveIndex() + 1
      )?.url
      log.log('[main] WebContentsView', this.id, 'navigating forward to URL', newUrl)

      this.loadRightPreload(newUrl, this.wcv.webContents.getURL())

      this.wcv.webContents.navigationHistory.goForward()
    } else {
      log.warn(`[main] WebContentsView ${this.id} cannot go forward`)
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

  getZoomFactor() {
    return this.wcv.webContents.getZoomFactor()
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
      log.warn(`[main] WebContentsView ${this.id} screenshot capture failed: no web contents`)
      return null
    }

    const nativeImage = await this.wcv.webContents.capturePage(rect)
    if (nativeImage.isEmpty()) {
      log.warn(`[main] WebContentsView ${this.id} screenshot capture failed: empty image`)
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
    log.log('[main] webcontentsview-destroy: destroying view with id', this.id)
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

    const config = getUserConfig()
    const initialColorScheme = config.settings?.app_style || 'light'
    // Set nativeTheme to allow websites to detect dark mode preference via prefers-color-scheme
    nativeTheme.themeSource = initialColorScheme

    this.window.on('close', () => {
      log.log('[main] webcontentsview-destroy: main window closed, cleaning up')
      this.cleanup()
    })

    this.window.webContents.on('destroyed', () => {
      log.log('[main] webcontentsview-destroy: web contents destroyed, cleaning up')
      this.cleanup()
    })

    this.window.webContents.on('did-navigate', () => {
      log.log(
        '[main] webcontentsview-destroy: web contents finished load, removing left over views'
      )
      this.destoryAllViews()
    })

    this.attachIPCEvents()
  }

  applyColorSchemeToView(view: WCView, colorScheme: 'light' | 'dark') {
    // This method is now only used for overlay views
    // Regular views get color scheme injection via attachViewIPCEvents dom-ready handler
    if (view.wcv && !view.wcv.webContents.isDestroyed() && view.isOverlay) {
      const url = view.wcv.webContents.getURL()
      const isSurfUrl = checkIfSurfProtocolUrl(url) || url.startsWith('surf-internal://')

      if (isSurfUrl) {
        view.wcv.webContents
          .executeJavaScript(
            `
          if (document.documentElement) {
            document.documentElement.dataset.colorScheme = '${colorScheme}';
            document.documentElement.style.colorScheme = '${colorScheme}';
          }
        `
          )
          .catch((err) => {
            log.warn('[main] Failed to inject color scheme into overlay view:', view.id, err)
          })
      }
    }
  }

  updateAllViewsColorScheme(colorScheme: 'light' | 'dark') {
    log.log('[main] Updating all WebContentsView color schemes to:', colorScheme)

    // Set nativeTheme to allow websites to detect dark mode preference via prefers-color-scheme
    nativeTheme.themeSource = colorScheme

    // Inject color scheme into all existing views (only for internal surf:// URLs)
    this.views.forEach((view) => {
      if (view.wcv && !view.wcv.webContents.isDestroyed()) {
        const url = view.wcv.webContents.getURL()
        const isSurfUrl = checkIfSurfProtocolUrl(url) || url.startsWith('surf-internal://')

        if (isSurfUrl) {
          view.wcv.webContents
            .executeJavaScript(
              `
            if (document.documentElement) {
              document.documentElement.dataset.colorScheme = '${colorScheme}';
              document.documentElement.style.colorScheme = '${colorScheme}';
            }
          `
            )
            .catch((err) => {
              log.warn('[main] Failed to inject color scheme into view:', view.id, err)
            })
        }
      }
    })
  }

  getWebContentsViews() {
    return Array.from(this.views.values()).map((v) => v.wcv)
  }

  async createView(opts: WebContentsViewCreateOptions) {
    try {
      const { navigationHistory, ...logOptions } = opts

      const currentEntry =
        opts.navigationHistory &&
        opts.navigationHistoryIndex !== undefined &&
        opts.navigationHistory.length > 0 &&
        opts.navigationHistoryIndex >= 0
          ? opts.navigationHistory[opts.navigationHistoryIndex]
          : null

      const url = currentEntry?.url ?? opts.url

      const newIsSurfUrl = url ? checkIfSurfProtocolUrl(url) : false

      log.log('[main] webcontentsview-create: creating new view with options', logOptions, {
        url,
        newIsSurfUrl
      })

      const view = new WCView(
        {
          ...opts,
          additionalArguments: [
            ...(opts.additionalArguments || []),
            `--userDataPath=${app.getPath('userData')}`,
            `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
            `--pdf-viewer-entry-point=${PDFViewerEntryPoint}`,
            ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []),
            ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS
              ? ['--disable-tab-switching-shortcuts']
              : [])
          ],
          sandbox: false,
          preload: newIsSurfUrl
            ? path.resolve(__dirname, '../preload/resource.js')
            : path.resolve(__dirname, '../preload/webcontents.js')
        },
        this
      )

      log.log('[main] webcontentsview-create: registering id', view.id)
      this.views.set(view.id, view)

      if (opts.activate) {
        if (opts.isOverlay) {
          this.activeOverlayViewId = view.id

          this.hideAllViews()
        } else {
          this.activeViewId = view.id
        }

        this.addChildView(view)
      } else if (opts.permanentlyActive) {
        this.addChildView(view)
      }

      log.log('[main] webcontentsview-create: added view to window with id', view.id)

      this.attachViewIPCEvents(view)

      this.emit('create', view)

      if (opts.url && (opts.navigationHistory ?? []).length === 0) {
        log.log('[main] webcontentsview-create: loading URL', opts.url, 'for view with id', view.id)
        view.loadURL(opts.url)
      } /*else if (
        opts.navigationHistory
        && opts.navigationHistoryIndex !== undefined
        && opts.navigationHistory.length > 0
        && opts.navigationHistoryIndex >= 0
      ) {
        const currentEntry = opts.navigationHistory[opts.navigationHistoryIndex]
        view.loadURL(currentEntry.url ?? opts.url)
      }*/

      this.positionOverlays()

      return view
    } catch (e) {
      log.error('[main] webcontentsview-create: error creating view', e)
      return null
    }
  }

  createOverlayView(opts: WebContentsViewCreateOptions, extraOpts?: any) {
    const additionalArgs = [
      `--userDataPath=${app.getPath('userData')}`,
      `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
      `--overlayId=${opts.overlayId || 'default'}`,
      ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []),
      ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS ? ['--disable-tab-switching-shortcuts'] : [])
    ]

    log.log('createOverlayView with opts', opts, 'and args', additionalArgs)

    const view = new WCView(
      {
        partition: 'persist:surf-app-session',
        preload: path.resolve(__dirname, '../preload/overlay.js'),
        additionalArguments: additionalArgs,
        sandbox: false,
        transparent: true,
        ...opts
      },
      this,
      extraOpts
    )

    // view.wcv.setBorderRadius(18)

    log.log('[main] webcontentsview-create: registering id', view.id)
    this.views.set(view.id, view)
    this.activeOverlayViewId = view.id

    //this.addChildView(view)
    log.log('[main] webcontentsview-create: added view to window with id', view.id)

    this.emit('create', view)

    // Apply current color scheme to newly created overlay view
    const config = getUserConfig()
    const colorScheme = config?.settings?.app_style || 'light'
    this.applyColorSchemeToView(view, colorScheme)

    if (opts.overlayId) {
      log.log(
        '[main] webcontentsview-create: loading overlay for view with id',
        view.id,
        'and overlayId',
        opts.overlayId
      )

      view.loadOverlay()
    }

    // view.wcv.webContents.on('blur', () => {
    //   log.log('[main] webcontentsview-blur: view with id', view.id, 'lost focus, hiding it')
    //   this.hideView(view.id)
    // })

    return view
  }

  positionOverlays() {
    if (!this.activeOverlayViewId) {
      log.log('[main] webcontentsview-positionOverlays: no active overlay view to position')
      return
    }

    const overlayView = this.views.get(this.activeOverlayViewId)
    if (!overlayView) {
      log.warn(
        '[main] webcontentsview-positionOverlays: no overlay view found with id',
        this.activeOverlayViewId
      )
      return
    }

    this.bringViewToFront(overlayView.id)
  }

  recreatedWCV(view: WCView) {
    log.log('[main] webcontentsview-recreated: view with id', view.id, 'was re-created')
    this.views.set(view.id, view)

    this.attachViewIPCEvents(view)
    this.addChildView(view)

    this.emit('create', view)
  }

  setViewBounds(id: string, bounds: Electron.Rectangle) {
    log.log('[main] webcontentsview-setBounds: setting bounds for view with id', id, 'to', bounds)
    const view = this.views.get(id)
    if (!view) {
      log.warn('[main] webcontentsview-setBounds: no view found with id', id)
      return
    }

    view.setBounds(bounds)
  }

  async loadViewURL(id: string, url: string) {
    log.log('[main] webcontentsview-loadURL: loading URL', url, 'for view with id', id)
    const view = this.views.get(id)
    if (!view) {
      log.warn('[main] webcontentsview-loadURL: no view found with id', id)
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
      log.log('[main] webcontentsview-bringToFront: bringing view with id', id, 'to front')

      const view = this.views.get(id)
      if (!view) {
        log.warn('[main] webcontentsview-bringToFront: no view found with id', id)
        return false
      }

      // Remove and re-add to bring to front
      this.removeChildView(view)
      this.addChildView(view)
      log.log('[main] Activated WebContentsView, brought to top for id:', view.id)

      if (view.isOverlay) {
        this.activeOverlayViewId = view.id
      } else {
        this.activeViewId = view.id
      }

      return true
    } catch (e) {
      log.warn('[main] Could not activate WebContentsView', e)
      return false
    }
  }

  activateView(id: string) {
    log.log('[main] webcontentsview-activate: activating view with id', id)

    const view = this.views.get(id)
    if (!view) {
      log.warn('[main] webcontentsview-activate: no view found with id', id)
      return false
    }

    const success = this.bringViewToFront(view.id)

    this.positionOverlays()

    view.focus()
    return success
  }

  showActiveView(id?: string) {
    const activeViewId = id || this.activeViewId
    log.log('[main] webcontentsview-showActiveView: showing active view with id', activeViewId)

    if (!activeViewId) {
      log.warn('[main] webcontentsview-showActiveView: no active view to show')
      return
    }

    const view = this.views.get(activeViewId)
    if (!view) {
      log.warn('[main] webcontentsview-activate: no view found with id', id)
      return false
    }

    if (!this.activeOverlayViewId || view.isOverlay) {
      log.log('[main] webcontentsview-activate: activating view with id', activeViewId)
      return this.activateView(activeViewId)
    }

    const overlayView = this.views.get(this.activeOverlayViewId)
    if (!overlayView) {
      log.warn('[main] webcontentsview-activate: no active overlay view found')
      return false
    }

    log.log(
      '[main] webcontentsview-activate: activating overlay view with id',
      this.activeOverlayViewId
    )
    return this.activateView(activeViewId)
  }

  hideView(id: string) {
    log.log('[main] webcontentsview-hide: hiding view with id', id)
    const view = this.views.get(id)
    if (!view) {
      log.warn('[main] webcontentsview-hide: no view found with id', id)
      return
    }

    try {
      this.removeChildView(view)
      log.log('[main] webcontentsview-hide: view with id', id, 'hidden successfully')
    } catch (e) {
      log.warn('[main] Could not hide WebContentsView', e)
    }
  }

  hideAllViews(opts?: { hidePermanentlyActive?: boolean }) {
    const options = {
      hidePermanentlyActive: opts?.hidePermanentlyActive ?? false
    }

    log.log('[main] webcontentsview-hideAllViews: hiding all views with options', options)
    this.views.forEach((view) => {
      try {
        if (view.opts.permanentlyActive && !options.hidePermanentlyActive) {
          log.log(
            '[main] webcontentsview-hideAllViews: skipping permanently active view with id',
            view.id
          )
          return
        }

        log.log('[main] webcontentsview-hideAllViews: hiding view with id', view.id)
        this.removeChildView(view)
      } catch (e) {
        log.warn('[main] Could not hide WebContentsView', e)
      }
    })

    // focus the main window after hiding all views
    this.window.webContents.focus()
  }

  destroyView(view: WCView) {
    try {
      log.log('[main] webcontentsview-destroy: destroying view with id', view.id)

      view.onDestroy()

      if (this.activeViewId === view.id) {
        log.log('[main] webcontentsview-destroy: clearing active view id', view.id)
        this.activeViewId = null
      }

      if (this.activeOverlayViewId === view.id) {
        log.log('[main] webcontentsview-destroy: clearing active overlay view id', view.id)
        this.activeOverlayViewId = null
      }

      this.window.contentView.removeChildView(view.wcv)
      log.log('[main] Removed WebContentsView from window for id:', view.id)

      this.emit('destroy', view)
    } catch (e) {
      log.warn('[main] Could not remove child view', e)
    }

    this.views.delete(view.id)
  }

  destoryAllViews() {
    log.log('[main] webcontentsview-destroy: destroying all views')

    this.views.forEach((view) => {
      this.destroyView(view)
    })

    const remainingViews = this.window.contentView.children
    if (remainingViews.length > 0) {
      log.warn(
        '[main] webcontentsview-destroy: some views were not removed, remaining:',
        remainingViews.length
      )
      remainingViews.forEach((remainingView) => {
        this.window.contentView.removeChildView(remainingView)
      })
    }
  }

  setupMessagePort(view: WCView) {
    log.log('Creating new messagePort channel')
    const { port1, port2 } = new MessageChannelMain()

    log.log('Sending port1 to core renderer')
    this.window.webContents.postMessage('port', { portId: view.id }, [port1])

    log.log('Sending port2 to WebContentsView')
    view.wcv.webContents.postMessage('port', null, [port2])
  }

  refreshViewContentData(view: WCView) {
    const currentTitle = view.wcv.webContents.getTitle() || ''
    if (currentTitle && currentTitle !== view.contentData.title) {
      view.contentData.title = currentTitle

      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.PAGE_TITLE_UPDATED,
        viewId: view.id,
        payload: { title: view.contentData.title, explicitSet: false }
      })
    }
  }

  getViewByWebContentsId(webContentsId: number): WCView | null {
    for (const view of this.views.values()) {
      if (view.wcv.webContents.id === webContentsId) {
        return view
      }
    }
    return null
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

      this.refreshViewContentData(view)
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

      this.refreshViewContentData(view)
    })

    view.attachEventListener('dom-ready', () => {
      IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
        type: WebContentsViewEventType.DOM_READY,
        viewId: view.id,
        payload: undefined
      })

      this.setupMessagePort(view)

      // Inject color scheme into newly created view (only for internal surf:// URLs)
      // This is the ONLY place where we inject color scheme for regular views
      const url = view.wcv.webContents.getURL()
      const isSurfUrl = checkIfSurfProtocolUrl(url) || url.startsWith('surf-internal://')

      if (isSurfUrl) {
        const config = getUserConfig()
        const colorScheme = config.settings?.app_style || 'light'

        view.wcv.webContents
          .executeJavaScript(
            `
          if (document.documentElement) {
            document.documentElement.dataset.colorScheme = '${colorScheme}';
            document.documentElement.style.colorScheme = '${colorScheme}';
          }
        `
          )
          .catch((err) => {
            log.warn('[main] Failed to inject color scheme into view:', view.id, err)
          })
      }
    })

    view.attachEventListener(
      'will-navigate',
      (_, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
        IPC_EVENTS_MAIN.webContentsViewEvent.sendToWebContents(this.window.webContents, {
          type: WebContentsViewEventType.WILL_NAVIGATE,
          viewId: view.id,
          payload: {
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

      this.refreshViewContentData(view)
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

        this.refreshViewContentData(view)
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
      view.contentData.title = title

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
    log.log('[main] webcontentsview-attachIPCEvents: attaching IPC event listeners')
    this.ipcEventListeners = [
      // Listen for theme toggle to update color scheme
      IPC_EVENTS_MAIN.toggleTheme.on((event) => {
        if (!validateIPCSender(event)) return

        const config = getUserConfig()
        const colorScheme = config.settings?.app_style || 'light'
        log.log('[main] Theme toggled, updating color scheme to:', colorScheme)
        this.updateAllViewsColorScheme(colorScheme)
      }),

      // Listen for settings updates to update color scheme
      IPC_EVENTS_MAIN.updateUserConfigSettings.on((event, settings) => {
        if (!validateIPCSender(event)) return

        if (settings.app_style) {
          log.log('[main] Settings updated, updating color scheme to:', settings.app_style)
          this.updateAllViewsColorScheme(settings.app_style)
        }
      }),

      IPC_EVENTS_MAIN.webContentsViewManagerAction.handle(async (event, { type, payload }) => {
        try {
          if (!validateIPCSender(event)) return null

          log.log('[main] webcontentsview-manager-action: IPC event received', type)

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
            log.log('[main] webcontentsview-hideAll: IPC event received, hiding all views')
            this.hideAllViews()
            return true
          } else if (type === WebContentsViewManagerActionType.SHOW_ACTIVE) {
            log.log('[main] webcontentsview-showActive: IPC event received, showing active view')
            this.showActiveView(payload?.id)
            return true
          } else {
            return null
          }
        } catch (error) {
          log.error('[main] webcontentsview-manager-action: error handling IPC event', error)
          return null
        }
      }),

      IPC_EVENTS_MAIN.webContentsViewAction.handle(async (event, { viewId, action }) => {
        try {
          if (!validateIPCSender(event)) return null

          const { type, payload } = action

          log.log('[main] webcontentsview-action: IPC event received', viewId, type, payload)
          const view = this.views.get(viewId)
          if (!view) {
            log.warn('[main] webcontentsview-activate: no view found with id', viewId)
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
          } else if (type === WebContentsViewActionType.CHANGE_PERMANENTLY_ACTIVE) {
            return view.changePermanentlyActive(payload)
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
          } else if (type === WebContentsViewActionType.GET_ZOOM_FACTOR) {
            return await view.getZoomFactor()
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
          log.error('[main] webcontentsview-create: error handling IPC event', error)
          return null
        }
      })
    ]
  }

  removeIPCEvents() {
    log.log(
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
