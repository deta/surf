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
  WebContentsViewContextManagerAction,
  WebContentsViewContextManagerActionOutputs,
  WebContentsViewContextManagerActionPayloads,
  WebContentsViewContextManagerActionType,
  type WebViewSendEvents,
  WebViewEventSendNames,
  type CitationClickEvent
} from '@deta/types'
import { IPC_EVENTS_RENDERER } from '@deta/services/ipc'

import { getUserConfig } from '../main/config'
import { initBackend } from './helpers/backend'
import { ipcRenderer } from 'electron/renderer'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''
const SettingsWindowEntrypoint =
  process.argv.find((arg) => arg.startsWith('--settings-window-entry-point='))?.split('=')[1] || ''

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
  }
}

const api = {
  SettingsWindowEntrypoint: SettingsWindowEntrypoint,
  PDFViewerEntryPoint: PDFViewerEntryPoint,

  restartApp: () => {
    IPC_EVENTS_RENDERER.restartApp.send()
  },

  getUserConfig: () => {
    return IPC_EVENTS_RENDERER.getUserConfig.invoke()
  },

  getUserStats: () => {
    return IPC_EVENTS_RENDERER.getUserStats.invoke()
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

  citationClick: (data: CitationClickEvent) => {
    IPC_EVENTS_RENDERER.citationClick.send(data)
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

  webContentsViewContextManagerAction: <T extends WebContentsViewContextManagerActionType>(
    type: T,
    ...args: WebContentsViewContextManagerActionPayloads[T] extends undefined
      ? []
      : [payload: WebContentsViewContextManagerActionPayloads[T]]
  ) => {
    const action = { type, payload: args[0] } as WebContentsViewContextManagerAction
    return IPC_EVENTS_RENDERER.webContentsViewContextManagerAction.invoke(action) as Promise<
      WebContentsViewContextManagerActionOutputs[T]
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
