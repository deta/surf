import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
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

const isDev = import.meta.env.DEV

let child: ChildProcess
let isAppLaunched = false
let appOpenedWithURL: string | null = null

const config = {
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Surf',
  appVersion: import.meta.env.M_VITE_APP_VERSION,
  useTmpDataDir: import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true',
  disableAutoUpdate: import.meta.env.M_VITE_DISABLE_AUTO_UPDATE === 'true'
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
      console.warn('No main window found')

      // If there are no windows, create one and then open the URL once it is ready
      if (BrowserWindow.getAllWindows().length === 0) {
        ipcMain.once('app-ready', () => {
          handleOpenUrl(url)
        })

        createWindow()
      } else {
        console.error('There are windows, but no main window')
      }

      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
    mainWindow.webContents.send('open-url', url)
  } catch (error) {
    console.error('Error handling open URL:', error)

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
    electronApp.setAppUserModelId('space.deta.horizon')

    const userConfig = getUserConfig()

    setupIpcHandlers()

    if (!is.dev) {
      if (!userConfig.api_key) {
        console.log('No api key found, prompting user to enter invite token')
        createSetupWindow()
        return
      }

      const isActivated = await checkIfAppIsActivated(userConfig.api_key)
      if (!isActivated) {
        console.log('App not activated, prompting user to enter invite token again')
        createSetupWindow()
        return
      }
    }

    await setupAdblocker()

    setAppMenu()
    createWindow()

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

    const appPath = `${app.getAppPath()}${isDev ? '' : '.unpacked'}`
    const backendRootPath = join(userDataPath, 'sffs_backend')
    const backendServerPath = join(appPath, 'resources', 'bin', 'surf-backend')
    child = spawn(backendServerPath, [backendRootPath, 'false'])
    child = spawn(backendServerPath, [backendRootPath, 'false'])

    child.stdout?.on('data', (data) => {
      console.log(`surfer-backend: ${data}`)
    })

    child.stderr?.on('data', (data) => {
      console.error(`surfer-backend: ${data}`)
    })

    child.on('exit', (code) => {
      console.log(`Child process exited with code ${code}`)
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
    child.kill()
  })

  app.on('browser-window-focus', registerShortcuts)
  app.on('browser-window-blur', unregisterShortcuts)
}
