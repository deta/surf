import { app, net } from 'electron'
import { isPathSafe } from './utils'
import path, { join } from 'path'
import { stat, mkdir } from 'fs/promises'
import { Worker } from 'worker_threads'
import { useLogScope } from '@horizon/utils'
import { createSetupWindow, getSetupWindow } from './setupWindow'
import { IPC_EVENTS_MAIN } from '@horizon/core/src/lib/service/ipc/events'

interface ImageProcessingParams {
  requestURL: string
  resourceId: string
  imgPath: string
  cacheDir: string
}

interface ImageProcessingOptions {
  quality: number | null
  maxDimension: number | null
}

const imageProcessorHandles = new Map<
  string,
  { promise: Promise<Response>; resolve: (value: Response) => void }[]
>()
let imageProcessor: Worker | null = null
let imageProcessorDeinitTimeout: NodeJS.Timeout | null = null

let log = useLogScope('surfProtocolHandlers')

const imageProcessorOnMessage = (result: {
  messageID: string
  success: boolean
  buffer: Buffer
  error?: string
}) => {
  const handles = imageProcessorHandles.get(result.messageID)
  if (!handles) return

  let response: Response
  if (!result.success) {
    log.error('Image processing error:', result.error)
    response = new Response(`Image Processing Error: ${result.error}`, { status: 500 })
  } else {
    response = new Response(result.buffer)
  }
  handles.forEach((handle) => handle.resolve(response.clone())) // NOTE: Try clonse so its not consumed and lost for multiple reauesters
  imageProcessorHandles.delete(result.messageID)
}

const imageProcessorOnError = (error) => {
  // NOTE: Error message indicates unrecoverable state! otherwise, error is handles inside 'message'
  // In this case we resolve all open handles with an error
  log.error(`Image processing error: ${error}! Resolving all active handles with error!`)
  imageProcessorHandles.entries().forEach(([id, handles]) => {
    handles.forEach((handle) =>
      handle.resolve(
        new Response(`Image Processing Error: Fatal error!`, {
          status: 500
        })
      )
    )
    imageProcessorHandles.delete(id)
  })
}

const initializeImageProcessor = () => {
  // NOTE: the import path is relative to how we've configured main in electron.vite.config.ts
  const workerPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'imageProcessor.js')
    : path.join(__dirname, 'imageProcessor.js')

  const sharpPath = require.resolve('sharp')
  imageProcessor = new Worker(workerPath, {
    workerData: { sharpPath }
  })

  imageProcessor.on('message', imageProcessorOnMessage)
  imageProcessor.on('error', imageProcessorOnError)
}

const deinitializeImageProcessor = () => {
  if (!imageProcessor) return
  if (imageProcessorHandles.size > 0) {
    imageProcessorDeinitTimeout = setTimeout(deinitializeImageProcessor, 10000)
    return
  }
  imageProcessor.removeListener('message', imageProcessorOnMessage)
  imageProcessor.removeListener('error', imageProcessorOnError)
  imageProcessor
    .terminate()
    .then(() => (imageProcessor = null))
    .catch(() => (imageProcessor = null))
  imageProcessorDeinitTimeout = null
}

const extractImageOptions = (url: URL): ImageProcessingOptions => {
  return {
    quality: url.searchParams.has('quality')
      ? Number.parseInt(url.searchParams.get('quality') ?? '100')
      : null,
    maxDimension: url.searchParams.has('maxDimension')
      ? Number.parseInt(url.searchParams.get('maxDimension')!)
      : null
  }
}

const generateCachedPath = (
  resourceId: string,
  baseCacheDir: string,
  { quality, maxDimension }: ImageProcessingOptions
): string => {
  let cachedName = `/${resourceId}`
  if (quality !== null) cachedName += `_quality-${quality}`
  if (maxDimension !== null) cachedName += `_maxDimension-${maxDimension}`
  return join(baseCacheDir, cachedName)
}

const processImageWithWorker = async (
  imageProcessor: Worker,
  params: {
    imgPath: string
    savePath: string
    quality: number | null
    maxDimension: number | null
  }
): Promise<Response> => {
  const messageID = params.imgPath
  if (messageID === undefined) throw 'HSAF'

  let postJob = true
  if (imageProcessorHandles.has(messageID)) postJob = false

  let resolve: ((value: Response) => void) | null = null
  const promise = new Promise<Response>((res) => {
    resolve = res
  })
  if (resolve === null) {
    return new Response(`Image Processing Error: Could not setup processing handle!`, {
      status: 500
    })
  }

  // TODO: Timeout?
  if (imageProcessorHandles.get(messageID)) {
    imageProcessorHandles.get(messageID)?.push({
      promise,
      resolve
    })
  } else {
    imageProcessorHandles.set(messageID, [
      {
        promise,
        resolve
      }
    ])

    imageProcessor.postMessage({ ...params, messageID })
  }

  if (imageProcessorDeinitTimeout) {
    clearTimeout(imageProcessorDeinitTimeout)
    imageProcessorDeinitTimeout = null
  }
  imageProcessorDeinitTimeout = setTimeout(deinitializeImageProcessor, 10000)

  return promise
}

