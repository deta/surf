import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { applyCSPToSession } from './csp'

let settingsWindow: BrowserWindow | undefined

export function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    return
  }

  const settingsWindowSession = session.fromPartition('persist:surf-app-session')

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 800,
    fullscreenable: false,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Settings',
    frame: process.platform !== 'darwin',
    trafficLightPosition: { x: 18, y: 18 },
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [`--userDataPath=${app.getPath('userData')}`],
      sandbox: false,
      session: settingsWindowSession,
      webviewTag: true,
      defaultFontSize: 14
    }
  })

  applyCSPToSession(settingsWindowSession)

  settingsWindow.on('ready-to-show', () => {
    if (!is.dev) {
      settingsWindow?.showInactive()
    } else {
      settingsWindow?.show()
    }
  })

  settingsWindow.webContents.on('will-navigate', (event) => {
    // TODO: should we handle new windows here?
    event.preventDefault()
  })

  settingsWindow.webContents.setWindowOpenHandler((_details: Electron.HandlerDetails) => {
    // TODO: is this needed?
    return { action: 'allow' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings.html'))
  }
}

export function getSettingsWindow(): BrowserWindow | undefined {
  return settingsWindow
}
