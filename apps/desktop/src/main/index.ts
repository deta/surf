import { app, BrowserWindow, ipcMain } from 'electron'
import { createWindow, getMainWindow } from './mainWindow'
import { setAppMenu } from './appMenu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker } from './adblocker'
import { setupIpcHandlers } from './ipcHandlers'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'

let isAppLaunched = false
let appOpenedWithURL: string | null = null

const config = {
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Horizon',
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
  const mainWindow = getMainWindow()

  if (!mainWindow) {
    console.error('No main window found, ')
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
  mainWindow.webContents.send('open-url', url)
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

    setupIpcHandlers()
    await setupAdblocker()

    setAppMenu()
    createWindow()

    if (appOpenedWithURL) {
      // we need to wait for the app/horizon to be ready before we can send a message to the renderer to open the URL
      ipcMain.once('app-ready', () => {
        handleOpenUrl(appOpenedWithURL!)
      })
    }
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

  app.on('browser-window-focus', registerShortcuts)
  app.on('browser-window-blur', unregisterShortcuts)
}
