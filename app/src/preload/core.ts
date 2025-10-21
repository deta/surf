import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import path from 'path'
import mime from 'mime-types'
import fetch from 'cross-fetch'

import { promises as fsp } from 'fs'
import {
  type EditablePrompt,
  type UserSettings,
  type RightSidebarTab,
  type DownloadRequestMessage,
  type DownloadUpdatedMessage,
  type DownloadDoneMessage,
  type SFFSResource,
  type DownloadPathResponseMessage,
  SettingsWindowTab,
  BrowserType,
  WebContentsViewAction,
  WebContentsViewEvent,
  WebContentsViewManagerActionType,
  WebContentsViewManagerActionPayloads,
  WebContentsViewActionPayloads,
  WebContentsViewActionType,
  WebContentsViewManagerAction,
  WebContentsViewManagerActionOutputs,
  WebContentsViewActionOutputs,
  RendererType,
  type ControlWindow
} from '@deta/types'

import {
  IPC_EVENTS_RENDERER,
  NewWindowRequest,
  OpenURL,
  setupMessagePortPrimary,
  type ShowOpenDialog,
  SpaceBasicData
} from '@deta/services/ipc'

import { getUserConfig } from '../main/config'
import { initBackend } from './helpers/backend'
import type { MessagePortCallbackPrimary } from '@deta/services/messagePort'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''

const DISABLE_TAB_SWITCHING_SHORTCUTS = process.argv.includes('--disable-tab-switching-shortcuts')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''
const SettingsWindowEntrypoint =
  process.argv.find((arg) => arg.startsWith('--settings-window-entry-point='))?.split('=')[1] || ''

const webviewNewWindowHandlers: Record<number, (details: NewWindowRequest) => void> = {}

const messagePort = setupMessagePortPrimary()

