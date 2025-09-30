import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { applyCSPToSession } from './csp'
import { isDev } from '@deta/utils/system'
import { useLogScope } from '@deta/utils'

const log = useLogScope('SetupWindow')

let setupWindow: BrowserWindow | undefined

export function createSetupWindow(options?: { presetInviteCode?: string; presetEmail?: string }) {
  const setupWindowSession = session.fromPartition('persist:surf-app-session')

  const additionalArgs = [
    `--userDataPath=${app.getPath('userData')}`,
    `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`,
    ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []),
    ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS ? ['--disable-tab-switching-shortcuts'] : [])
  ]

  if (options?.presetInviteCode) {
    additionalArgs.push(`--presetInviteCode=${options.presetInviteCode}`)
  }

  if (options?.presetEmail) {
    additionalArgs.push(`--presetEmail=${options.presetEmail}`)
  }

  log.log('createSetupWindow called: all additional args', additionalArgs, 'options', options)

  setupWindow = new BrowserWindow({
    width: 1270,
    height: 820,
    fullscreenable: false,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    // titleBarStyle: isMac() ? 'hidden' : 'default',
    // ...(isLinux() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/setup.js'),
      additionalArguments: additionalArgs,
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
    setupWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/Setup/setup.html`)
  } else {
    setupWindow.loadFile(join(__dirname, '../renderer/Setup/setup.html'))
  }
}

export function getSetupWindow(): BrowserWindow | undefined {
  return setupWindow
}
