import { app, BrowserWindow } from 'electron'
import { createWindow } from './mainWindow'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker, toggleAdblocker } from './adblocker'
import { setupIpcHandlers } from './ipcHandlers'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'

const appName = import.meta.env.M_VITE_PRODUCT_NAME || 'Horizon'

let userDataPath = join(dirname(app.getPath('userData')), appName)
if (import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true') {
  userDataPath = join(
    // app.getPath('temp') returns a path to the user's OS tmp directory
    app.getPath('temp'),
    import.meta.env.M_VITE_APP_VERSION || '',
    appName
  )
}
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('space.deta.horizon')

  setupIpcHandlers()
  await setupAdblocker()
  toggleAdblocker('persist:horizon')

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