const eventHandlers = {
  onOpenURL: (callback: (details: OpenURL) => void) => {
    return IPC_EVENTS_RENDERER.openURL.on((_, data) => {
      try {
        callback(data)
      } catch (error) {
        // noop
      }
    })
  },

  onOpenOasis: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openOasis.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onStartScreenshotPicker: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.startScreenshotPicker.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenHistory: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openHistory.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onToggleRightSidebar: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.toggleRightSidebar.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onToggleRightSidebarTab: (callback: (tab: RightSidebarTab) => void) => {
    return IPC_EVENTS_RENDERER.toggleRightSidebarTab.on((_, tab) => {
      try {
        callback(tab)
      } catch (error) {
        // noop
      }
    })
  },

  onOpenCheatSheet: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openCheatSheet.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenChangelog: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openChangelog.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenInvitePage: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openInvitePage.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenDevtools: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openDevTools.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenFeedbackPage: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openFeedbackPage.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenShortcutsPage: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openShortcutsPage.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenWelcomePage: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openWelcomePage.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onOpenImporter: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openImporter.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onBrowserFocusChange: (callback: (state: 'focused' | 'unfocused') => void) => {
    return IPC_EVENTS_RENDERER.browserFocusChange.on((_, { state }) => {
      try {
        callback(state)
      } catch (error) {
        // noop
      }
    })
  },

  onAdBlockerStateChange: (callback: (partition: string, state: boolean) => void) => {
    return IPC_EVENTS_RENDERER.adBlockerStateChange.on((_, { partition, state }) => {
      try {
        callback(partition, state)
      } catch (error) {
        // noop
      }
    })
  },

  onRequestDownloadPath: (
    callback: (data: DownloadRequestMessage) => Promise<DownloadPathResponseMessage>
  ) => {
    return IPC_EVENTS_RENDERER.downloadRequest.on(async (_, data) => {
      const res = await callback(data)
      // TODO: refactor this to use the new event system
      ipcRenderer.send(`download-path-response-${data.id}`, res)
    })
  },

  onDownloadUpdated: (callback: (data: DownloadUpdatedMessage) => void) => {
    return IPC_EVENTS_RENDERER.downloadUpdated.on((_, data) => {
      callback(data)
    })
  },

  onDownloadDone: (callback: (data: DownloadDoneMessage) => void) => {
    return IPC_EVENTS_RENDERER.downloadDone.on((_, data) => {
      callback(data)
    })
  },

  onUserConfigSettingsChange: (callback: (settings: UserSettings) => void) => {
    return IPC_EVENTS_RENDERER.userConfigSettingsChange.on((_, settings) => {
      try {
        userConfig.settings = settings
        callback(settings)
      } catch (error) {
        // noop
      }
    })
  },

  onGetPrompts: (callback: () => Promise<EditablePrompt[]>) => {
    return IPC_EVENTS_RENDERER.requestPrompts.on(async (_event) => {
      try {
        const prompts = await callback()

        IPC_EVENTS_RENDERER.setPrompts.send(prompts)
      } catch (error) {
        // noop
      }
    })
  },

  onUpdatePrompt: (callback: (id: string, content: string) => void) => {
    return IPC_EVENTS_RENDERER.updatePrompt.on((_, { id, content }) => {
      try {
        callback(id, content)
      } catch (error) {
        // noop
      }
    })
  },

  onResetPrompt: (callback: (id: string) => void) => {
    return IPC_EVENTS_RENDERER.resetPrompt.on((_, id) => {
      try {
        callback(id)
      } catch (error) {
        // noop
      }
    })
  },

  // Used by the Settings page
  onSetPrompts: (callback: (prompts: EditablePrompt[]) => void) => {
    return IPC_EVENTS_RENDERER.setPrompts.on((_, prompts) => {
      try {
        callback(prompts)
      } catch (error) {
        // noop
      }
    })
  },

  onToggleSidebar: (callback: (visible?: boolean) => void) => {
    return IPC_EVENTS_RENDERER.toggleSidebar.on((_, visible) => {
      try {
        callback(visible)
      } catch (error) {
        // noop
      }
    })
  },

  onToggleTabsPosition: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.toggleTabsPosition.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onToggleTheme: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.toggleTheme.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onCopyActiveTabURL: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.copyActiveTabUrl.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onCreateNewTab: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.createNewTab.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onCloseActiveTab: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.closeActiveTab.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onReloadActiveTab: (callback: (force: boolean) => void) => {
    return IPC_EVENTS_RENDERER.reloadActiveTab.on((_, force) => {
      try {
        callback(force)
      } catch (error) {
        // noop
      }
    })
  },

  onTrackpadScrollStart: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.trackpadScrollStart.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onTrackpadScrollStop: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.trackpadScrollStop.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onNewWindowRequest: (callback: (details: NewWindowRequest) => void) => {
    return IPC_EVENTS_RENDERER.newWindowRequest.on((_, details) => {
      try {
        if (!details.webContentsId) {
          callback(details)
          return
        }

        const handler = webviewNewWindowHandlers[details.webContentsId]
        if (handler) {
          handler(details)
        } else {
          console.warn(
            `No new window handler for webContentsId ${details.webContentsId}, using default handler.`
          )
          callback(details)
        }
      } catch (error) {
        // noop
      }
    })
  },

  onResetBackgroundImage: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.resetBackgroundImage.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
    })
  },

  onImportedFiles: (callback: (files: File[]) => void) => {
    return IPC_EVENTS_RENDERER.importedFiles.on(async (_, filePaths) => {
      try {
        const files = await Promise.all(
          filePaths.map(async (filePath) => {
            const fileBuffer = await fsp.readFile(filePath)
            const fileName = path.basename(filePath)
            const fileType = mime.lookup(fileName.toLowerCase()) || 'application/octet-stream'
            return new File([fileBuffer], fileName, {
              type: fileType
            })
          })
        )

        callback(files)
      } catch (err) {
        console.error('Failed to import files: ', err)
      }
    })
  },

  onImportBrowserHistory: (callback: (type: BrowserType) => void) => {
    return IPC_EVENTS_RENDERER.importBrowserHistory.on(async (_, type) => {
      try {
        callback(type)
      } catch (err) {
        console.error('Failed to import files: ', err)
      }
    })
  },

  onImportBrowserBookmarks: (callback: (type: BrowserType) => void) => {
    return IPC_EVENTS_RENDERER.importBrowserBookmarks.on(async (_, type) => {
      try {
        callback(type)
      } catch (err) {
        console.error('Failed to import files: ', err)
      }
    })
  },

  onSaveLink: (callback: (url: string, spaceId?: string) => void) => {
    return IPC_EVENTS_RENDERER.saveLink.on((_, { url, spaceId }) => {
      try {
        callback(url, spaceId)
      } catch (error) {
        // noop
      }
    })
  },

  onUpdateViewBounds: (callback: (viewId: string, bounds: Electron.Rectangle) => void) => {
    return IPC_EVENTS_RENDERER.updateViewBounds.on((_, { viewId, bounds }) => {
      try {
        callback(viewId, bounds)
      } catch (error) {
        // noop
      }
    })
  },

  onWebContentsViewEvent: (callback: (event: WebContentsViewEvent) => void) => {
    return IPC_EVENTS_RENDERER.webContentsViewEvent.on((_, event) => {
      try {
        callback(event)
      } catch (error) {
        // noop
      }
    })
  },

  webContentsViewManagerAction: <T extends WebContentsViewManagerActionType>(
    type: T,
    ...args: WebContentsViewManagerActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewManagerActionPayloads[T]]
  ) => {
    const action = { type, payload: args[0] } as WebContentsViewManagerAction
    return IPC_EVENTS_RENDERER.webContentsViewManagerAction.invoke(action) as Promise<
      WebContentsViewManagerActionOutputs[T]
    >
  },

  onMessagePort: (callback: MessagePortCallbackPrimary) => {
    messagePort.onMessage(callback)
  }
}

