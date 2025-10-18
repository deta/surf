import { app, BrowserWindow, session, screen } from 'electron'
import path, { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { attachContextMenu } from './contextMenu'
import { WindowState } from './winState'
import { initAdblocker } from './adblocker'
import { initDownloadManager } from './downloadManager'
import { isDev, isMac } from '@deta/utils/system'
import { PDFViewerParams, parseURL } from '@deta/utils/formatting'

import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import { setupPermissionHandlers } from './permissionHandler'
import { applyCSPToSession } from './csp'
import {
  isAppSetup,
  normalizeElectronUserAgent,
  PDFViewerEntryPoint,
  SettingsWindowEntrypoint
} from './utils'

import { getWebRequestManager } from './webRequestManager'
// import electronDragClick from 'electron-drag-click'
import { writeFile } from 'fs/promises'
import {
  checkSurfProtocolRequest,
  surfInternalProtocolHandler,
  surfProtocolHandler,
  surfletProtocolHandler
} from './surfProtocolHandlers'
import { attachWCViewManager, WCViewManager } from './viewManager'
import { useLogScope } from '@deta/utils'

const log = useLogScope('MainWindow')

let mainWindow: BrowserWindow | undefined
let viewManager: WCViewManager | undefined

// electronDragClick()

export function createWindow() {
  if (!isAppSetup) {
    log.warn('App is not setup, not allowed to create main window')
    return
  }

  const winState = new WindowState(
    {
      saveImmediately: is.dev
    },
    {
      isMaximized: true
    }
  )

  const currentDisplay =
    winState.state.x && winState.state.y
      ? screen.getDisplayMatching({
          x: winState.state.x,
          y: winState.state.y,
          width: winState.state.width,
          height: winState.state.height
        })
      : screen.getPrimaryDisplay()
  const screenBounds = currentDisplay.bounds

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max)
  }

  const windowBounds = {
    x: winState.state.x ?? 0,
    y: winState.state.y ?? 0,
    width: winState.state.width ?? screenBounds.width,
    height: winState.state.height ?? screenBounds.height
  }

  const boundWindow = {
    x: clamp(
      windowBounds.x,
      screenBounds.x,
      screenBounds.x + screenBounds.width - windowBounds.width
    ),
    y: clamp(
      windowBounds.y,
      screenBounds.y,
      screenBounds.y + screenBounds.height - windowBounds.height
    ),
    width: Math.min(windowBounds.width, screenBounds.width),
    height: Math.min(windowBounds.height, screenBounds.height)
  }

  const mainWindowSession = session.fromPartition('persist:surf-app-session')
  mainWindow = new BrowserWindow({
    width: boundWindow.width,
    height: boundWindow.height,
    minWidth: 542,
    minHeight: 330,
    x: boundWindow.x,
    y: boundWindow.y,
    fullscreen: winState.state.isFullScreen,
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    frame: isMac() ? false : true,
    titleBarStyle: 'hidden',
    // ...(isLinux() ? { icon } : {}),
    trafficLightPosition: { x: 15, y: 13.5 },
    webPreferences: {
      preload: join(__dirname, '../preload/core.js'),
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
        `--pdf-viewer-entry-point=${PDFViewerEntryPoint}`,
        `--settings-window-entry-point=${SettingsWindowEntrypoint}`,
        ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []),
        ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS
          ? ['--disable-tab-switching-shortcuts']
          : [])
      ],
      webviewTag: true,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      session: mainWindowSession,
      defaultFontSize: 14,
      spellcheck: isMac(),
      enableBlinkFeatures: 'CSSLayoutAPI'
    }
  })

  const webviewSession = session.fromPartition('persist:horizon')
  const webviewSessionUserAgent = normalizeElectronUserAgent(webviewSession.getUserAgent(), false)
  const webviewSessionUserAgentGoogle = normalizeElectronUserAgent(
    webviewSession.getUserAgent(),
    true
  )
  const webRequestManager = getWebRequestManager()

  const requestHeaderMap = (() => {
    const MAP_MAX_SIZE = 50
    const map: Map<number, { url: string; headers: Record<string, string> }> = new Map()

    return {
      map,
      set: (id: number, url: string, headers: Record<string, string>) => {
        if (map.size >= MAP_MAX_SIZE) {
          map.delete(map.keys().next().value as number)
        }
        map.set(id, { url, headers })
      },
      pop: (id: number) => {
        const headers = map.get(id)
        map.delete(id)
        return headers
      }
    }
  })()

  webRequestManager.addBeforeRequest(webviewSession, (details, callback) => {
    const isSurfProtocol = details.url.startsWith('surf:')
    const isSurfletProtocol = details.url.startsWith('surflet:')
    const isInternalPageRequest = details.url.startsWith('surf-internal:')

    const isMainFrameRequest = details.resourceType === 'mainFrame'
    const urlString = details.webContents && details.webContents.getURL()
    const url = urlString ? new URL(urlString) : null

    // const isPDFViewerRequest = url && isInternalViewerURL(url, PDFViewerEntryPoint)
    // const isNotebookViewerRequest = url && isInternalViewerURL(url, NotebookViewerEntryPoint)
    // const isResourceViewerRequest = url && isInternalViewerURL(url, ResourceViewerEntryPoint)

    const shouldBlockSurfRequest =
      isSurfProtocol && !(checkSurfProtocolRequest(details.url) || isMainFrameRequest)

    const shouldBlockSurfletRequest =
      isSurfletProtocol && (!isMainFrameRequest || !details.webContents)

    const shouldBlockInternalRequest =
      isInternalPageRequest && (!isMainFrameRequest || !details.webContents)

    const shouldBlock =
      shouldBlockSurfRequest || shouldBlockSurfletRequest || shouldBlockInternalRequest

    if (shouldBlock) {
      // log.warn('Blocking request:', details.url, url, {
      //   shouldBlockSurfRequest,
      //   shouldBlockSurfletRequest,
      //   shouldBlockInternalRequest
      // })

      log.warn('Blocked request:', details.url, url, details.frame, details.webContents?.id)
    }

    callback({ cancel: shouldBlock })
  })

  webRequestManager.addBeforeSendHeaders(webviewSession, (details, callback) => {
    const { requestHeaders, url, id } = details
    const parsedURL = new URL(url)
    const isTwitch = parsedURL.hostname === 'twitch.tv' || parsedURL.hostname.endsWith('.twitch.tv')
    const isGoogleAccounts = parsedURL.hostname === 'accounts.google.com'

    if (!isTwitch) {
      requestHeaders['User-Agent'] = isGoogleAccounts
        ? webviewSessionUserAgentGoogle
        : webviewSessionUserAgent
    }

    requestHeaderMap.set(id, url, { ...requestHeaders })
    callback({ requestHeaders })
  })

  webRequestManager.addHeadersReceived(webviewSession, (details, callback) => {
    if (details.resourceType !== 'mainFrame') {
      callback({ cancel: false })
      return
    }

    const getHeaderValue = (headerName: string): string[] | undefined => {
      if (!details.responseHeaders) return
      const key = Object.keys(details.responseHeaders || {}).find(
        (k) => k.toLowerCase() === headerName.toLowerCase()
      )
      return key ? details.responseHeaders[key] : undefined
    }

    const getFilename = (header: string | undefined): string | undefined => {
      if (!header) return
      const filenameMatch = header.match(/filename\*?=['"]?(?:UTF-\d['"])?([^"';]+)['"]?/i)
      return filenameMatch ? decodeURIComponent(filenameMatch[1]) : undefined
    }

    const loadPDFViewer = (params: Partial<PDFViewerParams>) => {
      const searchParams = new URLSearchParams()
      searchParams.set('path', params.path!)
      if (params.pathOverride) searchParams.set('pathOverride', params.pathOverride)
      if (params.loading) searchParams.set('loading', 'true')
      if (params.error) searchParams.set('error', params.error)
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.filename) searchParams.set('filename', params.filename)

      if (!details.webContentsId) {
        log.error('No webContentsId for PDF viewer load request')
        return
      }

      const url = `${PDFViewerEntryPoint}?${searchParams}`
      const view = viewManager?.getViewByWebContentsId(details.webContentsId)
      if (view) {
        view.loadURL(url)
      } else {
        details.webContents?.loadURL(url)
      }
    }

    const contentTypeHeader = getHeaderValue('content-type')
    const dispositionHeader = getHeaderValue('content-disposition')
    const isPDF = contentTypeHeader?.[0]?.includes('application/pdf') ?? false
    const isAttachment = dispositionHeader?.[0]?.toLowerCase().includes('attachment') ?? false
    const filename = getFilename(dispositionHeader?.[0])

    const requestData = requestHeaderMap.pop(details.id)
    const url = parseURL(requestData?.url ?? details.url)

    if (!url) {
      callback({ cancel: false })
      return
    }

    if (url.protocol === 'surf:') {
      if (isPDF) {
        callback({ cancel: true })
        loadPDFViewer({ path: details.url, filename })
      } else {
        if (url.hostname === 'resource') {
          callback({ cancel: true })
          details.webContents?.loadURL(`surf://surf/resource/${url.pathname.slice(1)}`)
        } else if (url.hostname === 'notebook') {
          callback({ cancel: true })
          details.webContents?.loadURL(`surf://surf/notebook/${url.pathname.slice(1)}`)
        } else {
          callback({ cancel: false })
        }
      }

      return
    }

    if (isPDF && !isAttachment) {
      callback({ cancel: true })

      const requestData = requestHeaderMap.pop(details.id)
      const tmpFile = join(app.getPath('temp'), crypto.randomUUID())
      const url = requestData?.url ?? details.url

      loadPDFViewer({ path: details.url, loading: true, filename })

      fetch(url, {
        headers: requestData?.headers,
        credentials: 'include'
      })
        .then(async (resp) => {
          const buffer = await resp.arrayBuffer()
          await writeFile(tmpFile, Buffer.from(buffer))
          loadPDFViewer({
            path: details.url,
            pathOverride: `file://${tmpFile}`,
            filename
          })
        })
        .catch((err) => {
          loadPDFViewer({
            path: details.url,
            error: String(err),
            filename
          })
        })
      return
    }

    callback({ cancel: false })
  })

  try {
    webviewSession.protocol.handle('surf', surfProtocolHandler)
    webviewSession.protocol.handle('surflet', surfletProtocolHandler)
    mainWindowSession.protocol.handle('surf', surfProtocolHandler)
    mainWindowSession.protocol.handle('surf-internal', surfInternalProtocolHandler)
  } catch (e) {
    log.error('possibly failed to register surf protocol: ', e)
  }

  applyCSPToSession(mainWindowSession)

  //
  // TODO: expose these to the renderer over IPC so
  // that the user can alter the current cached state
  //@ts-ignore
  const { clearSessionPermissions, clearAllPermissions, removePermission } =
    setupPermissionHandlers(webviewSession)

  // TODO: proper session management?
  initAdblocker('persist:horizon')
  initDownloadManager('persist:horizon')

  winState.manage(mainWindow)

  // Hack to make sure the window gets properly focused
  mainWindow.on('show', () => {
    setTimeout(() => {
      mainWindow?.focus()
    }, 200)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.webContents.setZoomLevel(0)
    mainWindow?.webContents.setZoomFactor(1.0)
    mainWindow?.webContents.setVisualZoomLevelLimits(1, 1)

    if (winState.state.isMaximized) {
      mainWindow?.maximize()
    } else if (!is.dev) {
      mainWindow?.showInactive()
    } else {
      mainWindow?.show()
    }
  })

  // mainWindow.on('enter-full-screen', () => {
  //   getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: true })
  // })

  // mainWindow.on('leave-full-screen', () => {
  //   getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: false })
  // })

  viewManager = attachWCViewManager(mainWindow)
  viewManager.on('create', (view) => {
    setupWebContentsViewWebContentsHandlers(view.wcv.webContents)
  })

  setupMainWindowWebContentsHandlers(mainWindow.webContents, viewManager)

  // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  //   mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/Core/core.html`)
  // } else {
  //   mainWindow.loadFile(join(__dirname, '../renderer/Core/core.html'))
  // }

  mainWindow.loadURL('surf-internal://Core/Core/core.html')
}

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow
}

