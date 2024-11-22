import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'
import { isDev, isMac, isWindows, useLogScope } from '@horizon/utils'
import { TelemetryEventTypes } from '@horizon/types'
import { IPC_EVENTS_MAIN } from '@horizon/core/src/lib/service/ipc/events'

import { createWindow, getMainWindow } from './mainWindow'
import { setAppMenu } from './appMenu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker } from './adblocker'
import { ipcSenders, setupIpc } from './ipcHandlers'
import { getUserConfig, updateUserConfig } from './config'
import { createSetupWindow } from './setupWindow'
import { checkIfAppIsActivated } from './activation'
import { isDefaultBrowser } from './utils'
import { SurfBackendServerManager } from './surfBackend'
import { silentCheckForUpdates } from './appUpdates'

const log = useLogScope('Main Index')

const CONFIG = {
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Surf',
  appVersion: import.meta.env.M_VITE_APP_VERSION,
  useTmpDataDir: import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true',
  disableAutoUpdate: import.meta.env.M_VITE_DISABLE_AUTO_UPDATE === 'true',
  embeddingModelMode: import.meta.env.M_VITE_EMBEDDING_MODEL_MODE || 'default',
  forceSetupWindow: import.meta.env.M_VITE_CREATE_SETUP_WINDOW === 'true',
  sentryDSN: import.meta.env.M_VITE_SENTRY_DSN
}

let isAppLaunched = false
let appOpenedWithURL: string | null = null
let surfBackendManager: SurfBackendServerManager | null = null

process.on('uncaughtException', (error: any) => {
  log.error('Uncaught exception:', error)
})

const initializePaths = () => {
  const userDataPath = CONFIG.useTmpDataDir
    ? join(app.getPath('temp'), CONFIG.appVersion || '', CONFIG.appName)
    : join(dirname(app.getPath('userData')), CONFIG.appName)
  mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
  return userDataPath
}

const registerProtocols = () => {
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
    }
  ])
}

const handleOpenUrl = (url: string) => {
  try {
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
    if (is.dev) throw error
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

  // prettier-ignore
  {
    surfBackendManager
      .on('stdout', data => log.info('[backend:stdout] ', data))
      .on('stderr', data => log.error('[backend:stderr]', data))
      .on('error', error => log.error('[backend:error ]', error))
      .on('warn', msg => log.warn('[backend:warn  ]', msg))
      .on('info', msg => log.info('[backend:info  ]', msg))
      .on('exit', code => log.info('[backend:exit  ] code:', code))
      .on('signal', signal => log.info('[backend:signal] signal:', signal))
  }

  surfBackendManager.start()
  await surfBackendManager.waitForStart()
}

const initializeApp = async () => {
  isAppLaunched = true
  electronApp.setAppUserModelId('ea.browser.deta.surf')

  const appPath = app.getAppPath() + (isDev ? '' : '.unpacked')
  const userDataPath = app.getPath('userData')
  const backendRootPath = join(userDataPath, 'sffs_backend')
  const userConfig = getUserConfig()

  setupIpc(backendRootPath)

  if (!is.dev) {
    if (!userConfig.api_key) {
      log.debug('No api key found, prompting user to enter invite token')
      createSetupWindow()
      return
    }

    const isActivated = await checkIfAppIsActivated(userConfig.api_key)
    if (!isActivated) {
      log.debug('App not activated, prompting user to enter invite token again')
      createSetupWindow()
      return
    }
  }

  if (isDev) {
    app.dock?.setIcon(join(app.getAppPath(), 'build/resources/dev/icon.png'))
  }

  await setupAdblocker()
  setAppMenu()
  createWindow()

  if (CONFIG.forceSetupWindow) {
    createSetupWindow()
  }

  try {
    await setupBackendServer(appPath, backendRootPath, userConfig)
  } catch (err) {
    log.error(`failed to start the surf backend process: ${err}`)
  }

  IPC_EVENTS_MAIN.appReady.once(async () => {
    const appIsDefaultBrowser = await isDefaultBrowser()
    if (userConfig.defaultBrowser !== appIsDefaultBrowser) {
      ipcSenders.trackEvent(TelemetryEventTypes.SetDefaultBrowser, { value: appIsDefaultBrowser })
      updateUserConfig({ defaultBrowser: appIsDefaultBrowser })
    }

    if (appOpenedWithURL) {
      handleOpenUrl(appOpenedWithURL)
    }

    setInterval(silentCheckForUpdates, 1000 * 60 * 30) // 30 minutes
  })
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

  // prettier-ignore
  {
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
      .on('open-url', (_event, url) => isAppLaunched ? handleOpenUrl(url) : (appOpenedWithURL = url))
      .on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
      .on('will-quit', () => surfBackendManager?.stop())
  }

  registerProtocols()
  app.whenReady().then(initializeApp)
}

setupApplication()
