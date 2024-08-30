import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  mkdirSync,
  promises as fsp,
  createReadStream,
  createWriteStream,
  ReadStream,
  WriteStream
} from 'fs'
import path from 'path'
import fetch from 'cross-fetch'
import OpenAI, { toFile } from 'openai'
import { minify } from 'html-minifier'
import { createAPI } from '@horizon/api'
import { actionsToRunnableTools } from './actions'
import type {
  HorizonAction,
  EditablePrompt,
  UserSettings,
  RightSidebarTab,
  DownloadRequestMessage,
  DownloadUpdatedMessage,
  DownloadDoneMessage,
  TelemetryEventTypes
} from '@horizon/types'
import { getUserConfig } from '../main/config'
import {
  IPC_EVENTS_RENDERER,
  NewWindowRequest,
  OpenURL
} from '@horizon/core/src/lib/service/ipc/events'
import { ChatCompletion } from 'openai/resources'

const isDev = import.meta.env.DEV

const APP_PATH = process.argv.find((arg) => arg.startsWith('--appPath='))?.split('=')[1] ?? ''
const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const TAB_SWITCHING_SHORTCUTS_DISABLE =
  (process.argv.find((arg) => arg.startsWith('--tabSwitchingShortcutsDisable='))?.split('=')[1] ??
    '') === 'true'

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')
const LANGUAGE_SETTING = userConfig.settings?.embedding_model.includes('multi') ? 'multi' : 'en'

// TODO: do we need to handle the case where api_key is undefined?
const OPENAI_API_ENDPOINT = import.meta.env.P_VITE_OPEN_AI_API_ENDPOINT || ''
const OPENAI_API_KEY = isDev ? import.meta.env.P_VITE_OPEN_AI_API_KEY : userConfig.api_key

const VISION_API_ENDPOINT = import.meta.env.P_VITE_VISION_API_ENDPOINT || ''
const VISION_API_KEY = isDev ? import.meta.env.P_VITE_VISION_API_KEY : userConfig.api_key

mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

const webviewNewWindowHandlers: Record<number, (details: NewWindowRequest) => void> = {}

let openai: OpenAI | null = null
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    baseURL: OPENAI_API_ENDPOINT,
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  })
}

