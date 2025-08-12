import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { injectBrowserAction } from 'electron-chrome-extensions/dist/browser-action'

import path from 'path'
import http from 'http'
import mime from 'mime-types'
import fetch from 'cross-fetch'

import EventEmitter from 'events'
import * as crypto from 'crypto'
import {
  promises as fsp,
  createReadStream,
  createWriteStream,
  ReadStream,
  WriteStream,
  mkdirSync
} from 'fs'
import { AppActivationResponse, createAPI, createAuthenticatedAPI } from '@deta/api'
import {
  type EditablePrompt,
  type UserSettings,
  type RightSidebarTab,
  type DownloadRequestMessage,
  type DownloadUpdatedMessage,
  type DownloadDoneMessage,
  type TelemetryEventTypes,
  type SFFSResource,
  type DownloadPathResponseMessage,
  SettingsWindowTab,
  UserStats,
  BrowserType,
  WebContentsViewAction,
  WebContentsViewEvent,
  WebContentsViewManagerActionType,
  WebContentsViewManagerActionPayloads,
  WebContentsViewActionPayloads,
  WebContentsViewActionType,
  WebContentsViewManagerAction,
  WebContentsViewManagerActionOutputs,
  WebContentsViewActionOutputs
} from '@deta/types'

import { getUserConfig, getUserStats } from '../main/config'
import {
  IPC_EVENTS_RENDERER,
  NewWindowRequest,
  OpenURL,
  SpaceBasicData
} from '@deta/services/src/ipc'
import { ControlWindow } from '@horizon/core/src/lib/types'

enum ResourceProcessingStateType {
  Pending = 'pending',
  Started = 'started',
  Failed = 'failed',
  Finished = 'finished'
}

enum EventBusMessageType {
  ResourceProcessingMessage = 'ResourceProcessingMessage'
}

type ResourceProcessingState =
  | { type: ResourceProcessingStateType.Pending }
  | { type: ResourceProcessingStateType.Started }
  | { type: ResourceProcessingStateType.Failed; message: string }
  | { type: ResourceProcessingStateType.Finished }

type EventBusMessage = {
  type: EventBusMessageType.ResourceProcessingMessage
  resource_id: string
  status: ResourceProcessingState
}

const APP_PATH = process.argv.find((arg) => arg.startsWith('--appPath='))?.split('=')[1] ?? ''
const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''