const createCacheDirIfNotExists = async (cacheDir: string) => {
  try {
    await stat(cacheDir)
  } catch {
    await mkdir(cacheDir, { recursive: true })
  }
}

const surfProtocolHandleImages = async ({
  requestURL,
  resourceId,
  imgPath,
  cacheDir
}: ImageProcessingParams): Promise<Response> => {
  try {
    // log.debug('Processing handle size ', imageProcessorHandles.size) // Sanity check
    await createCacheDirIfNotExists(cacheDir)
    const url = new URL(requestURL)
    const options = extractImageOptions(url)

    // return original file if no processing needed
    if (options.quality === null && options.maxDimension === null) {
      return net.fetch(`file://${imgPath}`)
    }

    const cachedPath = generateCachedPath(resourceId, cacheDir, options)

    // return cached file if exists
    const stats = await stat(cachedPath).catch(() => null)
    if (stats) {
      return net.fetch(`file://${cachedPath}`)
    }

    if (!imageProcessor) {
      initializeImageProcessor()
    }

    return processImageWithWorker(imageProcessor!, {
      imgPath,
      savePath: cachedPath,
      quality: options.quality,
      maxDimension: options.maxDimension
    })
  } catch (err) {
    log.error('Image processing error:', err)
    return new Response(`'Internal Server Error: ${err}`, { status: 500 })
  }
}

export const surfProtocolHandler = async (req: GlobalRequest) => {
  try {
    const id = req.url.match(/^surf:\/\/resource\/([^\/\?]+)/)?.[1]
    if (!id) return new Response('Invalid Surf protocol URL', { status: 400 })

    const base = join(app.getPath('userData'), 'sffs_backend', 'resources')
    const filePath = join(base, id)

    if (!isPathSafe(base, filePath)) {
      return new Response('Forbidden', { status: 403 })
    }

    const response = await net.fetch(`file://${filePath}`)
    if (
      response.headers.get('content-type')?.startsWith('image/') &&
      !response.headers.get('content-type')?.startsWith('image/gif')
    ) {
      return surfProtocolHandleImages({
        requestURL: req.url,
        resourceId: id,
        imgPath: filePath,
        cacheDir: join(base, 'cache')
      })
    }
    return response
  } catch (err) {
    log.error('surf protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const surfletProtocolHandler = async (req: GlobalRequest) => {
  try {
    const url = new URL(req.url)
    if (!url.hostname.endsWith('.app.local')) {
      return new Response('Invalid Surflet protocol URL', { status: 400 })
    }
    const id = url.hostname.replace('.app.local', '')
    const base = join(app.getPath('userData'), 'sffs_backend', 'resources')
    const path = join(base, id)

    if (!isPathSafe(base, path)) {
      return new Response('Forbidden', { status: 403 })
    }
    let res = await net.fetch(`file://${path}`)
    if (!res.ok) {
      return new Response('Not Found', { status: 404 })
    }
    const code = await res.text()
    return new Response(code, {
      headers: {
        'Content-Type': 'text/html'
      }
    })
  } catch (err) {
    log.error('surflet protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// url will be of the form surf://activation.app/activation_code
const extractActivationCodeAndEmail = (
  url: URL
): {
  activationCode?: string
  email?: string
} => {
  if (url.protocol !== 'surf:') {
    return {}
  }
  if (url.hostname !== 'activation.app') {
    return {}
  }
  const parts = url.pathname.split('/')
  if (parts.length != 2) {
    return {}
  }
  return {
    activationCode: parts[1],
    email: url.searchParams.get('email') || ''
  }
}

export const surfProtocolExternalURLHandler = async (url: URL) => {
  // only activations are supported for now
  const { activationCode, email } = extractActivationCodeAndEmail(url)
  if (!activationCode) {
    // TODO: handle ux
    return
  }
  // TODO: what if setup window is not open?
  let setupWindow = getSetupWindow()
  if (!setupWindow) {
    createSetupWindow({
      presetInviteCode: activationCode,
      presetEmail: email
    })
    return
  }
  setupWindow.focus()
  IPC_EVENTS_MAIN.setupVerificationCode.sendToWebContents(setupWindow.webContents, activationCode)
}
