import { app, net } from 'electron'
import { isPathSafe, getContentType } from './utils'
import path, { join } from 'path'
import { stat, mkdir, rename } from 'fs/promises'
import { Worker } from 'worker_threads'
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
import { pathToFileURL } from 'url'
import { getResourceFileExtension, getResourceFileName, useLogScope } from '@deta/utils'
import { SFFSMain, useSFFSMain } from './sffs'
import { SFFSRawResource, SFFSResource } from '@deta/types'

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
    response = new Response(result.buffer as any)
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
    await createCacheDirIfNotExists(cacheDir)
    const url = new URL(requestURL)
    const options = extractImageOptions(url)

    // cache control headers
    const cacheHeaders = {
      'Cache-Control': 'max-age=172800', // Cache for 24 hours
      // TODO: do we ned a hash?
      ETag: `"${resourceId}"`,
      'Last-Modified': new Date().toUTCString()
    }

    // return original file if no processing needed
    if (options.quality === null && options.maxDimension === null) {
      const response = await net.fetch(`file://${imgPath}`)
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
      })
    }

    const cachedPath = generateCachedPath(resourceId, cacheDir, options)

    // return cached file if exists
    const stats = await stat(cachedPath).catch(() => null)
    if (stats) {
      const response = await net.fetch(`file://${cachedPath}`)
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
      })
    }

    if (!imageProcessor) {
      initializeImageProcessor()
    }

    const response = await processImageWithWorker(imageProcessor!, {
      imgPath,
      savePath: cachedPath,
      quality: options.quality,
      maxDimension: options.maxDimension
    })

    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
    })
  } catch (err) {
    log.error('Image processing error:', err)
    return new Response(`'Internal Server Error: ${err}`, { status: 500 })
  }
}

const ALLOWED_HOSTNAMES = ['core', 'overlay', 'surf']

const HOSTNAME_TO_ROOT = {
  core: '/Core/core.html',
  overlay: '/Overlay/overlay.html',
  surf: '/Resource/resource.html'
}

