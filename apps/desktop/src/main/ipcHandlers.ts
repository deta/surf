import { isMac, useLogScope } from '@horizon/utils'
import { app, session } from 'electron'
import path from 'path'
import { setAdblockerState, getAdblockerState } from './adblocker'
import { getMainWindow } from './mainWindow'
import { getUserConfig, updateUserConfig, updateUserConfigSettings } from './config'
import { handleDragStart } from './drag'
import { ElectronAppInfo, RightSidebarTab, SFFSResource, UserSettings } from '@horizon/types'
import { getPlatform, isPathSafe, isDefaultBrowser } from './utils'
import { checkForUpdates } from './appUpdates'
import { useAsDefaultBrowser } from './appMenu'
import { createSettingsWindow, getSettingsWindow } from './settingsWindow'
import { setupHistorySwipeIpcSenders } from './historySwipe'

import {
  IPC_EVENTS_MAIN,
  NewWindowRequest,
  TrackEvent
} from '@horizon/core/src/lib/service/ipc/events'
import { getSetupWindow } from './setupWindow'
import { openResourceAsFile } from './downloadManager'
import { getAppMenu } from './appMenu'

import fs from 'fs/promises'
import tokenManager from './token'

const log = useLogScope('Main IPC Handlers')
// let prompts: EditablePrompt[] = []

export function setupIpc(backendRootPath: string) {
  setupHistorySwipeIpcSenders()
  setupIpcHandlers(backendRootPath)
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
    log.warn('Invalid sender:', event.senderFrame?.url)
    return false
  }

  return true
}

function setupIpcHandlers(backendRootPath: string) {
  IPC_EVENTS_MAIN.tokenCreate.handle(async (event, data) => {
    if (!validateIPCSender(event)) return null
    return tokenManager.create(data)
  })

  IPC_EVENTS_MAIN.webviewReadResourceData.handle(async (_, { token, resourceId }) => {
    if (!tokenManager.verify(token, resourceId)) return null
    tokenManager.revoke(token)

    let fileHandle: fs.FileHandle | null = null

    try {
      const base_path = path.join(app.getPath('userData'), 'sffs_backend', 'resources')
      const resource_path = path.join(base_path, resourceId)
      if (!isPathSafe(base_path, resource_path)) return null
      fileHandle = await fs.open(resource_path, 'r')

      const stats = await fileHandle.stat()
      const buffer = Buffer.alloc(stats.size)
      await fileHandle.read(buffer, 0, stats.size, 0)

      return buffer
    } catch (error) {
      console.log('failed to read resource file', error)
      return null
    } finally {
      if (fileHandle) {
        await fileHandle.close().catch(() => {})
      }
    }
  })

  IPC_EVENTS_MAIN.showAppMenuPopup.on((event, _) => {
    if (!validateIPCSender(event)) return
    getAppMenu()?.popup()
  })

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

    if (isMac()) {
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

  IPC_EVENTS_MAIN.screenshotPage.handle(async (event, rect) => {
    if (!validateIPCSender(event)) return null

    const window = getMainWindow()
    if (!window) return null

    const image = await window.webContents.capturePage(rect)
    return image.toDataURL()
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

  IPC_EVENTS_MAIN.useAsDefaultBrowser.on((event) => {
    if (!validateIPCSender(event)) return

    return useAsDefaultBrowser()
  })

  IPC_EVENTS_MAIN.isDefaultBrowser.handle((event) => {
    if (!validateIPCSender(event)) return null

    return isDefaultBrowser()
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

  IPC_EVENTS_MAIN.openInvitePage.on((event) => {
    if (!validateIPCSender(event)) return
    ipcSenders.openInvitePage()
  })

  IPC_EVENTS_MAIN.updatePrompt.on((event, { id, content }) => {
    if (!validateIPCSender(event)) return

    ipcSenders.updatePrompt(id, content)
  })

  IPC_EVENTS_MAIN.openResourceLocally.on((event, resource: SFFSResource) => {
    if (!validateIPCSender(event)) return

    try {
      const resourcesDirectory = path.join(backendRootPath, 'resources')
      openResourceAsFile(resource, resourcesDirectory)
    } catch (error) {
      log.error('Error opening resource file:', error)
    }
  })

  IPC_EVENTS_MAIN.resetBackgroundImage.on((event) => {
    if (!validateIPCSender(event)) return

    ipcSenders.resetBackgroundImage()
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

  openInvitePage: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openInvitePage.sendToWebContents(window.webContents)
  },

  openFeedbackPage: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openFeedbackPage.sendToWebContents(window.webContents)
  },

  openWelcomePage: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openWelcomePage.sendToWebContents(window.webContents)
  },

  openImporter: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.openImporter.sendToWebContents(window.webContents)
  },

  browserFocusChanged: (state: 'focused' | 'unfocused') => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.browserFocusChange.sendToWebContents(window.webContents, { state })
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

  toggleTheme: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.toggleTheme.sendToWebContents(window.webContents)
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

  startScreenshotPicker: () => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.startScreenshotPicker.sendToWebContents(window.webContents)
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

  newWindowRequest: (details: NewWindowRequest) => {
    const window = getMainWindow()
    if (!window) {
      log.error('Main window not found')
      return
    }

    IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(window.webContents, {
      url: details.url,
      disposition: details.disposition,
      webContentsId: details.webContentsId
    })
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
  },

  resetBackgroundImage() {
    const mainWindow = getMainWindow()
    if (!mainWindow) return
    IPC_EVENTS_MAIN.resetBackgroundImage.sendToWebContents(mainWindow.webContents)
  },

  importedFiles(files: string[]) {
    const mainWindow = getMainWindow()
    if (!mainWindow) return
    IPC_EVENTS_MAIN.importedFiles.sendToWebContents(mainWindow.webContents, files)
  }
}
