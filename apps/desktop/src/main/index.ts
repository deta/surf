import { useLogScope } from '@horizon/utils'
import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'
import { TelemetryEventTypes } from '@horizon/types'

import { createWindow, getMainWindow } from './mainWindow'
import { setAppMenu } from './appMenu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker } from './adblocker'
import { ipcSenders, setupIpcHandlers } from './ipcHandlers'
import { getUserConfig, updateUserConfig } from './config'
import { createSetupWindow } from './setupWindow'
import { checkIfAppIsActivated } from './activation'
import { isDefaultBrowser } from './utils'
import { SurfBackendServerManager } from './surfBackend'

const log = useLogScope('Main Index')
const isDev = import.meta.env.DEV

let isAppLaunched = false
let appOpenedWithURL: string | null = null
let surfBackendManager: SurfBackendServerManager | null = null

const config = {
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Surf',
  appVersion: import.meta.env.M_VITE_APP_VERSION,
  useTmpDataDir: import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true',
  disableAutoUpdate: import.meta.env.M_VITE_DISABLE_AUTO_UPDATE === 'true',
  embeddingModelMode: import.meta.env.M_VITE_EMBEDDING_MODEL_MODE || 'default'
}

let userDataPath = join(dirname(app.getPath('userData')), config.appName)
if (config.useTmpDataDir) {
  userDataPath = join(
    // app.getPath('temp') returns a path to the user's OS tmp directory
    app.getPath('temp'),
    config.appVersion || '',
    config.appName
  )
}
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)

const handleOpenUrl = (url: string) => {
  try {
    const mainWindow = getMainWindow()

    if (!mainWindow || mainWindow?.isDestroyed()) {
      log.warn('No main window found')

      // If there are no windows, create one and then open the URL once it is ready
      if (BrowserWindow.getAllWindows().length === 0) {
        ipcMain.once('app-ready', () => {
          handleOpenUrl(url)
        })

        createWindow()
      } else {
        log.error('There are windows, but no main window')
      }

      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
    mainWindow.webContents.send('open-url', url)
  } catch (error) {
    log.error('Error handling open URL:', error)

    // throw if development
    if (is.dev) {
      throw error
    }
  }
}

// Windows + Linux, more info: https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // Windows + Linux
  app.on('second-instance', (_event, commandLine) => {
    handleOpenUrl(commandLine.pop() ?? '')
  })

  // MacOS
  app.on('open-url', (_event, url) => {
    // The open-url event can fire before the app is ready. If this is the case we store the URL and handle it later when the app is ready.
    if (isAppLaunched) {
      handleOpenUrl(url)
    } else {
      appOpenedWithURL = url
    }
  })

  app.whenReady().then(async () => {
    isAppLaunched = true
    electronApp.setAppUserModelId('ea.browser.deta.surf')

    const userConfig = getUserConfig()

    setupIpcHandlers()

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

    await setupAdblocker()

    setAppMenu()
    createWindow()
    // createSetupWindow() for dev on setup window only

    const appPath = app.getAppPath() + (isDev ? '' : '.unpacked')
    const userDataPath = app.getPath('userData')
    const backendRootPath = join(userDataPath, 'sffs_backend')
    const backendServerPath = join(appPath, 'resources', 'bin', 'surf-backend')

    surfBackendManager = new SurfBackendServerManager(backendServerPath, [
      backendRootPath,
      'false',
      isDev ? config.embeddingModelMode : userConfig.settings?.embedding_model
    ])

    surfBackendManager?.on('stdout', (data) => log.info('[surf backend] stdout:', data))
    surfBackendManager?.on('stderr', (data) => log.error('[surf backend] stderr:', data))
    surfBackendManager?.on('exit', (code) => log.info('[surf backend] exited with code:', code))
    surfBackendManager?.on('signal', (signal) =>
      log.info('[surf backend] exited with signal:', signal)
    )
    surfBackendManager?.on('error', (error) => log.error('[surf backend] error:', error))
    surfBackendManager?.on('warn', (message) => log.warn('[surf backend] warning:', message))
    surfBackendManager?.on('info', (message) => log.info('[surf backend] info:', message))

    surfBackendManager?.start()

    // we need to wait for the app/horizon to be ready before we can send any messages to the renderer
    ipcMain.once('app-ready', () => {
      const appIsDefaultBrowser = isDefaultBrowser()

      // If the value stored in user config is different from the actual state, update the user config and track the event
      if (userConfig.defaultBrowser !== appIsDefaultBrowser) {
        ipcSenders.trackEvent(TelemetryEventTypes.SetDefaultBrowser, { value: appIsDefaultBrowser })
        updateUserConfig({ defaultBrowser: appIsDefaultBrowser })
      }

      if (appOpenedWithURL) {
        handleOpenUrl(appOpenedWithURL!)
      }
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('will-quit', () => {
    surfBackendManager?.stop()
  })

  app.on('browser-window-focus', registerShortcuts)
  app.on('browser-window-blur', unregisterShortcuts)
}
