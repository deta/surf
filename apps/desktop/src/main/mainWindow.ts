import { app, BrowserWindow, session, screen } from 'electron'
import path, { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { attachContextMenu } from './contextMenu'
import { WindowState } from './winState'
import { initAdblocker } from './adblocker'
import { initDownloadManager } from './downloadManager'
import { isMac } from '@horizon/utils'
import { IPC_EVENTS_MAIN } from '@horizon/core/src/lib/service/ipc/events'
import { setupPermissionHandlers } from './permissionHandler'
import { applyCSPToSession } from './csp'
import { firefoxUA, normalizeElectronUserAgent } from './utils'

const isDev = import.meta.env.DEV

let mainWindow: BrowserWindow | undefined

export function createWindow() {
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
    x: boundWindow.x,
    y: boundWindow.y,
    fullscreen: winState.state.isFullScreen,
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    frame: isMac() ? false : true,
    titleBarStyle: 'hidden',
    // ...(isLinux() ? { icon } : {}),
    trafficLightPosition: { x: 12.5, y: 12.5 },
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
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
      defaultFontSize: 14
    }
  })

  const webviewSession = session.fromPartition('persist:horizon')
  const webviewSessionUserAgent = normalizeElectronUserAgent(webviewSession.getUserAgent())

  webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders, url } = details
    const isGoogleAccounts = new URL(url).hostname === 'accounts.google.com'
    requestHeaders['User-Agent'] = isGoogleAccounts ? firefoxUA : webviewSessionUserAgent

    const chromiumVersion = process.versions.chrome.split('.')[0]
    requestHeaders['Sec-CH-UA'] = `"Chromium";v="${chromiumVersion}", " Not A;Brand";v="99"`
    requestHeaders['Sec-CH-UA-Mobile'] = '?0'

    callback({ requestHeaders })
  })

  applyCSPToSession(mainWindowSession)
  // TODO: expose these to the renderer over IPC so
  // that the user can alter the current cached state
  //@ts-ignore
  const { clearSessionPermissions, clearAllPermissions, removePermission } =
    setupPermissionHandlers(webviewSession)

  // TODO: proper session management?
  initAdblocker('persist:horizon')
  initDownloadManager('persist:horizon')

  winState.manage(mainWindow)

  mainWindow.on('ready-to-show', () => {
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

  setupWindowWebContentsHandlers(mainWindow.webContents)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow
}

function setupWindowWebContentsHandlers(contents: Electron.WebContents) {
  // Prevent direct navigation in the main window by handling the `will-navigate`
  // event and the `setWindowOpenHandler`. The main window should only host the SPA
  // Surf frontend and not navigate away from it. Any requested navigations should
  // be handled within the frontend.
  contents.on('will-navigate', (event) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        url: event.url
        // we are explicitly not sending the webContentsId here
      })
    }

    event.preventDefault()
  })

  contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        url: details.url,
        disposition: details.disposition
        // we are explicitly not sending the webContentsId here
      })
    }

    return { action: 'deny' }
  })

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    webPreferences.webSecurity = true
    webPreferences.sandbox = false
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = path.resolve(__dirname, '../preload/webview.js')
  })

  // Handle navigation requests within webviews:
  // 1. Set up a window open handler for each webview when it's attached.
  // 2. Send navigation requests to the main window renderer (Surf preload) for handling.
  // 3. Allow opening new windows but deny other requests, and handle them within the renderer.
  contents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      const mainWindow = getMainWindow()
      if (mainWindow) {
        IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
          url: details.url,
          disposition: details.disposition,
          webContentsId: contents.id
        })
      }

      // IMPORTANT NOTE: DO NOT expose any sort of Node.js capabilities to the newly
      // created window here. The creation of it is controlled from the renderer. Because
      // of this, Surf won't play well with websites that for some reason utilizes more
      // than one window. In the future, Each new window we create should receive its own
      // instance of Surf.
      if (details.disposition === 'new-window') {
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
      } else {
        return { action: 'deny' }
      }
    })

    attachContextMenu(contents)
  })
}
