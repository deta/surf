import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { applyCSPToSession } from './csp'

let setupWindow: BrowserWindow | undefined

export function createSetupWindow() {
  const setupWindowSession = session.fromPartition('persist:surf-app-session')

  setupWindow = new BrowserWindow({
    width: 600,
    height: 800,
    fullscreenable: false,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    // titleBarStyle: isMac() ? 'hidden' : 'default',
    // ...(isLinux() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [`--userDataPath=${app.getPath('userData')}`],
      sandbox: false,
      session: setupWindowSession,
      webviewTag: true,
      defaultFontSize: 14
    }
  })

  applyCSPToSession(setupWindowSession)

  setupWindow.on('ready-to-show', () => {
    if (!is.dev) {
      setupWindow?.showInactive()
    } else {
      setupWindow?.show()
    }
  })

  setupWindow.webContents.on('will-navigate', (event) => {
    // TODO: should we handle new windows here?
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
