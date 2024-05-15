import { contextBridge, ipcRenderer } from 'electron'
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

import { createAPI } from '@horizon/api'
import { actionsToRunnableTools } from './actions'
import { ElectronAppInfo } from '@horizon/types'

import type { UserConfig, HorizonAction } from '@horizon/types'

import { getConfig } from '../main/config'

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

let mainNewWindowHandler: any = null
const webviewNewWindowHandlers = {}
const previewImageHandlers = {}
const fullscreenHandlers = [] as any[]

const OPENAI_API_ENDPOINT = import.meta.env.P_VITE_OPEN_AI_API_ENDPOINT
const OPENAI_API_KEY = import.meta.env.P_VITE_OPEN_AI_API_KEY
const VISION_API_ENDPOINT = import.meta.env.P_VITE_VISION_API_ENDPOINT || ''
const VISION_API_KEY = import.meta.env.P_VITE_VISION_API_KEY || ''

const userConfig = getConfig<UserConfig>(USER_DATA_PATH, 'user.json')

let openai: OpenAI | null = null
//if (userConfig.api_key) {
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    baseURL: OPENAI_API_ENDPOINT,
    apiKey: OPENAI_API_KEY,
    //apiKey: userConfig.api_key,
    dangerouslyAllowBrowser: true
  })
}

const api = {
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

  fetchHTMLFromRemoteURL: async (url: string) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
          'Content-Type': 'text/html'
        }
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

  createAIChatCompletion: async (userPrompt: string, systemPrompt?: string) => {
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
      model: 'gpt-4'
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
        console.log(message)
      })

    const finalMessage = await runner.finalContent()
    console.log('Final message:', finalMessage)
    return finalMessage
  },

  onOpenURL: (callback) => {
    try {
      ipcRenderer.on('open-url', (_, url) => callback(url))
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

  getAppInfo: () => ipcRenderer.invoke('get-app-info') as Promise<ElectronAppInfo>
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
    filePath: string,
    resourceId: string,
    flags: string = 'a+'
  ): Promise<ResourceHandle> {
    const resolvedRootPath = path.resolve(rootPath)
    const resolvedFilePath = path.resolve(resolvedRootPath, filePath)

    if (!resolvedFilePath.startsWith(resolvedRootPath)) {
      throw new Error('invalid file path')
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

  function init(root_path: string, vision_api_key: string, vision_api_endpoint: string) {
    let fn = {}
    handle = sffs.js__backend_tunnel_init(root_path, vision_api_key, vision_api_endpoint)

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

  return init(BACKEND_ROOT_PATH, VISION_API_KEY || '', VISION_API_ENDPOINT)
})()

const resources = (() => {
  const resourceHandles = new Map<string, ResourceHandle>()

  async function openResource(filePath: string, resourceId: string, flags: string) {
    const resourceHandle = await ResourceHandle.open(
      BACKEND_RESOURCES_PATH,
      filePath,
      resourceId,
      flags
    )
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

  return { openResource, readResource, writeResource, flushResource, closeResource }
})()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('backend', { sffs, resources })
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
