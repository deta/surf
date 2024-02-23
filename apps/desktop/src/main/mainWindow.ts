import { BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import { attachContextMenu } from './contextMenu'
import { WindowState } from './winState'

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

  mainWindow = new BrowserWindow({
    width: winState.state.width,
    height: winState.state.height,
    x: winState.state.x,
    y: winState.state.y,
    fullscreen: winState.state.isFullScreen,
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      sandbox: false,
      session: session.fromPartition('persist:horizon-session-v0'),
      webviewTag: true
    }
  })

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

  mainWindow.webContents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    shell.openExternal(details.url)
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
