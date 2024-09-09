import { useLogScope } from '@horizon/utils'
import { app, session } from 'electron'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'
import { getUserConfig, updateUserConfig, updateUserConfigSettings } from './config'
import { handleDragStart } from './drag'
import { ElectronAppInfo, RightSidebarTab, UserSettings } from '@horizon/types'
import { getPlatform } from './utils'
import { checkForUpdates } from './appUpdates'
import { createSettingsWindow, getSettingsWindow } from './settingsWindow'
import { createGoogleSignInWindow } from './googleSignInWindow'
import { setupHistorySwipeIpcSenders } from './historySwipe'

import { IPC_EVENTS_MAIN, TrackEvent } from '@horizon/core/src/lib/service/ipc/events'
import { getSetupWindow } from './setupWindow'

const log = useLogScope('Main IPC Handlers')
// let prompts: EditablePrompt[] = []

export function setupIpc() {
  setupHistorySwipeIpcSenders()
  setupIpcHandlers()
}

// Make sure the sender is one of the main windows (main, settings, setup) to prevent spoofing of messages from other windows (very unlikely but still recommended)
export const validateIPCSender = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => {
  const validIDs: number[] = []
  const mainWindow = getMainWindow()
  const settingsWindow = getSettingsWindow()
  const setupWindow = getSetupWindow()

  if (!mainWindow) {
    log.warn('Main window not found')
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    validIDs.push(mainWindow.webContents.id)
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    validIDs.push(settingsWindow.webContents.id)
  }

  if (setupWindow && !setupWindow.isDestroyed()) {
    validIDs.push(setupWindow.webContents.id)
  }

  if (!validIDs.includes(event.sender.id)) {
    log.warn('Invalid sender:', event.senderFrame.url)
    return false
  }

  return true
}

function setupIpcHandlers() {
  IPC_EVENTS_MAIN.setAdblockerState.on(async (event, { partition, state }) => {
    if (!validateIPCSender(event)) return

    setAdblockerState(partition, state)
  })

  IPC_EVENTS_MAIN.getAdblockerState.handle(async (event, partition) => {
    if (!validateIPCSender(event)) return null

    return getAdblockerState(partition)
  })

  IPC_EVENTS_MAIN.captureWebContents.handle(async (event) => {
    if (!validateIPCSender(event)) return null

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

  IPC_EVENTS_MAIN.restartApp.on((event) => {
    if (!validateIPCSender(event)) return

    app.relaunch()
    app.exit()
  })

  IPC_EVENTS_MAIN.updateTrafficLights.on((event, visible) => {
    if (!validateIPCSender(event)) return

    if (process.platform == 'darwin') {
      const window = getMainWindow()
      window?.setWindowButtonVisibility(visible)
    }
  })

  IPC_EVENTS_MAIN.controlWindow.on((event, action) => {
    if (!validateIPCSender(event)) return

    const window = getMainWindow()
    if (!window) return

    if (action === 'minimize') {
      window.minimize()
    } else if (action === 'toggle-maximize') {
      window.isMaximized() ? window.unmaximize() : window.maximize()
    } else if (action === 'close') {
      window.close()
    } else {
      log.error('Invalid action', action)
    }
  })

  IPC_EVENTS_MAIN.openSettings.on((event) => {
    if (!validateIPCSender(event)) return

    createSettingsWindow()
  })

  IPC_EVENTS_MAIN.googleSignIn.handle(async (event, url) => {
    if (!validateIPCSender(event)) return null

    return await createGoogleSignInWindow(url)
  })

  IPC_EVENTS_MAIN.getUserConfig.handle(async (event) => {
    if (!validateIPCSender(event)) return null

    return getUserConfig()
  })

  IPC_EVENTS_MAIN.startDrag.on(async (event, { resourceId, filePath, fileType }) => {
    if (!validateIPCSender(event)) return

    log.debug('Start drag', resourceId, filePath, fileType)
    const sender = event.sender
    await handleDragStart(sender, resourceId, filePath, fileType)
  })

  IPC_EVENTS_MAIN.storeAPIKey.on(async (event, key) => {
    if (!validateIPCSender(event)) return

    updateUserConfig({ api_key: key })
  })

  IPC_EVENTS_MAIN.updateUserConfigSettings.on(async (event, settings) => {
    if (!validateIPCSender(event)) return

    const updatedSettings = updateUserConfigSettings(settings)

    // notify other windows of the change
    ipcSenders.userConfigSettingsChange(updatedSettings)
  })

  IPC_EVENTS_MAIN.updateInitializedTabs.on(async (event, value) => {
    if (!validateIPCSender(event)) return

    updateUserConfig({ initialized_tabs: value })
  })

  IPC_EVENTS_MAIN.getAppInfo.handle(async (event) => {
    if (!validateIPCSender(event)) return null

    return {
      version: process.env.APP_VERSION ?? app.getVersion(),
      platform: getPlatform()
    } as ElectronAppInfo
  })

  IPC_EVENTS_MAIN.interceptRequestHeaders.handle((event, { urls, partition }) => {
    if (!validateIPCSender(event)) return null

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

  IPC_EVENTS_MAIN.checkForUpdates.on((event) => {
    if (!validateIPCSender(event)) return

    checkForUpdates()
  })

  IPC_EVENTS_MAIN.setPrompts.on((event, prompts) => {
    if (!validateIPCSender(event)) return

    const window = getSettingsWindow()
    if (!window) {
      log.error('Settings window not found')
      return
    }

    IPC_EVENTS_MAIN.setPrompts.sendToWebContents(window.webContents, prompts)
  })

  IPC_EVENTS_MAIN.requestPrompts.on((event) => {
    if (!validateIPCSender(event)) return

    ipcSenders.getPrompts()
  })

  IPC_EVENTS_MAIN.resetPrompt.on((event, id) => {
    if (!validateIPCSender(event)) return

    ipcSenders.resetPrompt(id)
  })

  IPC_EVENTS_MAIN.updatePrompt.on((event, { id, content }) => {
    if (!validateIPCSender(event)) return

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

  trackEvent: (name: TrackEvent['name'], properties: TrackEvent['properties']) => {
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

  openHistory: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openHistory.sendToWebContents(window.webContents)
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
