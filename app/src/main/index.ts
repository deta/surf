import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { readdir, unlink, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'
import { isDev, isMac, isWindows } from '@deta/utils/system'
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'

import { createWindow, getMainWindow } from './mainWindow'
import { setAppMenu } from './appMenu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker } from './adblocker'
import { ipcSenders, setupIpc } from './ipcHandlers'
import { getUserConfig, updateUserConfig } from './config'
import { isAppSetup, isDefaultBrowser, markAppAsSetup } from './utils'
import { SurfBackendServerManager } from './surfBackend'
import { CrashHandler } from './crashHandler'
import { surfProtocolExternalURLHandler } from './surfProtocolHandlers'
import { useLogScope } from '@deta/utils'
import { initializeSFFSMain } from './sffs'

const log = useLogScope('Main')

const CONFIG = {
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Surf',
  appVersion: import.meta.env.M_VITE_APP_VERSION,
  useTmpDataDir: import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true',
  disableAutoUpdate: import.meta.env.M_VITE_DISABLE_AUTO_UPDATE === 'true',
  embeddingModelMode: import.meta.env.M_VITE_EMBEDDING_MODEL_MODE || 'default',
  forceSetupWindow: import.meta.env.M_VITE_CREATE_SETUP_WINDOW === 'true',
  sentryDSN: import.meta.env.M_VITE_SENTRY_DSN,
  appUpdatesProxyUrl: import.meta.env.M_VITE_APP_UPDATES_PROXY_URL,
  appUpdatesChannel: import.meta.env.M_VITE_APP_UPDATES_CHANNEL,
  announcementsUrl: import.meta.env.M_VITE_ANNOUNCEMENTS_URL
}

let isAppLaunched = false
let appOpenedWithURL: string | null = null
let surfBackendManager: SurfBackendServerManager | null = null

async function cleanupTempFiles() {
  try {
    const files = await readdir(join(app.getPath('temp'), CONFIG.appName))
    const now = Date.now()
    await Promise.all(
      files.map((file) =>
        stat(join(app.getPath('temp'), CONFIG.appName, file))
          .then((stats) => {
            if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
              return unlink(join(app.getPath('temp'), CONFIG.appName, file))
            }
            return Promise.resolve()
          })
          .catch(() => {})
      )
    )
  } catch {}
}

const initializePaths = () => {
  const userDataPath = CONFIG.useTmpDataDir
    ? join(app.getPath('temp'), CONFIG.appVersion || '', CONFIG.appName)
    : join(dirname(app.getPath('userData')), CONFIG.appName)
  mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
  return userDataPath
}

const registerProtocols = () => {
  app.setAsDefaultProtocolClient('surf')
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'surf',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        secure: true,
        corsEnabled: true,
        stream: true
      }
    },
    {
      scheme: 'surf-internal',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        secure: true,
        corsEnabled: true,
        bypassCSP: true,
        stream: true
      }
    },
    {
      scheme: 'surflet',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        secure: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

const handleOpenUrl = (url: string) => {
  try {
    if (!isAppSetup) {
      log.warn('App not setup yet, cannot handle open URL')
      return
    }

    const mainWindow = getMainWindow()

    if (!mainWindow || mainWindow?.isDestroyed()) {
      log.warn('No main window found')
      if (BrowserWindow.getAllWindows().length === 0) {
        IPC_EVENTS_MAIN.appReady.once(() => handleOpenUrl(url))
        createWindow()
      } else {
        log.error('There are windows, but no main window')
      }
      return
    }

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()

    IPC_EVENTS_MAIN.openURL.sendToWebContents(mainWindow.webContents, { url, active: true })
  } catch (error) {
    log.error('Error handling open URL:', error)
  }
}

const setupBackendServer = async (appPath: string, backendRootPath: string, userConfig: any) => {
  const backendServerPath = join(
    appPath,
    'resources',
    'bin',
    // dev: surf-backend-dev, prod: surf-backend
    // dev-windows: surf-backend-dev.exe, prod-windows: surf-backend.exe
    `surf-backend${isDev ? '-dev' : ''}${isWindows() ? '.exe' : ''}`
  )

  surfBackendManager = new SurfBackendServerManager(backendServerPath, [
    backendRootPath,
    'false',
    isDev ? CONFIG.embeddingModelMode : userConfig.settings?.embedding_model
  ])

  surfBackendManager
    .on('stdout', (data) => log.info('[backend:stdout] ', data))
    .on('stderr', (data) => log.error('[backend:stderr]', data))
    .on('error', (error) => log.error('[backend:error ]', error))
    .on('warn', (msg) => log.warn('[backend:warn  ]', msg))
    .on('info', (msg) => log.info('[backend:info  ]', msg))
    .on('exit', (code) => log.info('[backend:exit  ] code:', code))
    .on('signal', (signal) => log.info('[backend:signal] signal:', signal))

  surfBackendManager
    ?.on('ready', () => {
      const webContents = getMainWindow()?.webContents
      if (webContents) IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, true)
    })
    .on('close', () => {
      const webContents = getMainWindow()?.webContents
      if (webContents) IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, false)
    })

  IPC_EVENTS_MAIN.appReady.on(() => {
    if (surfBackendManager) {
      const webContents = getMainWindow()?.webContents
      if (webContents)
        IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(
          webContents,
          surfBackendManager.isHealthy
        )
    }
  })

  surfBackendManager.start()
  await surfBackendManager.waitForStart()

  initializeSFFSMain()
}

