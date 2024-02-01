import { ipcMain } from 'electron'
import { toggleAdblocker } from './adblocker'
import { getMainWindow } from './mainWindow'

export function setupIpcHandlers() {
  ipcMain.on('toggle-adblocker', (_, enable, partition) => {
    toggleAdblocker(enable, partition)
  })

  ipcMain.handle('capture-web-contents', async () => {
    const window = getMainWindow()
    if (!window) return

    const PADDING = 40
    const rect = window.getContentBounds()
    const image = await window.webContents.capturePage({
      ...rect,
      x: 0,
      y: PADDING
    })
    return image.toDataURL()
  })
}
