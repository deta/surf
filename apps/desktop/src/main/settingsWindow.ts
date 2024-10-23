import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { applyCSPToSession } from './csp'
import { isMac } from '@horizon/utils'

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
    frame: !isMac(),
    trafficLightPosition: { x: 24, y: 24 },
    titleBarStyle: isMac() ? 'hidden' : 'default',
    // ...(isLinux() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/horizon.js'),
      additionalArguments: [`--userDataPath=${app.getPath('userData')}`],
      defaultFontSize: 14,
      session: settingsWindowSession,
      webviewTag: false,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
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

  settingsWindow.webContents.setWindowOpenHandler((details) => {
    const ALLOWED_DOMAINS = ['https://deta.surf', 'https://deta.notion.site']

    let isAllowedUrl = ALLOWED_DOMAINS.some((domain) => details.url.startsWith(domain))
    if (isAllowedUrl) {
      shell.openExternal(details.url)
    }

    return { action: 'deny' }
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
