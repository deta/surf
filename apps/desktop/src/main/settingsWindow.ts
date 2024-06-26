import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let settingsWindow: BrowserWindow | undefined

export function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 800,
    fullscreenable: false,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Settings',
    frame: false, // TODO: Figure this out for windows but idc
    trafficLightPosition: { x: 18, y: 18 },
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [`--userDataPath=${app.getPath('userData')}`],
      sandbox: false,
      session: session.fromPartition('persist:horizon-session-v0'),
      webviewTag: true,
      defaultFontSize: 14
    }
  })

  settingsWindow.on('ready-to-show', () => {
    if (!is.dev) {
      settingsWindow?.showInactive()
    } else {
      settingsWindow?.show()
    }
  })

  settingsWindow.webContents.on('will-navigate', (event) => {
    // getMainWindow()?.webContents.send('new-window-request', { url: event.url })
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
