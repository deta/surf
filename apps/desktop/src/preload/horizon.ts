import { useLogScope } from '@horizon/core/src/lib/utils/log'
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
import { ElectronAppInfo } from '@horizon/types'
import type { HorizonAction, EditablePrompt, UserSettings } from '@horizon/types'
import { getUserConfig } from '../main/config'

const log = useLogScope('Horizon Preload')
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

let mainNewWindowHandler: any = null
const webviewNewWindowHandlers = {}
const previewImageHandlers = {}
const fullscreenHandlers = [] as any[]

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
  captureWebContents: () => ipcRenderer.invoke('capture-web-contents'),
  getAdblockerState: (partition: string) =>
    ipcRenderer.invoke('get-adblocker-state', { partition }),
  setAdblockerState: (partition: string, state: boolean) =>
    ipcRenderer.invoke('set-adblocker-state', { partition, state }),
  requestNewPreviewImage: (horizonId: string) =>
    ipcRenderer.invoke('request-new-preview-image', { horizonId }),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  updateTrafficLightsVisibility: (visible: boolean) => {
    log.debug('updateTrafficLightsVisibility', visible)
    ipcRenderer.invoke('update-traffic-lights', { visible })
  },
  handleGoogleSignIn: async (url: string): Promise<string | undefined> => {
    return ipcRenderer.invoke('handle-google-sign-in', { url })
  },

  onFullscreenChange: (callback: any) => {
    fullscreenHandlers.push(callback)
  },
  registerMainNewWindowHandler: (callback: any) => {
    mainNewWindowHandler = callback
  },
  registerNewWindowHandler: (webContentsId: number, callback: any) => {
    webviewNewWindowHandlers[webContentsId] = callback
  },
  unregisterNewWindowHandler: (webContentsId: number) => {
    if (webviewNewWindowHandlers[webContentsId]) {
      delete webviewNewWindowHandlers[webContentsId]
    }
  },
  registerPreviewImageHandler: (horizonId: string, callback: any) => {
    previewImageHandlers[horizonId] = callback
  },
  unregisterPreviewImageHandler: (horizonId: string) => {
    if (previewImageHandlers[horizonId]) {
      delete previewImageHandlers[horizonId]
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
      log.debug('fetching', url, opts)
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

    log.debug('calling AI with messages', messages)

    const chatCompletion = await openai.chat.completions.create({
      messages: messages,
      model: 'gpt-4o',
      ...opts
    })

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

    return chatCompletion.choices[0].message.content
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
        log.debug(message)
      })

    const finalMessage = await runner.finalContent()
    log.debug('Final message:', finalMessage)
    return finalMessage
  },

  onOpenURL: (callback) => {
    try {
      ipcRenderer.on('open-url', (_, url) => callback(url))
    } catch (error) {
      // noop
    }
  },

  onOpenOasis: (callback) => {
    try {
      ipcRenderer.on('open-oasis', (_) => callback())
    } catch (error) {
      // noop
    }
  },

  toggleRightSidebar: (callback) => {
    try {
      ipcRenderer.on('toggle-right-sidebar', () => callback())
    } catch (error) {
      // noop
    }
  },

  toggleChatMode: (callback) => {
    try {
      ipcRenderer.on('toggle-chat-mode', () => callback())
    } catch (error) {
      // noop
    }
  },

  toggleAnnotations: (callback) => {
    try {
      ipcRenderer.on('toggle-annotations', () => callback())
    } catch (error) {
      // noop
    }
  },

  toggleGoWild: (callback) => {
    try {
      ipcRenderer.on('toggle-go-wild', () => callback())
    } catch (error) {
      // noop
    }
  },

  onOpenCheatSheet: (callback) => {
    try {
      ipcRenderer.on('open-cheat-sheet', () => callback())
    } catch (error) {
      // noop
    }
  },

  onOpenFeedbackPage: (callback) => {
    try {
      ipcRenderer.on('open-feedback-page', () => callback())
    } catch (error) {
      // noop
    }
  },

  onAdBlockerStateChange: (callback) => {
    ipcRenderer.on('adblocker-state-changed', (_, { partition, state }) => {
      callback(partition, state)
    })
  },

  onTrackEvent: (callback) => {
    try {
      ipcRenderer.on('track-event', (_, { eventName, properties }) =>
        callback(eventName, properties)
      )
    } catch (error) {
      // noop
    }
  },

  appIsReady: () => {
    ipcRenderer.send('app-ready')
  },

  getUserConfig: () => ipcRenderer.invoke('get-user-config'),

  onRequestDownloadPath: (callback) => {
    ipcRenderer.on('download-request', async (_event, data) => {
      const path = await callback(data)
      ipcRenderer.send(`download-path-response-${data.id}`, path)
    })
  },
  onDownloadUpdated: (callback) => {
    ipcRenderer.on('download-updated', (_event, data) => callback(data))
  },
  onDownloadDone: (callback) => {
    ipcRenderer.on('download-done', (_event, completion) => callback(completion))
  },

  startDrag: (resourceId: string, filePath: string, type: string) => {
    ipcRenderer.send('start-drag', resourceId, filePath, type)
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
      ipcRenderer.send('store-api-key', data.api_key)
    }

    return data
  },

  getUserConfigSettings: () => userConfig.settings,

  saveUserConfigSettings: async (settings: UserSettings) => {
    ipcRenderer.send('store-settings', settings)
  },

  onUserConfigSettingsChange: (callback: (settings: UserSettings) => void) => {
    ipcRenderer.on('user-config-settings-change', (_, settings) => {
      userConfig.settings = settings
      callback(settings)
    })
  },

  updateInitializedTabs: async (value: boolean) => {
    ipcRenderer.send('update-initialized-tabs', value)
  },

  getAppInfo: () => ipcRenderer.invoke('get-app-info') as Promise<ElectronAppInfo>,

  interceptRequestsHeaders: async (
    urls: string[],
    partition: string
  ): Promise<{ url: string; headers: Record<string, string> }> => {
    return ipcRenderer.invoke('intercept-requests-headers', { urls, partition })
  },

  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  onGetPrompts: (callback: () => Promise<EditablePrompt[]>) => {
    ipcRenderer.on('get-prompts', async (_) => {
      const prompts = await callback()
      ipcRenderer.send('set-prompts', prompts)
    })
  },

  onUpdatePrompt: (callback: (id: string, content: string) => void) => {
    ipcRenderer.on('update-prompt', (_, { id, content }) => callback(id, content))
  },

  onResetPrompt: (callback: (id: string) => void) => {
    ipcRenderer.on('reset-prompt', (_, id) => callback(id))
  },

  // Used by the Settings page
  onSetPrompts: (callback: (prompts: EditablePrompt[]) => void) => {
    ipcRenderer.on('set-prompts', (_, prompts) => callback(prompts))
  },

  // Used by the Settings page
  getPrompts: () => ipcRenderer.send('get-prompts'),

  // Used by the Settings page
  updatePrompt: (id: string, content: string) => ipcRenderer.send('update-prompt', { id, content }),

  // Used by the Settings page
  resetPrompt: (id: string) => ipcRenderer.send('reset-prompt', id),

  copyToClipboard: (content: any) => {
    try {
      clipboard.writeText(content)
    } catch (err) {
      log.error('Failed to copy: ', err)
    }
  },

  minifyHtml: (html: string, options: any) => minify(html, options),

  onToggleSidebar: (callback: (visible?: boolean) => void) => {
    ipcRenderer.on('toggle-sidebar', (_, visible) => callback(visible))
  },

  onToggleTabsPosition: (callback: () => void) => {
    ipcRenderer.on('toggle-tabs-position', (_) => callback())
  },

  onCopyActiveTabURL: (callback: () => void) => {
    ipcRenderer.on('copy-active-tab-url', (_) => callback())
  },

  onCreateNewTab: (callback: () => void) => {
    ipcRenderer.on('create-new-tab', (_) => callback())
  },

  onCloseActiveTab: (callback: () => void) => {
    ipcRenderer.on('close-active-tab', (_) => callback())
  },

  onReloadActiveTab: (callback: (force: boolean) => void) => {
    ipcRenderer.on('reload-active-tab', (_, force) => callback(force))
  },

  onAddDemoItems: (callback: (visible?: boolean) => void) => {
    ipcRenderer.on('add-demo-items', (_) => callback())
  }
}

ipcRenderer.on('fullscreen-change', (_, { isFullscreen }) => {
  fullscreenHandlers.forEach((handler) => handler(isFullscreen))
})

ipcRenderer.on('new-window-request', (_, { webContentsId, ...data }) => {
  if (!webContentsId) {
    if (mainNewWindowHandler) mainNewWindowHandler(data)
    return
  }

  const handler = webviewNewWindowHandlers[webContentsId]
  if (handler) {
    handler(data)
  }
})

ipcRenderer.on('new-preview-image', (_, { horizonId, buffer, width, height }) => {
  const handler = previewImageHandlers[horizonId]
  if (!handler) return

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  buffer = new Uint8ClampedArray(buffer.buffer)
  for (let i = 0; i < buffer.length; i += 4) {
    let temp = buffer[i]
    buffer[i] = buffer[i + 2]
    buffer[i + 2] = temp
  }

  canvas?.getContext('2d')?.putImageData(new ImageData(buffer, width, height), 0, 0)
  canvas.toBlob((blob) => handler(blob), 'image/png', 0.7)
})

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
    log.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.backend = backend
}