export const serveFile = async (req: Request, targetPath: string) => {
  try {
    const basePath = path.join(app.getAppPath(), 'out', 'renderer')
    const target = path.join(basePath, targetPath)
    if (!isPathSafe(basePath, target)) {
      log.error('Path is not safe:', basePath, targetPath)
      return new Response('Forbidden', { status: 403 })
    }

    let mainURL = pathToFileURL(target).href
    const devRendererURL = import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL
    if (devRendererURL) {
      mainURL = `${devRendererURL}${targetPath}`
    }

    const newURL = new URL(mainURL)
    if (devRendererURL) {
      const reqURL = URL.parse(req.url)
      if (reqURL) {
        newURL.search = reqURL.search
        newURL.hash = reqURL.hash
      }
    }

    if (targetPath.endsWith('.html')) {
      log.debug('serve file:', req.url, targetPath, newURL.href)
    }

    const response = await net.fetch(newURL.href)

    if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
      return response
    }

    const mimeType = getContentType(mainURL)

    // Create a new response with the correct MIME type
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': mimeType
      }
    })
  } catch (err) {
    log.error('serve file:', err, req.url, targetPath)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const handleSurfFileRequest = async (req: GlobalRequest) => {
  try {
    const url = new URL(req.url)

    if (url.protocol !== 'surf-internal:' && url.protocol !== 'surf:') {
      log.error('Invalid protocol:', url.protocol)
      return new Response('Invalid Surf protocol URL', { status: 400 })
    }

    if (!ALLOWED_HOSTNAMES.includes(url.hostname.toLowerCase())) {
      log.error('Invalid hostname:', url.hostname)
      return new Response('Invalid Surf internal protocol hostname', { status: 400 })
    }

    let targetPath = url.pathname
    if (targetPath === '/') {
      const rootPath = HOSTNAME_TO_ROOT[url.hostname as keyof typeof HOSTNAME_TO_ROOT]
      if (!rootPath) {
        log.error('Invalid hostname for root path:', url.hostname)
        return new Response('Invalid Surf internal protocol hostname', { status: 400 })
      }

      targetPath = rootPath
    } else if (url.hostname === 'surf') {
      // Handle root requests (surf://surf/notebook/:id) and root assets
      const match = url.pathname.match(/^\/(notebook|resource)(?:\/([^\/]+))?\/?$/)

      if (match) {
        const [, type, id] = match

        if (id) {
          // If only ID is present, serve the main HTML
          if (url.pathname === `/${type}/${id}`) {
            const rootPath = HOSTNAME_TO_ROOT['surf']
            if (!rootPath) {
              log.error('Invalid hostname for root path:', url.hostname)
              return new Response('Invalid Surf internal protocol hostname', { status: 400 })
            }

            targetPath = rootPath
          } else if (url.pathname === `/${type}`) {
            const rootPath = HOSTNAME_TO_ROOT['surf']
            if (!rootPath) {
              log.error('Invalid hostname for root path:', url.hostname)
              return new Response('Invalid Surf internal protocol hostname', { status: 400 })
            }

            targetPath = rootPath
          } else {
            // For asset requests (surf://surf/notebook/:id/some/file.js), remove the type and ID prefix
            targetPath = url.href.replace(`surf://surf/${type}/${id}/`, '')
          }
        } else if (url.pathname === `/${type}`) {
          const rootPath = HOSTNAME_TO_ROOT['surf']
          if (!rootPath) {
            log.error('Invalid hostname for root path:', url.hostname)
            return new Response('Invalid Surf internal protocol hostname', { status: 400 })
          }

          targetPath = rootPath
        } else {
          // For root assets (surf://surf/notebook/assets/style.css)
          targetPath = `${url.pathname.substring(type.length + 1)}`
        }
      } else {
        targetPath = url.pathname
      }
    }

    return serveFile(req, targetPath)
  } catch (err) {
    log.error('surf internal protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

const fetchFilePath = async (base: string, filePath: string) => {
  try {
    if (!isPathSafe(base, filePath)) {
      return {
        response: new Response('Forbidden', { status: 403 }),
        filePath,
        base
      }
    }

    const response = await net.fetch(`file://${filePath}`)
    return { response, filePath, base }
  } catch (error) {
    return null
  }
}

const migrateResourceFile = async (
  legacyFilePath: string,
  newFilePath: string,
  resource?: SFFSResource
) => {
  log.debug('Migrating resource file to new path with extension:', newFilePath)

  if (legacyFilePath !== newFilePath) {
    await rename(legacyFilePath, newFilePath)
  }

  const sffs = useSFFSMain()
  if (!resource || !sffs) return

  await sffs.updateResource({
    id: resource.id,
    resource_path: newFilePath,
    resource_type: resource.type,
    created_at: resource.createdAt,
    updated_at: resource.updatedAt,
    deleted: resource.deleted ? 1 : 0
  } satisfies SFFSRawResource)
}

const fetchResourceFile = async (resourceId: string, resource?: SFFSResource) => {
  const base = join(app.getPath('userData'), 'sffs_backend', 'resources')
  const filePath = join(base, resourceId)

  try {
    let extension = ''
    let newFileName = resourceId
    if (resource) {
      extension = getResourceFileExtension(resource.type)
      newFileName = getResourceFileName(SFFSMain.convertResourceToCompositeResource(resource))
    }

    // try stored resource path first
    if (
      resource &&
      resource.path &&
      (resource.path.endsWith(`.${extension}`) || resource.path.endsWith('.json'))
    ) {
      const result = await fetchFilePath(base, resource.path)
      if (result) {
        return result
      }
    }

    // then try the new path (with new file name and extension)
    let newFilePath = join(base, extension ? `${newFileName}.${extension}` : resourceId)
    let result = await fetchFilePath(base, newFilePath)
    if (result) {
      if (resource?.path !== newFilePath) {
        await migrateResourceFile(newFilePath, newFilePath, resource)
      }

      return result
    }

    // try legacy path with only resourceId
    const legacyFilePath = join(base, resourceId)
    result = await fetchFilePath(base, legacyFilePath)
    if (result) {
      await migrateResourceFile(legacyFilePath, newFilePath, resource)
      return result
    }

    return { response: new Response('Not Found', { status: 404 }), filePath, base }
  } catch (error) {
    log.error('Error fetching resource file:', error)
    return { response: new Response('Not Found', { status: 404 }), filePath, base }
  }
}

const handleSurfResourceDataRequest = async (req: GlobalRequest, resourceId: string) => {
  const sffs = useSFFSMain()
  const resource = await sffs?.readResource(resourceId).catch(() => null)

  const { response, filePath, base } = await fetchResourceFile(resourceId, resource ?? undefined)
  if (
    response.headers.get('content-type')?.startsWith('image/') &&
    !response.headers.get('content-type')?.startsWith('image/gif')
  ) {
    return surfProtocolHandleImages({
      requestURL: req.url,
      resourceId: resourceId,
      imgPath: filePath,
      cacheDir: join(base, 'cache')
    })
  }

  return response
}

export const surfInternalProtocolHandler = async (req: GlobalRequest) => {
  return handleSurfFileRequest(req)
}

export const surfProtocolHandler = async (req: GlobalRequest) => {
  try {
    const id = req.url.match(/^surf:\/\/surf\/resource\/([^\/\?]+)/)?.[1]
    if (id) {
      const searchParams = new URL(req.url).searchParams
      if (searchParams.has('raw') && searchParams.get('raw') !== 'false') {
        return handleSurfResourceDataRequest(req, id)
      }
    }

    return handleSurfFileRequest(req)
  } catch (err) {
    log.error('surf protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const surfletProtocolHandler = async (req: GlobalRequest) => {
  try {
    const cspPolicy =
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https://picsum.photos https://via.placeholder.com https://images.unsplash.com; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"

    const url = new URL(req.url)
    if (!url.hostname.endsWith('.app.local')) {
      return new Response('Invalid Surflet protocol URL', { status: 400 })
    }
    const isV2Protocol = url.hostname.endsWith('.v2.app.local')
    const suffix = isV2Protocol ? '.v2.app.local' : '.app.local'
    const id = url.hostname.replace(suffix, '')

    const sffs = useSFFSMain()
    const resource = await sffs?.readResource(id).catch(() => null)

    const { response } = await fetchResourceFile(id, resource ?? undefined)
    if (!response.ok) {
      return new Response('Not Found', { status: 404 })
    }

    const code = await response.text()
    let headers = {
      'Content-Type': 'text/html'
    }
    // NOTE: only add CSP header for v2 protocol
    // this is to not break existing surflets that do not expect CSP
    if (isV2Protocol) {
      headers['Content-Security-Policy'] = cspPolicy
    }
    return new Response(code, {
      headers: headers
    })
  } catch (err) {
    log.error('surflet protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const checkSurfProtocolRequest = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'surf:' && ALLOWED_HOSTNAMES.includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