const initializeApp = async () => {
  log.log('initilizing app', is.dev ? 'in development mode' : 'in production mode')

  isAppLaunched = true
  setInterval(cleanupTempFiles, 60 * 60 * 1000)
  electronApp.setAppUserModelId('ea.browser.deta.surf')

  const appPath = app.getAppPath() + (isDev ? '' : '.unpacked')
  const userDataPath = app.getPath('userData')
  const backendRootPath = join(userDataPath, 'sffs_backend')
  const userConfig = getUserConfig()

  setupIpc(backendRootPath)

  if (isDev) {
    log.log('Running in development mode, setting app icon to dev icon')
    app.dock?.setIcon(join(app.getAppPath(), 'build/resources/dev/icon.png'))
  }

  markAppAsSetup()
  await setupAdblocker()
  setAppMenu()

  createWindow()

  try {
    await setupBackendServer(appPath, backendRootPath, userConfig)
  } catch (err) {
    log.error(`failed to start the surf backend process: ${err}`)
  }

  IPC_EVENTS_MAIN.appReady.once(async () => {
    const appIsDefaultBrowser = await isDefaultBrowser()
    if (userConfig.defaultBrowser !== appIsDefaultBrowser) {
      updateUserConfig({ defaultBrowser: appIsDefaultBrowser })
    }

    if (appOpenedWithURL) {
      handleOpenUrl(appOpenedWithURL)
    }

    const webContents = getMainWindow()?.webContents
    const isHealthy = surfBackendManager?.isHealthy
    if (webContents && isHealthy)
      IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, isHealthy)

    if (userConfig.show_changelog) {
      ipcSenders.openChangelog()
      updateUserConfig({ show_changelog: false })
    }
  })

  const mainWindow = getMainWindow()
  if (mainWindow) {
    const crashHandler = CrashHandler.getInstance()
    crashHandler.initialize(mainWindow)
  }
}

const setupApplication = () => {
  initializePaths()
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
    return
  }

  appOpenedWithURL =
    process.argv.find((arg) => arg.startsWith('http://') || arg.startsWith('https://')) ?? null

  app
    .on('browser-window-blur', unregisterShortcuts)
    .on('browser-window-focus', registerShortcuts)
    .on('browser-window-blur', () => ipcSenders.browserFocusChanged('unfocused'))
    .on('browser-window-focus', () => ipcSenders.browserFocusChanged('focused'))
    .on('second-instance', (_event, commandLine) => handleOpenUrl(commandLine.pop() ?? ''))
    .on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    .on('window-all-closed', () => {
      unregisterShortcuts()
      if (!isMac()) app.quit()
    })

  app
    .on('open-url', (_event, url) =>
      isAppLaunched ? handleOpenUrl(url) : (appOpenedWithURL = url)
    )
    .on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
    .on('will-quit', async () => {
      surfBackendManager?.stop()
      await cleanupTempFiles()
    })

  registerProtocols()
  app.whenReady().then(initializeApp)
}

setupApplication()
