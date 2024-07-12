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

import type { UserConfig, HorizonAction, EditablePrompt } from '@horizon/types'

import { getConfig } from '../main/config'

const APP_PATH = process.argv.find((arg) => arg.startsWith('--appPath='))?.split('=')[1] ?? ''
const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

// TODO: think this is useless?
if (process.platform === 'win32') {
  process.env.PATH += `;${APP_PATH}`
}

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
  updateTrafficLightsVisibility: (visible: boolean) => {
    console.log('updateTrafficLightsVisibility', visible)
    ipcRenderer.invoke('update-traffic-lights', { visible })
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
      console.log('fetching', url, opts)
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

    console.log('calling AI with messages', messages)

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
      console.error('Failed to copy: ', err)
    }
  },

  minifyHtml: (html: string, options: any) => minify(html, options)
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
    handle = sffs.js__backend_tunnel_init(root_path, APP_PATH, vision_api_key, vision_api_endpoint)

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

  function getDBPath() {
    return `${BACKEND_ROOT_PATH}/sffs.sqlite`
  }

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

  return { openResource, readResource, writeResource, flushResource, closeResource, getDBPath }
})()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('backend', {
      sffs,
      resources,
      run_spaces_query_sql_test: async (n: number) => {
        const queries = [
          "All images uploaded in the last month that were tagged with 'project: alpha'.",
          "Chat messages from Discord saved with the action 'import' in the last six months.",
          'PDF documents tagged with the confidential tag set to true.',
          "Youtube videos from 2023 tagged with 'type: tutorial' and 'author: 3B1B'.",
          "Google Docs created before 2022 and tagged with 'department: product'.",
          "Documents created in 2023 tagged with 'client: DARPA'.",
          "Typeform tables imported in the last year with the tag 'survey: customer satisfaction'.",
          'Articles downloaded in 2024.',
          "Slack chat threads from 2023 tagged with 'team: marketing' and 'priority: high'.",
          "Google Sheets created in the last week tagged with 'project: quarterly report'.",
          "Slack chat messages from 2022 tagged with 'project: gamma' and 'status: completed'.",
          "Articles tagged with 'type: blog' created after January 2023 and before July 2023.",
          "Notion documents tagged with 'workspace: development' and 'status: in-progress'.",
          "Articles created in 2024 tagged with 'industry: tech' and 'author: Jane Smith'.",
          "Google Docs tagged with 'project: delta' and saved with the action 'paste' in 2023."
        ]

        const results = []
        const total_queries = n > queries.length ? queries.length : n

        for (let i = 0; i < total_queries; i++) {
          const query = queries[i]
          try {
            // @ts-ignore
            let sql_generated = JSON.parse(await sffs.js__ai_query_sffs_resources(query))
            // @ts-ignore
            results.push({ query, sql_generated })
          } catch (error) {
            // @ts-ignore
            results.push({ query, error: error.message })
          }

          console.log(`progress: ${i + 1}/${total_queries}`)
        }

        let html_content = `
          <html>
          <head>
            <style>
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background-color: #f9f9f9;
                padding: 20px;
              }
              h1 {
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
              }
              .query-result {
                background: #fff;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                padding: 15px;
              }
              .query {
                font-weight: bold;
                color: #2c3e50;
              }
              .sql {
                white-space: pre-wrap;
                background-color: #ecf0f1;
                padding: 10px;
                border-radius: 5px;
                border: 1px solid #bdc3c7;
                margin-top: 10px;
              }
              .error {
                color: red;
                font-weight: bold;
                margin-top: 10px;
              }
            </style>
          </head>
          <body>
            <h1>SQL Query Results</h1>
        `

        results.forEach((result: { query: string; error: string; sql_generated: string }) => {
          html_content += `
            <div class="query-result">
              <div class="query">${result.query}</div>
              ${result.error ? `<div class="error">Error: ${result.error}</div>` : `<div class="sql">${result.sql_generated}</div>`}
            </div>
          `
        })

        html_content += `
          </body>
          </html>
        `

        navigator.clipboard.writeText(html_content)
      }
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
