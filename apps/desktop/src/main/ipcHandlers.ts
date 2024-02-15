import { ipcMain } from 'electron'
import { toggleAdblocker, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'

export function setupIpcHandlers() {
  ipcMain.handle('toggle-adblocker', async (_, { partition }) => {
    return toggleAdblocker(partition as string)
  })

  ipcMain.handle('get-adblocker-state', async (_, { partition }) => {
    return getAdblockerState(partition as string)
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