const api = {
  disableTabSwitchingShortcuts: DISABLE_TAB_SWITCHING_SHORTCUTS,
  SettingsWindowEntrypoint: SettingsWindowEntrypoint,
  PDFViewerEntryPoint: PDFViewerEntryPoint,

  postMessageToView(portId: string, message: any) {
    messagePort.postMessage(portId, message)
  },

  createToken: (data: any) => {
    return IPC_EVENTS_RENDERER.tokenCreate.invoke(data)
  },

  screenshotPage: (rect: { x: number; y: number; width: number; height: number }) => {
    return IPC_EVENTS_RENDERER.screenshotPage.invoke(rect)
  },

  captureWebContents: () => {
    return IPC_EVENTS_RENDERER.captureWebContents.invoke()
  },

  showOpenDialog: async (options: ShowOpenDialog['payload']) => {
    try {
      const filePaths = await IPC_EVENTS_RENDERER.showOpenDialog.invoke(options)
      if (!filePaths) return null

      const files = await Promise.all(
        filePaths.map(async (filePath) => {
          const fileBuffer = await fsp.readFile(filePath)
          const fileName = path.basename(filePath)
          const fileType = mime.lookup(fileName.toLowerCase()) || 'application/octet-stream'
          return new File([fileBuffer as BlobPart], fileName, {
            type: fileType
          })
        })
      )

      return files
    } catch (err) {
      console.error('Failed to import files: ', err)
    }
    return IPC_EVENTS_RENDERER.showOpenDialog.invoke(options)
  },

  getAdblockerState: (partition: string) => {
    return IPC_EVENTS_RENDERER.getAdblockerState.invoke(partition)
  },

  setAdblockerState: (partition: string, state: boolean) => {
    IPC_EVENTS_RENDERER.setAdblockerState.send({ partition, state })
  },

  restartApp: () => {
    IPC_EVENTS_RENDERER.restartApp.send()
  },

  updateTrafficLightsVisibility: (visible: boolean) => {
    IPC_EVENTS_RENDERER.updateTrafficLights.send(visible)
  },

  controlWindow: (action: ControlWindow) => {
    IPC_EVENTS_RENDERER.controlWindow.send(action)
  },

  openSettings: (tab?: SettingsWindowTab) => {
    IPC_EVENTS_RENDERER.openSettings.send(tab)
  },

  registerNewWindowHandler: (
    webContentsId: number,
    callback: (details: NewWindowRequest) => void
  ) => {
    webviewNewWindowHandlers[webContentsId] = callback
  },

  unregisterNewWindowHandler: (webContentsId: number) => {
    if (webviewNewWindowHandlers[webContentsId]) {
      delete webviewNewWindowHandlers[webContentsId]
    }
  },

  fetchAsDataURL: async (url: string) => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const type = response.headers.get('Content-Type')
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:${type};base64,${base64}`
      return dataUrl
    } catch (error) {
      throw error
    }
  },

  fetchRemoteBlob: (url: string) => {
    return fetch(url)
      .then(async (res) => {
        return [res.headers.get('Content-Type'), await res.arrayBuffer()]
      })
      .then(([type, buffer]) => {
        if (!type || typeof type !== 'string') {
          type = 'application/octet-stream'
        }
        if (!buffer) {
          throw new Error('Failed to fetch remote blob: no data received')
        }

        return new Blob([buffer], {
          type
        })
      })
  },

  openResourceLocally: (resourceId: string) => {
    IPC_EVENTS_RENDERER.openResourceLocally.send(resourceId)
  },

  exportResource: (resourceId: string) => {
    IPC_EVENTS_RENDERER.exportResource.send(resourceId)
  },

  fetchHTMLFromRemoteURL: async (url: string, opts?: RequestInit) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
          'Content-Type': 'text/html',
          ...(opts?.headers ?? {})
        },
        ...opts
      })
      const html = await response.text()

      return html
    } catch (error) {
      throw error
    }
  },

  fetchJSON: async (input: string | URL | Request, init?: RequestInit | undefined) => {
    try {
      const response = await fetch(input, init)
      return response.json()
    } catch (error) {
      throw error
    }
  },

  appIsReady: () => {
    IPC_EVENTS_RENDERER.appReady.send()
  },

  getUserConfig: () => userConfig,

  startDrag: (resourceId: string, filePath: string, fileType: string) => {
    IPC_EVENTS_RENDERER.startDrag.send({ resourceId, filePath, fileType })
  },

  getUserConfigSettings: () => userConfig.settings,

  updateUserConfigSettings: async (settings: Partial<UserSettings>) => {
    IPC_EVENTS_RENDERER.updateUserConfigSettings.send(settings)
  },

  openURL: (url: string, active: boolean, scopeId?: string) => {
    IPC_EVENTS_RENDERER.openURL.send({ url, active, scopeId })
  },

  openInvitePage: () => {
    IPC_EVENTS_RENDERER.openInvitePage.send()
  },

  updateInitializedTabs: async (value: boolean) => {
    IPC_EVENTS_RENDERER.updateInitializedTabs.send(value)
  },

  getAppInfo: () => {
    return IPC_EVENTS_RENDERER.getAppInfo.invoke()
  },

  interceptRequestsHeaders: (_urls: string[], _partition: string) => {
    // return IPC_EVENTS_RENDERER.interceptRequestHeaders.invoke({ urls, partition })
    return new Promise((_, reject) => reject())
  },

  useAsDefaultBrowser: () => {
    IPC_EVENTS_RENDERER.useAsDefaultBrowser.send()
  },

  isDefaultBrowser: () => {
    return IPC_EVENTS_RENDERER.isDefaultBrowser.invoke()
  },

  // Used by the Settings page
  getPrompts: () => {
    IPC_EVENTS_RENDERER.requestPrompts.send()
  },

  // Used by the Settings page
  updatePrompt: (id: string, content: string) => {
    IPC_EVENTS_RENDERER.updatePrompt.send({ id, content })
  },

  // Used by the Settings page
  resetPrompt: (id: string) => {
    IPC_EVENTS_RENDERER.resetPrompt.send(id)
  },

  copyToClipboard: (content: any) => {
    try {
      clipboard.writeText(content)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  },

  showAppMenuPopup: () => {
    IPC_EVENTS_RENDERER.showAppMenuPopup.send()
  },

  resetBackgroundImage: async () => {
    IPC_EVENTS_RENDERER.resetBackgroundImage.send()
  },

  setActiveTab: (webContentsId: number) => {
    IPC_EVENTS_RENDERER.setActiveTabWebContentsId.send(webContentsId)
  },

  closeTab: (webContentsId: number) => {
    IPC_EVENTS_RENDERER.closeTabWebContentsId.send(webContentsId)
  },

  updateSpacesList: async (data: SpaceBasicData[]) => {
    IPC_EVENTS_RENDERER.updateSpacesList.send(data)
  },

  focusMainRenderer: () => {
    IPC_EVENTS_RENDERER.focusMainRenderer.send()
  },

  webContentsViewManagerAction: <T extends WebContentsViewManagerActionType>(
    type: T,
    ...args: WebContentsViewManagerActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewManagerActionPayloads[T]]
  ) => {
    const action = { type, payload: args[0] } as WebContentsViewManagerAction
    return IPC_EVENTS_RENDERER.webContentsViewManagerAction.invoke(action) as Promise<
      WebContentsViewManagerActionOutputs[T]
    >
  },

  webContentsViewAction: <T extends WebContentsViewActionType>(
    viewId: string,
    type: T,
    ...args: WebContentsViewActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewActionPayloads[T]]
  ) => {
    const action = { type, payload: args[0] } as WebContentsViewAction
    return IPC_EVENTS_RENDERER.webContentsViewAction.invoke({ viewId, action } as any) as Promise<
      WebContentsViewActionOutputs[T]
    >
  },

  ...eventHandlers
}

const { sffs, resources } = initBackend()

IPC_EVENTS_RENDERER.setSurfBackendHealth.on((_, state) => {
  // @ts-ignore
  sffs.js__backend_set_surf_backend_health(state)
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('RENDERER_TYPE', RendererType.Main)
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('preloadEvents', eventHandlers)
    contextBridge.exposeInMainWorld('backend', {
      sffs,
      resources
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.RENDERER_TYPE = RendererType.Main
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.backend = { sffs, resources }
  // @ts-ignore (define in dts)
  window.preloadEvents = eventHandlers
}

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
