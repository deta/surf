import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { applyCSPToSession } from './csp'
import { isMac } from '@deta/utils/system'
import { SettingsWindowTab } from '@deta/types/src/window.types'
import { SettingsWindowEntrypoint } from './utils'

let settingsWindow: BrowserWindow | undefined

export function createSettingsWindow(tab?: SettingsWindowTab) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    return
  }

  const settingsWindowSession = session.fromPartition('persist:surf-app-session')

  settingsWindow = new BrowserWindow({
    width: 1000,
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
      preload: join(__dirname, '../preload/core.js'),
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`,
        `--settings-window-entry-point=${SettingsWindowEntrypoint}`
      ],
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
    const ALLOWED_DOMAINS = [
      'https://deta.surf',
      'https://deta.notion.site',
      'https://github.com',
      'https://ollama.com',
      'https://openrouter.ai',
      'https://platform.openai.com',
      'https://console.anthropic.com',
      'https://aistudio.google.com'
    ]

    let isAllowedUrl = ALLOWED_DOMAINS.some((domain) => details.url.startsWith(domain))
    if (isAllowedUrl) {
      shell.openExternal(details.url)
    }

    return { action: 'deny' }
  })

  const tabParam = tab ? `?tab=${tab}` : ''

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/Settings/settings.html${tabParam}`
    )
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer', 'Settings', 'settings.html') + tabParam)
  }
}

export function getSettingsWindow(): BrowserWindow | undefined {
  return settingsWindow
}