export function getWebContentsViews() {
  return viewManager?.getWebContentsViews() ?? []
}

function setupMainWindowWebContentsHandlers(
  contents: Electron.WebContents,
  viewManager: WCViewManager
) {
  // Prevent direct navigation in the main window by handling the `will-navigate`
  // event and the `setWindowOpenHandler`. The main window should only host the SPA
  // Surf frontend and not navigate away from it. Any requested navigations should
  // be handled within the frontend.
  contents.on('will-navigate', (event) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        url: event.url,
        disposition: 'foreground-tab'
        // we are explicitly not sending the webContentsId here
      })
    }

    event.preventDefault()
  })

  contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    const mainWindow = getMainWindow()

    if (!mainWindow) {
      return { action: 'deny' }
    }

    return {
      action: 'allow',
      outlivesOpener: true,
      createWindow: ({ webPreferences, ...constructorOptions }) => {
        log.log('Window open handler called with details:', details, constructorOptions)

        const componentId = details.features?.match(/componentId=([^;]+)/)?.[1]

        // IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        //   url: details.url,
        //   disposition: details.disposition
        //   // we are explicitly not sending the webContentsId here
        // })

        const view = viewManager.createOverlayView(
          {
            id: componentId,
            overlayId: componentId
          },
          { ...constructorOptions, webPreferences }
        )

        return view.wcv.webContents
      }
    }
  })

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    webPreferences.webSecurity = !isDev
    webPreferences.sandbox = true
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = path.resolve(__dirname, '../preload/webcontents.js')
    webPreferences.spellcheck = isMac()
    webPreferences.additionalArguments = [`--pdf-viewer-entry-point=${PDFViewerEntryPoint}`]
  })

  // Handle navigation requests within webviews:
  // 1. Set up a window open handler for each webview when it's attached.
  // 2. Send navigation requests to the main window renderer (Surf preload) for handling.
  // 3. Allow opening new windows but deny other requests, and handle them within the renderer.
  contents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      // If there is a frame name or features provided we assume the request
      // is part of a auth flow and we create a new isolated window for it
      const shouldCreateWindow =
        details.disposition === 'new-window' &&
        (details.frameName !== '' || details.features !== '')

      if (shouldCreateWindow) {
        // IMPORTANT NOTE: DO NOT expose any sort of Node.js capabilities to the newly
        // created window here. The creation of it is controlled from the renderer. Because
        // of this, Surf won't play well with websites that for some reason utilizes more
        // than one window. In the future, Each new window we create should receive its own
        // instance of Surf.
        return {
          action: 'allow',
          createWindow: undefined,
          outlivesOpener: false,
          overrideBrowserWindowOptions: {
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true
            }
          }
        }
      }

      const url = new URL(details.url)
      if (
        url.protocol === 'surf:' ||
        url.protocol === 'surflet:' ||
        url.protocol === 'surf-internal:'
      ) {
        return { action: 'deny' }
      }

      const mainWindow = getMainWindow()
      if (mainWindow) {
        IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
          url: details.url,
          disposition: details.disposition,
          webContentsId: contents.id
        })
      }

      return { action: 'deny' }
    })

    attachContextMenu(contents)
  })
}

