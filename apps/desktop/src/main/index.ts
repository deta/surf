import { app, BrowserWindow } from 'electron'
import { createWindow } from './mainWindow'
import { setAppMenu } from './appMenu'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker, toggleAdblocker } from './adblocker'
import { setupIpcHandlers } from './ipcHandlers'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'

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

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('space.deta.horizon')

  setupIpcHandlers()
  await setupAdblocker()
  toggleAdblocker('persist:horizon')

  setAppMenu()
  createWindow()
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
