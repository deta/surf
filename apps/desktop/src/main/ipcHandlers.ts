import { useLogScope } from '@horizon/core/src/lib/utils/log'
import { ipcMain, app, session } from 'electron'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'
import { getUserConfig, updateUserConfig } from './config'
import { handleDragStart } from './drag'
import { EditablePrompt, ElectronAppInfo, UserSettings } from '@horizon/types'
import { getPlatform } from './utils'
import { checkForUpdates } from './appUpdates'
import { getSettingsWindow } from './settingsWindow'
import { createGoogleSignInWindow } from './googleSignInWindow'

const log = useLogScope('Main IPC Handlers')
let prompts: EditablePrompt[] = []

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

  ipcMain.handle('handle-google-sign-in', async (_, { url }) => {
    return await createGoogleSignInWindow(url)
  })

  ipcMain.on(
    'start-drag',
    async (event, resourceId: string, filePath: string, fileType: string) => {
      log.debug('Start drag', resourceId, filePath, fileType)
      const sender = event.sender
      await handleDragStart(sender, resourceId, filePath, fileType)
      log.debug('Drag started')
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

  ipcMain.handle('update-traffic-lights', (_event, { visible }) => {
    if (process.platform == 'darwin') {
      const window = getMainWindow()
      window?.setWindowButtonVisibility(visible)
    }
  })

  ipcMain.on('store-api-key', (_event, key: string) => {
    updateUserConfig({ api_key: key })
  })

  ipcMain.on('store-settings', (_event, settings) => {
    updateUserConfig({ settings: settings })

    // notify other windows of the change
    ipcSenders.userConfigSettingsChange(settings)
  })

  ipcMain.on('update-initialized-tabs', (_event, value) => {
    updateUserConfig({ initialized_tabs: value })
  })

  ipcMain.handle('get-app-info', () => {
    return {
      version: process.env.APP_VERSION ?? app.getVersion(),
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
        log.debug('Request intercepted:', details)

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

  ipcMain.on('check-for-updates', () => {
    checkForUpdates()
  })

  ipcMain.on('set-prompts', (_event, prompts: EditablePrompt[]) => {
    const window = getSettingsWindow()
    if (!window) {
      log.error('Settings window not found')
      return
    }

    window.webContents.send('set-prompts', prompts)
  })

  ipcMain.on('get-prompts', (_event) => {
    ipcSenders.getPrompts()
  })

  ipcMain.on('reset-prompt', (_event, id) => {
    ipcSenders.resetPrompt(id)
  })

  ipcMain.on('update-prompt', (_event, { id, content }) => {
    ipcSenders.updatePrompt(id, content)
  })
}

export const ipcSenders = {
  openCheatSheet: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('open-cheat-sheet')
  },

  openFeedbackPage: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('open-feedback-page')
  },

  addDemoItems: () => {
    const window = getMainWindow()
    if (!window) {
      console.error('Main window not found')
      return
    }

    window.webContents.send('add-demo-items')
  },

  adBlockChanged: (partition: string, state: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('adblocker-state-changed', { partition, state })
  },

  trackEvent: (eventName: string, properties: Record<string, any>) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('track-event', { eventName, properties })
  },

  getPrompts: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('get-prompts')
  },

  resetPrompt: (id: string) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('reset-prompt', id)
  },

  updatePrompt: (id: string, content: string) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('update-prompt', { id, content })
  },

  toggleSidebar: (visible?: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('toggle-sidebar', visible)
  },

  toggleTabsPosition: (visible?: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('toggle-tabs-position', visible)
  },

  copyActiveTabURL: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('copy-active-tab-url')
  },

  createNewTab: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('create-new-tab')
  },

  closeActiveTab: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('close-active-tab')
  },

  openOasis: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('open-oasis')
  },

  reloadActiveTab: (force = false) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    window.webContents.send('reload-active-tab', force)
  },

  userConfigSettingsChange(settings: UserSettings) {
    // const window = getMainWindow()
    // if (!window) {
    //   log.error('Main window not found')
    //   return
    // }

    // notify all windows

    const windows = [getMainWindow(), getSettingsWindow()]

    windows.forEach((window) => {
      if (!window) return
      window.webContents.send('user-config-settings-change', settings)
    })
  }
}
