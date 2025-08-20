import path from 'path'
import http from 'http'

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

import { getUserConfig } from '../../main/config'

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

const BACKEND_ROOT_PATH = path.join(USER_DATA_PATH, 'sffs_backend')
const BACKEND_RESOURCES_PATH = path.join(BACKEND_ROOT_PATH, 'resources')

const userConfig = getUserConfig(USER_DATA_PATH) // getConfig<UserConfig>(USER_DATA_PATH, 'user.json')
const LANGUAGE_SETTING = userConfig.settings?.embedding_model.includes('multi') ? 'multi' : 'en'

const API_BASE = import.meta.env.P_VITE_API_BASE ?? 'https://deta.space/api'
const API_KEY = import.meta.env.P_VITE_API_KEY ?? userConfig.api_key

export type SFFSOptions = {
  num_worker_threads?: number
  num_processor_threads?: number
}

export const initSFFS = (opts?: SFFSOptions) => {
  const num_worker_threads = opts?.num_worker_threads ?? 12
  const num_processor_threads = opts?.num_processor_threads ?? 12

  mkdirSync(BACKEND_RESOURCES_PATH, { recursive: true })

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
      num_worker_threads,
      num_processor_threads,
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
}

export class ResourceHandle {
  private fd: fsp.FileHandle
  private filePath: string
  private resourceId: string
  private writeHappened = false
  private currentHash: string
  private sffs: any

  private constructor(
    fd: fsp.FileHandle,
    filePath: string,
    resourceId: string,
    initialHash: string,
    sffs: any
  ) {
    this.fd = fd
    this.filePath = filePath
    this.resourceId = resourceId
    this.currentHash = initialHash
    this.sffs = sffs
  }

  static async open(
    sffs: any,
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
    const initialHash = JSON.parse(await sffs.js__store_get_resource_hash(resourceId))
    return new ResourceHandle(fd, resolvedFilePath, resourceId, initialHash, sffs)
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
        await this.sffs.js__store_upsert_resource_hash(this.resourceId, newHash)
        await this.sffs.js__store_resource_post_process(this.resourceId)
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

export const initResources = (sffs: ReturnType<typeof initSFFS>) => {
  const resourceHandles = new Map<string, ResourceHandle>()

  async function openResource(resourceId: string, flags: string) {
    const resourceHandle = await ResourceHandle.open(
      sffs,
      BACKEND_RESOURCES_PATH,
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
}

export const initBackend = (opts?: SFFSOptions) => {
  const sffs = initSFFS(opts)
  const resources = initResources(sffs)

  return {
    sffs,
    resources
  }
}