const ENABLE_DEBUG_PROXY = process.argv.includes('--enable-debug-proxy')
const DISABLE_TAB_SWITCHING_SHORTCUTS = process.argv.includes('--disable-tab-switching-shortcuts')

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')
let userStats = getUserStats(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')
const LANGUAGE_SETTING = userConfig.settings?.embedding_model.includes('multi') ? 'multi' : 'en'

const API_BASE = import.meta.env.P_VITE_API_BASE ?? 'https://deta.space/api'
const API_KEY = import.meta.env.P_VITE_API_KEY ?? userConfig.api_key

const PDFViewerEntryPoint =
  process.argv.find((arg) => arg.startsWith('--pdf-viewer-entry-point='))?.split('=')[1] || ''
const SettingsWindowEntrypoint =
  process.argv.find((arg) => arg.startsWith('--settings-window-entry-point='))?.split('=')[1] || ''

mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

const webviewNewWindowHandlers: Record<number, (details: NewWindowRequest) => void> = {}

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

  onTrackEvent: (
    callback: (name: TelemetryEventTypes, properties: Record<string, any>) => void
  ) => {
    return IPC_EVENTS_RENDERER.trackEvent.on((_, { name, properties }) => {
      try {
        callback(name, properties)
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

  onUserStatsChange: (callback: (stats: UserStats) => void) => {
    return IPC_EVENTS_RENDERER.userStatsChange.on((_, stats) => {
      try {
        userStats = stats
        callback(stats)
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

  onWebContentsViewEvent: (callback: (event: WebContentsViewEvent) => void) => {
    return IPC_EVENTS_RENDERER.webContentsViewEvent.on((_, event) => {
      try {
        callback(event)
      } catch (error) {
        // noop
      }
    })
  }
}

const api = {
  disableTabSwitchingShortcuts: DISABLE_TAB_SWITCHING_SHORTCUTS,
  SettingsWindowEntrypoint: SettingsWindowEntrypoint,
  PDFViewerEntryPoint: PDFViewerEntryPoint,

  createToken: (data: any) => {
    return IPC_EVENTS_RENDERER.tokenCreate.invoke(data)
  },

  screenshotPage: (rect: { x: number; y: number; width: number; height: number }) => {
    return IPC_EVENTS_RENDERER.screenshotPage.invoke(rect)
  },

  captureWebContents: () => {
    return IPC_EVENTS_RENDERER.captureWebContents.invoke()
  },

  setExtensionMode: (mode: 'horizontal' | 'vertical') => {
    IPC_EVENTS_RENDERER.setExtensionMode.send(mode)
  },

  getExtensionMode: () => {
    return IPC_EVENTS_RENDERER.getExtensionMode.invoke()
  },

  listExtensions: () => {
    return IPC_EVENTS_RENDERER.listExtensions.invoke()
  },

  removeExtension: (extensionId: string) => {
    return IPC_EVENTS_RENDERER.removeExtension.send(extensionId)
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
        return new Blob([buffer], {
          type
        })
      })
  },

  openResourceLocally: (resource: SFFSResource) => {
    IPC_EVENTS_RENDERER.openResourceLocally.send(resource)
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

  getUserConfig: () => {
    return IPC_EVENTS_RENDERER.getUserConfig.invoke()
  },

  getUserStats: () => {
    return IPC_EVENTS_RENDERER.getUserStats.invoke()
  },

  deanonymizeUser: async () => {
    const api = createAuthenticatedAPI(API_BASE, API_KEY)

    // Figure out what id to use:
    let userId = userConfig.anon_id ?? userConfig.user_id
    if (userId === undefined) {
      console.error('Could not get valid user id... something is misconfigured!')
      return
    }

    await api.setUserTelemetryId(userId)
  },

  startDrag: (resourceId: string, filePath: string, fileType: string) => {
    IPC_EVENTS_RENDERER.startDrag.send({ resourceId, filePath, fileType })
  },

  activateAppUsingKey: async (key: string, acceptedTerms: boolean) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)

    const res = await api.activateAppUsingKey(key, acceptedTerms)
    if (res.ok && (res.data as AppActivationResponse)) {
      IPC_EVENTS_RENDERER.updateUserConfig.send({ api_key: res.data.api_key })
    }
    return res
  },

  resendInviteCode: async (email: string) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)
    return await api.resendInviteCode(email)
  },

  getUserConfigSettings: () => userConfig.settings,

  updateUserConfigSettings: async (settings: Partial<UserSettings>) => {
    IPC_EVENTS_RENDERER.updateUserConfigSettings.send(settings)
  },

  updateUserStats: async (stats: Partial<UserStats>) => {
    IPC_EVENTS_RENDERER.updateUserStats.send(stats)
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

  checkForUpdates: () => {
    IPC_EVENTS_RENDERER.checkForUpdates.send()
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

export class ResourceHandle {
  private fd: fsp.FileHandle
  private filePath: string
  private resourceId: string
  private writeHappened = false
  private currentHash: string

  private constructor(
    fd: fsp.FileHandle,
    filePath: string,
    resourceId: string,
    initialHash: string
  ) {
    this.fd = fd
    this.filePath = filePath
    this.resourceId = resourceId
    this.currentHash = initialHash
  }

  static async open(
    rootPath: string,
    resourceId: string,
    flags: string = 'a+'
  ): Promise<ResourceHandle> {
    const resolvedRootPath = path.resolve(rootPath)
    const resolvedFilePath = path.resolve(resolvedRootPath, resourceId)

    if (!resolvedFilePath.startsWith(resolvedRootPath)) {
      throw new Error('Invalid resource ID')
    }

    const fd = await fsp.open(resolvedFilePath, flags)
    const initialHash = JSON.parse(await (sffs as any).js__store_get_resource_hash(resourceId))
    return new ResourceHandle(fd, resolvedFilePath, resourceId, initialHash)
  }

  async readAll(): Promise<Uint8Array> {
    const stats = await this.fd.stat()
    const buffer = Buffer.alloc(stats.size)
    await this.fd.read(buffer, 0, stats.size, 0)
    return buffer
  }

  createReadStream(
    options: {
      flags?: string
      encoding?: BufferEncoding
      mode?: number
      autoClose?: boolean
      emitClose?: boolean
      start?: number
      end?: number
      highWaterMark?: number
    } = {}
  ): ReadStream {
    return createReadStream(this.filePath, {
      ...options,
      fd: this.fd.fd,
      autoClose: false
    })
  }

  async write(data: string | Buffer | ArrayBuffer): Promise<void> {
    let bufferData: Buffer
    if (typeof data === 'string') {
      bufferData = Buffer.from(data, 'utf-8')
    } else if (data instanceof ArrayBuffer) {
      bufferData = Buffer.from(data)
    } else if (Buffer.isBuffer(data)) {
      bufferData = data
    } else {
      throw new Error('invalid data type, only strings, Buffers, and array buffers are supported')
    }
    await this.fd.write(bufferData)
    this.writeHappened = true
  }

  createWriteStream(
    options: {
      flags?: string
      encoding?: BufferEncoding
      mode?: number
      autoClose?: boolean
      emitClose?: boolean
      start?: number
      highWaterMark?: number
    } = {}
  ): WriteStream {
    return createWriteStream(this.filePath, {
      ...options,
      fd: this.fd.fd,
      autoClose: false
    })
  }

  async computeResourceHash(algorithm = 'sha256'): Promise<string> {
    const hash = crypto.createHash(algorithm)
    return new Promise((resolve, reject) => {
      const stream = createReadStream(this.filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', (err) => reject(err))
    })
  }

  async onWriteHappened(): Promise<void> {
    if (this.writeHappened) {
      const newHash = await this.computeResourceHash()
      if (this.currentHash !== newHash) {
        await (sffs as any).js__store_upsert_resource_hash(this.resourceId, newHash)
        await (sffs as any).js__store_resource_post_process(this.resourceId)
      }
      this.currentHash = newHash
    }
    this.writeHappened = false
  }

  async flush(): Promise<void> {
    await this.fd.sync()
    await this.onWriteHappened()
  }

  async close(): Promise<void> {
    await this.fd.close()
    await this.onWriteHappened()
  }
}

const sffs = (() => {
  const sffs = require('@deta/backend')

  let handle = null
  let server: http.Server | null = null
  const callbackEmitters = new Map()

  const isResourceProcessingMessage = (obj: any): boolean => {
    if (
      !obj ||
      typeof obj.resource_id !== 'string' ||
      !obj.status ||
      typeof obj.status.type !== 'string'
    ) {
      return false
    }

    switch (obj.status.type) {
      case ResourceProcessingStateType.Pending:
      case ResourceProcessingStateType.Started:
      case ResourceProcessingStateType.Finished:
        return true
      case ResourceProcessingStateType.Failed:
        return typeof obj.status.message === 'string'
    }

    return false
  }

  const parseEventBusMessage = (event: string): EventBusMessage => {
    const obj = JSON.parse(event)

    if (!obj || typeof obj !== 'object' || typeof obj.type !== 'string') {
      throw new Error(`invalid event bus message: ${obj}`)
    }

    switch (obj.type) {
      case EventBusMessageType.ResourceProcessingMessage:
        if (isResourceProcessingMessage(obj)) return obj as EventBusMessage
        throw new Error(`event bus message doesn't match type ${obj.type}`)
    }

    throw new Error(`invalid event bus message type: ${obj.type}`)
  }

  const { js__backend_event_bus_register, js__backend_event_bus_callback } = (() => {
    const handlers = new Set<(event: EventBusMessage) => void>()
    const js__backend_event_bus_register = (
      handler: (event: EventBusMessage) => void
    ): (() => void) => {
      handlers.add(handler)
      return () => handlers.delete(handler)
    }
    const js__backend_event_bus_callback = (event: string) => {
      let message: EventBusMessage
      try {
        message = parseEventBusMessage(event)
      } catch (error) {
        console.error('failed to parse event bus message', error, event)
        return
      }
      handlers.forEach((handler) => handler(message))
    }

    return { js__backend_event_bus_register, js__backend_event_bus_callback }
  })()

  const init = (
    root_path: string,
    api_base: string,
    api_key: string,
    local_ai_mode: boolean = false,
    language_setting: string
  ) => {
    handle = sffs.js__backend_tunnel_init(
      root_path,
      APP_PATH,
      api_base,
      api_key,
      local_ai_mode,
      language_setting,
      js__backend_event_bus_callback
    )

    if (ENABLE_DEBUG_PROXY) {
      setupDebugServer()
    }

    return {
      ...Object.fromEntries(
        Object.entries(sffs)
          .filter(
            ([key, value]) =>
              typeof value === 'function' &&
              key.startsWith('js__') &&
              key !== 'js__backend_tunnel_init'
          )
          .map(([key, value]) => [
            key,
            ENABLE_DEBUG_PROXY ? createProxyFunction(key) : with_handle(value)
          ])
      ),
      js__backend_event_bus_register
    }
  }

  const with_handle =
    (fn: any) =>
    (...args: any) =>
      fn(handle, ...args)

  const setupDebugServer = () => {
    server = http.createServer((req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const [_, fn, action, callId] = req.url.split('/')

      if (req.method === 'GET' && action === 'stream') {
        handleSSE(res, callId)
      } else if (req.method === 'POST') {
        handlePostRequest(req, res, fn)
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server?.listen(0, 'localhost', () => {
      console.log(`Debug server running on port ${(server?.address() as any).port}`)
    })
  }

  const handleSSE = (res: any, callId: string) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })

    const emitter = new EventEmitter()
    callbackEmitters.set(callId, emitter)

    emitter.on('data', (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    })

    res.on('close', () => {
      callbackEmitters.delete(callId)
    })
  }

  const handlePostRequest = (req: any, res: any, fn: string) => {
    let body = ''
    req.on('data', (chunk: any) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      const { args, callId } = JSON.parse(body)
      try {
        if (fn === 'js__ai_send_chat_message') {
          args[2] = createProxyCallback(callId)
        }
        const result = await sffs[fn](handle, ...args)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error }))
      }
    })
  }

  const createProxyCallback = (callId: string) => {
    return (data: any) => {
      let emitter = callbackEmitters.get(callId)
      if (emitter) emitter.emit('data', data)
    }
  }

  const createProxyFunction = (key: string) => {
    return async (...args: any[]) => {
      const isChat = key === 'js__ai_send_chat_message'
      const callId = isChat ? Math.random().toString(36).slice(2, 11) : undefined

      if (isChat) {
        setupSSE(key, callId!, args[2])
      }

      const fetch = window.fetch.bind(window)
      const response = await fetch(`http://localhost:${(server?.address() as any).port}/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args, callId })
      })

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`)
      }

      return response.json()
    }
  }

  const setupSSE = (key: string, callId: string, originalCallback: Function) => {
    const eventSource = new EventSource(
      `http://localhost:${(server?.address() as any).port}/${key}/stream/${callId}`
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      originalCallback(data)
    }

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error)
      eventSource.close()
    }
  }

  return init(BACKEND_ROOT_PATH, API_BASE || '', API_KEY || '', false, LANGUAGE_SETTING)
})()

