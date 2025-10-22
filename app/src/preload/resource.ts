import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  type UserSettings,
  WebContentsViewAction,
  WebContentsViewManagerActionType,
  WebContentsViewManagerActionPayloads,
  WebContentsViewActionPayloads,
  WebContentsViewActionType,
  WebContentsViewManagerAction,
  WebContentsViewManagerActionOutputs,
  WebContentsViewActionOutputs,
  type WebViewSendEvents,
  WebViewEventSendNames,
  WebContentsViewEvent,
  RendererType,
  type SettingsWindowTab
} from '@deta/types'
import {
  IPC_EVENTS_RENDERER,
  setupMessagePortClient,
  type ShowOpenDialog
} from '@deta/services/ipc'
import type { MessagePortCallbackClient } from '@deta/services/messagePort'

import { getUserConfig } from '../main/config'
import { initBackend } from './helpers/backend'
import { ipcRenderer } from 'electron'

import path from 'path'
import mime from 'mime-types'
import { promises as fsp } from 'fs'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''
const SettingsWindowEntrypoint =
  process.argv.find((arg) => arg.startsWith('--settings-window-entry-point='))?.split('=')[1] || ''

const messagePort = setupMessagePortClient()

const eventHandlers = {
  onOpenDevtools: (callback: () => void) => {
    return IPC_EVENTS_RENDERER.openDevTools.on((_) => {
      try {
        callback()
      } catch (error) {
        // noop
      }
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

  onWebContentsViewEvent: (callback: (event: WebContentsViewEvent) => void) => {
    return IPC_EVENTS_RENDERER.webContentsViewEvent.on((_, event) => {
      try {
        callback(event)
      } catch (error) {
        // noop
      }
    })
  },

  onToggleNotebookSidebar: (callback: (data: { open: boolean }) => void) => {
    return IPC_EVENTS_RENDERER.toggleNotebookSidebar.on((_, data) => {
      try {
        callback(data)
      } catch (error) {
        // noop
      }
    })
  },

  onMessagePort: (callback: MessagePortCallbackClient) => {
    messagePort.onMessage(callback)
  }
}

const api = {
  SettingsWindowEntrypoint: SettingsWindowEntrypoint,
  PDFViewerEntryPoint: PDFViewerEntryPoint,

  postMessageToView(payload: any) {
    messagePort.postMessage(payload)
  },

  getUserConfig: () => userConfig,

  restartApp: () => {
    IPC_EVENTS_RENDERER.restartApp.send()
  },

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

  openSettings: (tab?: SettingsWindowTab) => {
    IPC_EVENTS_RENDERER.openSettings.send(tab)
  },

  openResourceLocally: (resourceId: string) => {
    IPC_EVENTS_RENDERER.openResourceLocally.send(resourceId)
  },

  exportResource: (resourceId: string) => {
    IPC_EVENTS_RENDERER.exportResource.send(resourceId)
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

const { sffs, resources } = initBackend({ num_worker_threads: 4, num_processor_threads: 4 })

IPC_EVENTS_RENDERER.setSurfBackendHealth.on((_, state) => {
  // @ts-ignore
  sffs.js__backend_set_surf_backend_health(state)
})

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('RENDERER_TYPE', RendererType.WebContentsView)
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
  window.RENDERER_TYPE = RendererType.WebContentsView
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

function sendPageEvent<T extends keyof WebViewSendEvents>(
  name: T,
  data?: WebViewSendEvents[T]
): void {
  console.debug('Sending page event', name, data)
  ipcRenderer.send('webview-page-event', name, data)
  ipcRenderer.sendToHost('webview-page-event', name, data)
}

window.addEventListener('DOMContentLoaded', async (_) => {
  window.addEventListener('keyup', (event: KeyboardEvent) => {
    // Ignore synthetic events that are not user generated
    if (!event.isTrusted) return
    sendPageEvent(WebViewEventSendNames.KeyUp, { key: event.key })
  })

  window.addEventListener('keydown', async (event: KeyboardEvent) => {
    // Ignore synthetic events that are not user generated
    if (!event.isTrusted) return

    sendPageEvent(WebViewEventSendNames.KeyDown, {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    })
  })
})

window.addEventListener('click', (event: MouseEvent) => {
  sendPageEvent(WebViewEventSendNames.MouseClick, {
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY
  })
})