function setupWebContentsViewWebContentsHandlers(contents: Electron.WebContents) {
  contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    try {
      log.log('WebContentsView Window open handler called with details:', details)
      // If there is a frame name or features provided we assume the request
      // is part of a auth flow and we create a new isolated window for it
      const shouldCreateWindow =
        details.disposition === 'new-window' &&
        (details.frameName !== '' || details.features !== '')

      if (shouldCreateWindow) {
        // IMPORTANT NOTE: DO NOT expose any sort of Node.js capabilities to the newly
        // created window here. The creation of it is controlled from the renderer. Because
        // of this, Surf won't play well with websites that for some reason utilizes more
        // than one window. In the future, Each new window we create should receive its own
        // instance of Surf.
        return {
          action: 'allow',
          createWindow: undefined,
          outlivesOpener: false,
          overrideBrowserWindowOptions: {
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true
            }
          }
        }
      }

      const url = new URL(details.url)
      if (
        url.protocol === 'surf:' ||
        url.protocol === 'surflet:' ||
        url.protocol === 'surf-internal:'
      ) {
        log.warn('[main] Denied new window request:', details)
        return { action: 'deny' }
      }

      const mainWindow = getMainWindow()
      if (mainWindow) {
        log.log(
          '[main] Sending new window request to main window:',
          contents.id,
          details.url,
          details.disposition
        )
        IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
          url: details.url,
          disposition: details.disposition,
          webContentsId: contents.id
        })
      } else {
        log.warn('[main] No main window, cannot send new window request:', details)
      }

      return { action: 'deny' }
    } catch (error) {
      log.error('Error in setWindowOpenHandler:', error)
      return { action: 'deny' }
    }
  })

  attachContextMenu(contents)

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    webPreferences.webSecurity = !isDev
    webPreferences.sandbox = true
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = path.resolve(__dirname, '../preload/webcontents.js')
    webPreferences.spellcheck = isMac()
    webPreferences.additionalArguments = [`--pdf-viewer-entry-point=${PDFViewerEntryPoint}`]
  })
}