const resources = (() => {
  const resourceHandles = new Map<string, ResourceHandle>()

  async function openResource(resourceId: string, flags: string) {
    const resourceHandle = await ResourceHandle.open(BACKEND_RESOURCES_PATH, resourceId, flags)
    resourceHandles.set(resourceId, resourceHandle)

    return resourceId
  }

  async function readResource(resourceId: string) {
    const resourceHandle = resourceHandles.get(resourceId)
    if (!resourceHandle) throw new Error('resource handle is not open')

    return await resourceHandle.readAll()
  }

  async function writeResource(resourceId: string, data: string | ArrayBuffer) {
    const resourceHandle = resourceHandles.get(resourceId)
    if (!resourceHandle) throw new Error('resource handle is not open')

    await resourceHandle.write(data)
  }

  async function flushResource(resourceId: string) {
    const resourceHandle = resourceHandles.get(resourceId)
    if (!resourceHandle) throw new Error('resource handle is not open')

    await resourceHandle.flush()
  }

  async function closeResource(resourceId: string) {
    const resourceHandle = resourceHandles.get(resourceId)
    if (!resourceHandle) throw new Error('resource handle is not open')

    await resourceHandle.close()
    resourceHandles.delete(resourceId)
  }

  async function triggerPostProcessing(resourceId: string) {
    await (sffs as any).js__store_resource_post_process(resourceId)
  }

  async function updateResourceHash(resourceId: string) {
    let resourceHandle = resourceHandles.get(resourceId)
    let needsClose = false

    if (!resourceHandle) {
      await openResource(resourceId, 'r+')
      resourceHandle = resourceHandles.get(resourceId)
      needsClose = true
    }

    const newHash = await resourceHandle?.computeResourceHash()
    await (sffs as any).js__store_upsert_resource_hash(resourceId, newHash)

    if (needsClose) await closeResource(resourceId)
  }

  return {
    openResource,
    readResource,
    writeResource,
    flushResource,
    closeResource,
    updateResourceHash,
    triggerPostProcessing
  }
})()

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

injectBrowserAction()

export type API = typeof api
export type PreloadEventHandlers = typeof eventHandlers
