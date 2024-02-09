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

  ipcMain.handle('request-new-preview-image', async (event, { horizonId }) => {
    const window = getMainWindow()
    if (!window) return

    const PADDING = 40
    const rect = window.getContentBounds()
    console.time('capturePage')
    const image = await window.webContents.capturePage({
      ...rect,
      x: 0,
      y: PADDING
    })
    console.timeEnd('capturePage')

    // setTimeout(() => {
    console.time('bitmap')
    const buffer = image.toBitmap()
    console.timeEnd('bitmap')
    event.sender.send('new-preview-image', { horizonId, buffer: buffer })
    // }, 1)
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
