import { BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | undefined

export function createWindow(): void {
  mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      sandbox: false,
      session: session.fromPartition('persist:horizon-session-v0'),
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!is.dev) mainWindow?.showInactive()
    else mainWindow?.show()
  })

  mainWindow.webContents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      mainWindow?.webContents.send('new-window-request', {
        ...details,
        webContentsId: contents.id
      })

      return { action: details.disposition === 'new-window' ? 'allow' : 'deny' }
    })
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
