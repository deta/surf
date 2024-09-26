import { app, BrowserWindow, session, shell } from 'electron'
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
      defaultFontSize: 14,
      session: setupWindowSession,
      webviewTag: false,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
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
    // Prevent all navigation attempts
    event.preventDefault()
  })

  setupWindow.webContents.setWindowOpenHandler((details) => {
    const ALLOWED_DOMAINS = ['https://deta.surf', 'https://deta.notion.site']

    let isAllowedUrl = ALLOWED_DOMAINS.some((domain) => details.url.startsWith(domain))
    if (isAllowedUrl) {
      shell.openExternal(details.url)
    }

    return { action: 'deny' }
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
