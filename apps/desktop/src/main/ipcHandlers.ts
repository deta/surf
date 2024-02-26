import { ipcMain } from 'electron'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'

export function setupIpcHandlers() {
  ipcMain.handle('set-adblocker-state', async (_, { partition, state }) => {
    return setAdblockerState(partition as string, state as boolean)
  })

  ipcMain.handle('get-adblocker-state', async (_, { partition }) => {
    return getAdblockerState(partition as string)
  })

  ipcMain.handle('request-new-preview-image', async (event, { horizonId }) => {
    const window = getMainWindow()
    if (!window) return

    const rect = window.getContentBounds()
    const image = await window.webContents.capturePage({
      ...rect,
      x: 0,
      y: 0
    })
    const imageSize = image.getSize()

    // schedule the closure to run in the
    // next event loop tick and return from
    // this function immediately
    setTimeout(() => {
      const buffer = image.toBitmap()
      // `send` will throw if the recipient is destroyed
      try {
        event.sender.send('new-preview-image', {
          horizonId,
          buffer: buffer,
          width: imageSize.width,
          height: imageSize.height
        })
      } catch (_) {}
    }, 0)

    return
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

export const ipcSenders = {
  openCheatSheet: () => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('open-cheat-sheet')
  },

  adBlockChanged: (partition: string, state: boolean) => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('adblocker-state-changed', { partition, state })
  }
}
