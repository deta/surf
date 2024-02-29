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

const USER_DATA_PATH =
  process.argv.find((arg) => arg.startsWith('--userDataPath='))?.split('=')[1] ?? ''
const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

const webviewNewWindowHandlers = {}
const previewImageHandlers = {}
const fullscreenHandlers = [] as any[]

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

  onFullscreenChange: (callback: any) => {
    fullscreenHandlers.push(callback)
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

  onAdBlockerStateChange: (callback) => {
    ipcRenderer.on('adblocker-state-changed', (_, { partition, state }) => {
      callback(partition, state)
    })
  },

  appIsReady: () => {
    ipcRenderer.send('app-ready')
  },

  getUserData: () => ipcRenderer.invoke('get-user-config')
}

ipcRenderer.on('fullscreen-change', (_, { isFullscreen }) => {
  fullscreenHandlers.forEach((handler) => handler(isFullscreen))
})

ipcRenderer.on('new-window-request', (_, { webContentsId, ...data }) => {
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

  function init(root_path: string) {
    let fn = {}
    handle = sffs.js__backend_tunnel_init(root_path)

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

  return init(BACKEND_ROOT_PATH)
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
