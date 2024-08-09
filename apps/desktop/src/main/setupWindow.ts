import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let setupWindow: BrowserWindow | undefined

export function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 600,
    height: 800,
    fullscreenable: false,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    frame: false, // TODO: Figure this out for windows but idc
    // titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [`--userDataPath=${app.getPath('userData')}`],
      sandbox: false,
      session: session.fromPartition('persist:surf-app-session'),
      webviewTag: true,
      defaultFontSize: 14
    }
  })

  setupWindow.on('ready-to-show', () => {
    if (!is.dev) {
      setupWindow?.showInactive()
    } else {
      setupWindow?.show()
    }
  })

  setupWindow.webContents.on('will-navigate', (event) => {
    // getMainWindow()?.webContents.send('new-window-request', { url: event.url })
    event.preventDefault()
  })

  setupWindow.webContents.setWindowOpenHandler((_details: Electron.HandlerDetails) => {
    // TODO: is this needed?
    return { action: 'allow' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    setupWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/setup.html`)
  } else {
    setupWindow.loadFile(join(__dirname, '../renderer/setup.html'))
  }
}

export function getSetupWindow(): BrowserWindow | undefined {
  return setupWindow
}
