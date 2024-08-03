import { app, BrowserWindow, session, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { attachContextMenu } from './contextMenu'
import { WindowState } from './winState'
import { initAdblocker } from './adblocker'
import { initDownloadManager } from './downloadManager'

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
    frame: false, // TODO: Figure this out for windows but idc
    trafficLightPosition: { x: 12.5, y: 12.5 },
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--appPath=${app.getAppPath()}.unpacked`
      ],
      sandbox: false,
      session: session.fromPartition('persist:horizon-session-v0'),
      webviewTag: true,
      defaultFontSize: 14
    }
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

  mainWindow.webContents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      mainWindow?.webContents.send('new-window-request', {
        ...details,
        webContentsId: contents.id
      })

      return { action: details.disposition === 'new-window' ? 'allow' : 'deny' }
    })

    attachContextMenu(contents)
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    getMainWindow()?.webContents.send('new-window-request', { url: event.url })
    event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    getMainWindow()?.webContents.send('new-window-request', details)
    return { action: 'deny' }
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
