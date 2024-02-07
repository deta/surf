import { app, BrowserWindow } from 'electron'
import { createWindow } from './mainWindow'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { setupAdblocker, toggleAdblocker } from './adblocker'
import { setupIpcHandlers } from './ipcHandlers'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { join, dirname } from 'path'

app.setPath('userData', join(dirname(app.getPath('userData')), 'Horizon'))

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('space.deta.horizon')

  setupIpcHandlers()
  await setupAdblocker()
  toggleAdblocker(true, 'persist:horizon')

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
