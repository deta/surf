import { app, BrowserWindow, session, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { attachContextMenu } from './contextMenu'
import { WindowState } from './winState'
import { initAdblocker } from './adblocker'
import { initDownloadManager } from './downloadManager'
import { normalizeElectronUserAgent } from '@horizon/utils'
import { getGoogleSignInWindowId } from './googleSignInWindow'

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

  mainWindow = new BrowserWindow({
    width: boundWindow.width,
    height: boundWindow.height,
    x: boundWindow.x,
    y: boundWindow.y,
    fullscreen: winState.state.isFullScreen,
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    frame: process.platform === 'darwin' ? false : true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // ...(process.platform === 'linux' ? { icon } : {}),
    trafficLightPosition: { x: 12.5, y: 12.5 },
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
        `--tabSwitchingShortcutsDisable=${process.env.TAB_SWITCHING_SHORTCUTS_DISABLE}`
      ],
      webviewTag: true,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      session: session.fromPartition('persist:surf-app-session'),
      defaultFontSize: 14
    }
  })

  const webviewSession = session.fromPartition('persist:horizon')
  const webviewSessionUserAgent = normalizeElectronUserAgent(webviewSession.getUserAgent())
  webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'User-Agent':
          getGoogleSignInWindowId() === details.webContentsId
            ? details.requestHeaders['User-Agent']
            : webviewSessionUserAgent
      }
    })
  })

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

  mainWindow.on('enter-full-screen', () => {
    getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: true })
  })

  mainWindow.on('leave-full-screen', () => {
    getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: false })
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (_event, webPreferences, _params) => {
      webPreferences.webSecurity = true
      webPreferences.sandbox = true
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
    })
  })

  // Prevent direct navigation in the main window by handling the `will-navigate`
  // event and the `setWindowOpenHandler`. The main window should only host the SPA
  // Surf frontend and not navigate away from it. Any requested navigations should
  // be handled within the frontend.
  mainWindow.webContents.on('will-navigate', (event) => {
    getMainWindow()?.webContents.send('new-window-request', { url: event.url })
    event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    getMainWindow()?.webContents.send('new-window-request', details)
    return { action: 'deny' }
  })

  // Handle navigation requests within webviews:
  // 1. Set up a window open handler for each webview when it's attached.
  // 2. Send navigation requests to the main window renderer (Surf preload) for handling.
  // 3. Allow opening new windows but deny other requests, and handle them within the renderer.
  mainWindow.webContents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      mainWindow?.webContents.send('new-window-request', {
        ...details,
        webContentsId: contents.id
      })

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow
}