const api = {
  tabSwitchingShortcutsDisable: TAB_SWITCHING_SHORTCUTS_DISABLE,
  webviewDevToolsBtn: !import.meta.env.PROD || !!process.env.WEBVIEW_DEV_TOOLS_BTN,
  webviewPreloadPath: path.join(__dirname, '../preload/webview.js'),

  captureWebContents: () => {
    return IPC_EVENTS_RENDERER.captureWebContents.invoke()
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

  handleGoogleSignIn: async (url: string) => {
    return IPC_EVENTS_RENDERER.googleSignIn.invoke(url)
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

  createAIChatCompletion: async (
    userPrompt: string | string[],
    systemPrompt?: string,
    opts: OpenAI.RequestOptions<unknown> = {}
  ) => {
    if (!openai) {
      return null
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    if (typeof userPrompt === 'string') {
      messages.push({ role: 'user', content: userPrompt })
    } else {
      userPrompt.forEach((prompt) => {
        messages.push({ role: 'user', content: prompt })
      })
    }

    const chatCompletion = (await openai.chat.completions.create({
      messages: messages,
      model: 'gpt-4o',
      ...opts
    })) as unknown as OpenAI.Chat.Completions.ChatCompletion

    return chatCompletion.choices[0].message.content
  },

  createFolderBasedOnPrompt: async (
    userPrompt: string,
    systemPrompt?: string,
    opts: OpenAI.RequestOptions<unknown> = {}
  ) => {
    if (!openai) {
      return null
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: userPrompt })

    const chatCompletion = await openai.chat.completions.create({
      messages: messages,
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      ...opts
    })

    return (chatCompletion as ChatCompletion).choices[0].message.content
  },

  aiFunctionCalls: async (userPrompt: string, actions: HorizonAction[]) => {
    if (!openai) {
      return null
    }
    const runner = openai.beta.chat.completions
      .runTools({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        tools: actionsToRunnableTools(actions)
      })
      .on('message', (message) => {
        console.log(message)
      })

    const finalMessage = await runner.finalContent()
    return finalMessage
  },

  onOpenURL: (callback: (details: OpenURL) => void) => {
    try {
      IPC_EVENTS_RENDERER.openURL.on((_, { url, active }) => callback({ url, active }))
    } catch (error) {
      // noop
    }
  },

  onOpenOasis: (callback) => {
    try {
      IPC_EVENTS_RENDERER.openOasis.on((_) => callback())
    } catch (error) {
      // noop
    }
  },

  toggleRightSidebar: (callback) => {
    try {
      IPC_EVENTS_RENDERER.toggleRightSidebar.on(() => callback())
    } catch (error) {
      // noop
    }
  },

  onToggleRightSidebarTab: (callback: (tab: RightSidebarTab) => void) => {
    try {
      IPC_EVENTS_RENDERER.toggleRightSidebarTab.on((_, tab) => callback(tab))
    } catch (error) {
      // noop
    }
  },

  onOpenCheatSheet: (callback) => {
    try {
      IPC_EVENTS_RENDERER.openCheatSheet.on(() => callback())
    } catch (error) {
      // noop
    }
  },

  onOpenDevtools: (callback) => {
    try {
      IPC_EVENTS_RENDERER.openDevTools.on(() => callback())
    } catch (error) {
      // noop
    }
  },

  onOpenFeedbackPage: (callback) => {
    try {
      IPC_EVENTS_RENDERER.openFeedbackPage.on(() => callback())
    } catch (error) {
      // noop
    }
  },

  onAdBlockerStateChange: (callback) => {
    IPC_EVENTS_RENDERER.adBlockerStateChange.on((_, { partition, state }) => {
      callback(partition, state)
    })
  },

  onTrackEvent: (
    callback: (name: TelemetryEventTypes, properties: Record<string, any>) => void
  ) => {
    try {
      IPC_EVENTS_RENDERER.trackEvent.on((_, { name, properties }) => callback(name, properties))
    } catch (error) {
      // noop
    }
  },

  appIsReady: () => {
    IPC_EVENTS_RENDERER.appReady.send()
  },

  getUserConfig: () => {
    return IPC_EVENTS_RENDERER.getUserConfig.invoke()
  },

  onRequestDownloadPath: (callback: (data: DownloadRequestMessage) => void) => {
    IPC_EVENTS_RENDERER.downloadRequest.on(async (_, data) => {
      const path = await callback(data)
      // TODO: refactor this to use the new event system
      ipcRenderer.send(`download-path-response-${data.id}`, path)
    })
  },

  onDownloadUpdated: (callback: (data: DownloadUpdatedMessage) => void) => {
    IPC_EVENTS_RENDERER.downloadUpdated.on((_, data) => {
      callback(data)
    })
  },

  onDownloadDone: (callback: (data: DownloadDoneMessage) => void) => {
    IPC_EVENTS_RENDERER.downloadDone.on((_, data) => {
      callback(data)
    })
  },

  startDrag: (resourceId: string, filePath: string, fileType: string) => {
    IPC_EVENTS_RENDERER.startDrag.send({ resourceId, filePath, fileType })
  },

  transcribeAudioFile: async (path: string) => {
    const transcription = await openai?.audio.transcriptions.create({
      file: await toFile(createReadStream(path), 'audio.mp3'),
      model: 'whisper-1'
    })

    return transcription?.text
  },

  activateAppUsingKey: async (key: string, acceptedTerms: boolean) => {
    const api = createAPI(import.meta.env.P_VITE_API_BASE)

    const data = await api.activateAppUsingKey(key, acceptedTerms)
    if (data !== null) {
      IPC_EVENTS_RENDERER.storeAPIKey.send(data.api_key)
    }

    return data
  },

  getUserConfigSettings: () => userConfig.settings,

  updateUserConfigSettings: async (settings: Partial<UserSettings>) => {
    IPC_EVENTS_RENDERER.updateUserConfigSettings.send(settings)
  },

  onUserConfigSettingsChange: (callback: (settings: UserSettings) => void) => {
    IPC_EVENTS_RENDERER.userConfigSettingsChange.on((_, settings) => {
      userConfig.settings = settings
      callback(settings)
    })
  },

  updateInitializedTabs: async (value: boolean) => {
    IPC_EVENTS_RENDERER.updateInitializedTabs.send(value)
  },

  getAppInfo: () => {
    return IPC_EVENTS_RENDERER.getAppInfo.invoke()
  },

  interceptRequestsHeaders: async (urls: string[], partition: string) => {
    return IPC_EVENTS_RENDERER.interceptRequestHeaders.invoke({ urls, partition })
  },

  checkForUpdates: () => {
    IPC_EVENTS_RENDERER.checkForUpdates.send()
  },

  onGetPrompts: (callback: () => Promise<EditablePrompt[]>) => {
    IPC_EVENTS_RENDERER.requestPrompts.on(async (_event) => {
      const prompts = await callback()

      IPC_EVENTS_RENDERER.setPrompts.send(prompts)
    })
  },

  onUpdatePrompt: (callback: (id: string, content: string) => void) => {
    IPC_EVENTS_RENDERER.updatePrompt.on((_, { id, content }) => callback(id, content))
  },

  onResetPrompt: (callback: (id: string) => void) => {
    IPC_EVENTS_RENDERER.resetPrompt.on((_event, id) => callback(id))
  },

  // Used by the Settings page
  onSetPrompts: (callback: (prompts: EditablePrompt[]) => void) => {
    IPC_EVENTS_RENDERER.setPrompts.on((_, prompts) => callback(prompts))
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

  minifyHtml: (html: string, options: any) => minify(html, options),

  onToggleSidebar: (callback: (visible?: boolean) => void) => {
    IPC_EVENTS_RENDERER.toggleSidebar.on((_, visible) => callback(visible))
  },

  onToggleTabsPosition: (callback: () => void) => {
    IPC_EVENTS_RENDERER.toggleTabsPosition.on((_) => callback())
  },

  onCopyActiveTabURL: (callback: () => void) => {
    IPC_EVENTS_RENDERER.copyActiveTabUrl.on((_) => callback())
  },

  onCreateNewTab: (callback: () => void) => {
    IPC_EVENTS_RENDERER.createNewTab.on((_) => callback())
  },

  onCloseActiveTab: (callback: () => void) => {
    IPC_EVENTS_RENDERER.closeActiveTab.on((_) => callback())
  },

  onReloadActiveTab: (callback: (force: boolean) => void) => {
    IPC_EVENTS_RENDERER.reloadActiveTab.on((_, force) => callback(force))
  },

  onTrackpadScrollStart: (callback: () => void) => {
    IPC_EVENTS_RENDERER.trackpadScrollStart.on((_) => callback())
  },

  onTrackpadScrollStop: (callback: () => void) => {
    IPC_EVENTS_RENDERER.trackpadScrollStop.on((_) => callback())
  },

  onNewWindowRequest: (callback: (details: NewWindowRequest) => void) => {
    IPC_EVENTS_RENDERER.newWindowRequest.on((_, details) => {
      if (!details.webContentsId) {
        callback(details)
        return
      }

      const handler = webviewNewWindowHandlers[details.webContentsId]
      if (handler) {
        handler(details)
      }
    })
  }
}

export class ResourceHandle {
  private fd: fsp.FileHandle
  private filePath: string
  private resourceId: string
  private writeHappened = false

  private constructor(fd: fsp.FileHandle, filePath: string, resourceId: string) {
    this.fd = fd
    this.filePath = filePath
    this.resourceId = resourceId
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
    return new ResourceHandle(fd, resolvedFilePath, resourceId)
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

  async flush(): Promise<void> {
    await this.fd.sync()
    if (this.writeHappened) {
      await (sffs as any).js__store_resource_post_process(this.resourceId)
    }
    this.writeHappened = false
  }

  async close(): Promise<void> {
    await this.fd.close()
    if (this.writeHappened) {
      await (sffs as any).js__store_resource_post_process(this.resourceId)
    }
    this.writeHappened = false
  }
}

const sffs = (() => {
  const sffs = require('@horizon/backend')
  let handle = null

  const with_handle =
    (fn: any) =>
    (...args: any) =>
      fn(handle, ...args)

  function init(
    root_path: string,
    vision_api_key: string,
    vision_api_endpoint: string,
    openai_api_key: string,
    openai_api_endpoint: string,
    local_ai_mode: boolean = false,
    language_setting: string
  ) {
    let fn = {}
    handle = sffs.js__backend_tunnel_init(
      root_path,
      APP_PATH,
      vision_api_key,
      vision_api_endpoint,
      openai_api_key,
      openai_api_endpoint,
      local_ai_mode,
      language_setting
    )

    Object.keys(sffs).forEach((key) => {
      if (
        typeof sffs[key] === 'function' &&
        key.startsWith('js__') &&
        key !== 'js__backend_tunnel_init'
      ) {
        fn[key] = with_handle(sffs[key])
      }
    })

    return fn
  }

  // TODO: add support for changing the local ai mode
  return init(
    BACKEND_ROOT_PATH,
    VISION_API_KEY || '',
    VISION_API_ENDPOINT,
    OPENAI_API_KEY || '',
    OPENAI_API_ENDPOINT,
    false,
    LANGUAGE_SETTING
  )
})()

const resources = (() => {
  const resourceHandles = new Map<string, ResourceHandle>()

  function getDBPath() {
    return `${BACKEND_ROOT_PATH}/sffs.sqlite`
  }

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

  return { openResource, readResource, writeResource, flushResource, closeResource, getDBPath }
})()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
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
  window.backend = backend
}

export type API = typeof api
