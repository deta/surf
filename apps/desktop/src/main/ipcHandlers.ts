import { ipcMain, app, session } from 'electron'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'
import { getUserConfig, updateUserConfig } from './config'
import { handleDragStart } from './drag'
import { ElectronAppInfo } from '@horizon/types'
import { getPlatform } from './utils'

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
      x: 70,
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

  ipcMain.handle('get-user-config', async (_) => {
    return getUserConfig()
  })

  ipcMain.on(
    'start-drag',
    async (event, resourceId: string, filePath: string, fileType: string) => {
      console.log('Start drag', resourceId, filePath, fileType)
      const sender = event.sender
      await handleDragStart(sender, resourceId, filePath, fileType)
      console.log('Drag started')
    }
  )

  ipcMain.handle('quit-app', () => {
    app.quit()
  })

  ipcMain.handle('restart-app', () => {
    app.relaunch()
    app.exit()
  })

  ipcMain.handle('toggle-fullscreen', () => {
    const window = getMainWindow()
    window?.setFullScreen(!window.fullScreen)
  })

  ipcMain.on('store-api-key', (_event, key: string) => {
    updateUserConfig({ api_key: key })
  })

  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      platform: getPlatform()
    } as ElectronAppInfo
  })

  ipcMain.handle('intercept-requests-headers', (_event, { urls, partition }) => {
    const filter = {
      urls: urls
    }

    const webRequest = session.fromPartition(partition).webRequest

    const cleanup = () => webRequest.onBeforeSendHeaders(null)

    return new Promise((resolve, reject) => {
      let timeout

      webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        console.log('Request intercepted:', details)

        callback({})
        cleanup()
        clearTimeout(timeout)
        resolve({ url: details.url, headers: details.requestHeaders })
      })

      timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Request interception timed out'))
      }, 20000)
    })
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

  openFeedbackPage: () => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('open-feedback-page')
  },

  adBlockChanged: (partition: string, state: boolean) => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('adblocker-state-changed', { partition, state })
  },

  trackEvent: (eventName: string, properties: Record<string, any>) => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('track-event', { eventName, properties })
  }
}
