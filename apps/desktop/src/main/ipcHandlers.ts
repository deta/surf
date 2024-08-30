import { useLogScope } from '@horizon/utils'
import { app, session } from 'electron'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'
import { getUserConfig, updateUserConfig, updateUserConfigSettings } from './config'
import { handleDragStart } from './drag'
import { ElectronAppInfo, RightSidebarTab, UserSettings } from '@horizon/types'
import { getPlatform } from './utils'
import { checkForUpdates } from './appUpdates'
import { getSettingsWindow } from './settingsWindow'
import { createGoogleSignInWindow } from './googleSignInWindow'
import { setupHistorySwipeIpcSenders } from './historySwipe'

import { IPC_EVENTS_MAIN } from '@horizon/core/src/lib/service/ipc/events'

const log = useLogScope('Main IPC Handlers')
// let prompts: EditablePrompt[] = []

export function setupIpc() {
  setupHistorySwipeIpcSenders()
  setupIpcHandlers()
}

function setupIpcHandlers() {
  IPC_EVENTS_MAIN.setAdblockerState.on(async (_, { partition, state }) => {
    setAdblockerState(partition, state)
  })

  IPC_EVENTS_MAIN.getAdblockerState.handle(async (_, partition) => {
    return getAdblockerState(partition)
  })

  IPC_EVENTS_MAIN.captureWebContents.handle(async () => {
    const window = getMainWindow()
    if (!window) return null

    const PADDING = 40
    const rect = window.getContentBounds()
    const image = await window.webContents.capturePage({
      ...rect,
      x: 0,
      y: PADDING
    })
    return image.toDataURL()
  })

  IPC_EVENTS_MAIN.restartApp.on(() => {
    app.relaunch()
    app.exit()
  })

  IPC_EVENTS_MAIN.updateTrafficLights.on((_, visible) => {
    if (process.platform == 'darwin') {
      const window = getMainWindow()
      window?.setWindowButtonVisibility(visible)
    }
  })

  IPC_EVENTS_MAIN.googleSignIn.handle(async (_, url) => {
    return await createGoogleSignInWindow(url)
  })

  IPC_EVENTS_MAIN.getUserConfig.handle(async () => {
    return getUserConfig()
  })

  IPC_EVENTS_MAIN.startDrag.on(async (event, { resourceId, filePath, fileType }) => {
    log.debug('Start drag', resourceId, filePath, fileType)
    const sender = event.sender
    await handleDragStart(sender, resourceId, filePath, fileType)
  })

  IPC_EVENTS_MAIN.storeAPIKey.on(async (_, key) => {
    updateUserConfig({ api_key: key })
  })

  IPC_EVENTS_MAIN.updateUserConfigSettings.on(async (_, settings) => {
    const updatedSettings = updateUserConfigSettings(settings)

    // notify other windows of the change
    ipcSenders.userConfigSettingsChange(updatedSettings)
  })

  IPC_EVENTS_MAIN.updateInitializedTabs.on(async (_, value) => {
    updateUserConfig({ initialized_tabs: value })
  })

  IPC_EVENTS_MAIN.getAppInfo.handle(async () => {
    return {
      version: process.env.APP_VERSION ?? app.getVersion(),
      platform: getPlatform()
    } as ElectronAppInfo
  })

  IPC_EVENTS_MAIN.interceptRequestHeaders.handle((_event, { urls, partition }) => {
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

  IPC_EVENTS_MAIN.checkForUpdates.on(() => {
    checkForUpdates()
  })

  IPC_EVENTS_MAIN.setPrompts.on((_event, prompts) => {
    const window = getSettingsWindow()
    if (!window) {
      log.error('Settings window not found')
      return
    }

    IPC_EVENTS_MAIN.setPrompts.sendToWebContents(window.webContents, prompts)
  })

  IPC_EVENTS_MAIN.requestPrompts.on((_event) => {
    ipcSenders.getPrompts()
  })

  IPC_EVENTS_MAIN.resetPrompt.on((_event, id) => {
    ipcSenders.resetPrompt(id)
  })

  IPC_EVENTS_MAIN.updatePrompt.on((_event, { id, content }) => {
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

    IPC_EVENTS_MAIN.openCheatSheet.sendToWebContents(window.webContents)
  },

  openFeedbackPage: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openFeedbackPage.sendToWebContents(window.webContents)
  },

  adBlockChanged: (partition: string, state: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.adBlockerStateChange.sendToWebContents(window.webContents, { partition, state })
  },

  trackEvent: (name: string, properties: Record<string, any>) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.trackEvent.sendToWebContents(window.webContents, { name, properties })
  },

  getPrompts: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.requestPrompts.sendToWebContents(window.webContents)
  },

  resetPrompt: (id: string) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.resetPrompt.sendToWebContents(window.webContents, id)
  },

  updatePrompt: (id: string, content: string) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.updatePrompt.sendToWebContents(window.webContents, { id, content })
  },

  toggleSidebar: (visible?: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.toggleSidebar.sendToWebContents(window.webContents, visible)
  },

  toggleTabsPosition: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.toggleTabsPosition.sendToWebContents(window.webContents)
  },

  copyActiveTabURL: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.copyActiveTabUrl.sendToWebContents(window.webContents)
  },

  createNewTab: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.createNewTab.sendToWebContents(window.webContents)
  },

  closeActiveTab: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.closeActiveTab.sendToWebContents(window.webContents)
  },

  openOasis: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openOasis.sendToWebContents(window.webContents)
  },

  toggleRightSidebar: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.toggleRightSidebar.sendToWebContents(window.webContents)
  },

  toggleRightSidebarTab: (tab: RightSidebarTab) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.toggleRightSidebarTab.sendToWebContents(window.webContents, tab)
  },

  reloadActiveTab: (force = false) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.reloadActiveTab.sendToWebContents(window.webContents, force)
  },

  openDevTools: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openDevTools.sendToWebContents(window.webContents)
  },

  openURL: (url: string, active: boolean) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openURL.sendToWebContents(window.webContents, { url, active })
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
      if (!window || window.isDestroyed()) return

      IPC_EVENTS_MAIN.userConfigSettingsChange.sendToWebContents(window.webContents, settings)
    })
  }
}
