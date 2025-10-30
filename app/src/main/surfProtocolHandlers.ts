// 导入 Electron 核心模块
import { app, net } from 'electron'
// 导入路径安全检查和内容类型获取工具函数
import { isPathSafe, getContentType } from './utils'
// 导入路径处理相关模块
import path, { join } from 'path'
// 导入文件系统异步操作函数
import { stat, mkdir, rename } from 'fs/promises'
// 导入 Worker 线程模块用于图像处理
import { Worker } from 'worker_threads'
// 导入主进程 IPC 事件常量
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
// 导入路径到文件 URL 转换工具
import { pathToFileURL } from 'url'
// 导入资源处理相关工具函数
import { getResourceFileExtension, getResourceFileName, useLogScope } from '@deta/utils'
// 导入 SFFS（Surf 文件系统）主进程相关模块
import { SFFSMain, useSFFSMain } from './sffs'
// 导入 SFFS 资源类型定义
import { SFFSRawResource, SFFSResource } from '@deta/types'

/**
 * 图像处理参数接口
 * 定义图像处理所需的基本参数
 */
interface ImageProcessingParams {
  // 请求的完整 URL
  requestURL: string
  // 资源 ID
  resourceId: string
  // 图像文件路径
  imgPath: string
  // 缓存目录路径
  cacheDir: string
}

/**
 * 图像处理选项接口
 * 定义图像处理的具体选项
 */
interface ImageProcessingOptions {
  // 图像质量参数 (0-100)
  quality: number | null
  // 图像最大尺寸参数
  maxDimension: number | null
}

// 存储图像处理请求的 Map，用于处理重复请求和管理异步响应
const imageProcessorHandles = new Map<
  string,
  { promise: Promise<Response>; resolve: (value: Response) => void }[]
>()

// 图像处理 Worker 实例，初始为 null
let imageProcessor: Worker | null = null

// 图像处理 Worker 自动销毁的定时器
let imageProcessorDeinitTimeout: NodeJS.Timeout | null = null

// 创建协议处理器日志实例
let log = useLogScope('surfProtocolHandlers')

/**
 * 处理来自图像处理 Worker 的消息
 * 当 Worker 完成图像处理后，将结果分发给等待的请求
 */
const imageProcessorOnMessage = (result: {
  messageID: string
  success: boolean
  buffer: Buffer
  error?: string
}) => {
  // 获取与消息 ID 关联的所有请求句柄
  const handles = imageProcessorHandles.get(result.messageID)
  if (!handles) return

  let response: Response
  // 根据处理结果创建相应的响应对象
  if (!result.success) {
    log.error('Image processing error:', result.error)
    response = new Response(`Image Processing Error: ${result.error}`, { status: 500 })
  } else {
    // 成功时，使用处理后的图像缓冲区创建响应
    response = new Response(result.buffer as any)
  }

  // 克隆响应并分发给每个等待的请求
  handles.forEach((handle) => handle.resolve(response.clone())) // NOTE: 克隆响应避免多个请求共享同一响应对象导致数据丢失

  // 处理完成后，从 Map 中删除对应的句柄
  imageProcessorHandles.delete(result.messageID)
}

/**
 * 处理图像处理 Worker 的错误
 * 当 Worker 发生致命错误时，处理所有待处理的图像请求
 */
const imageProcessorOnError = (error) => {
  // NOTE: 错误消息表示不可恢复的状态！否则，错误会在 'message' 回调中处理
  // 在这种情况下，我们将所有开放的请求句柄都解析为错误
  log.error(`Image processing error: ${error}! Resolving all active handles with error!`)

  // 为所有待处理的请求创建错误响应
  imageProcessorHandles.entries().forEach(([id, handles]) => {
    handles.forEach((handle) =>
      handle.resolve(
        new Response(`Image Processing Error: Fatal error!`, {
          status: 500
        })
      )
    )
    // 清除处理过的请求句柄
    imageProcessorHandles.delete(id)
  })
}

/**
 * 初始化图像处理 Worker
 * 创建 Worker 实例并设置事件监听器
 */
const initializeImageProcessor = () => {
  // NOTE: 导入路径是相对于 electron.vite.config.ts 中配置的 main 路径
  // 根据应用是否打包，选择正确的 worker 脚本路径
  const workerPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'imageProcessor.js')
    : path.join(__dirname, 'imageProcessor.js')

  // 获取 sharp 图像处理库的路径，传递给 Worker
  const sharpPath = require.resolve('sharp')
  imageProcessor = new Worker(workerPath, {
    workerData: { sharpPath }
  })

  // 设置事件监听器
  imageProcessor.on('message', imageProcessorOnMessage)
  imageProcessor.on('error', imageProcessorOnError)
}

/**
 * 销毁图像处理 Worker
 * 安全地终止 Worker 实例，避免内存泄漏
 */
const deinitializeImageProcessor = () => {
  // 如果没有初始化的 Worker，则直接返回
  if (!imageProcessor) return

  // 如果还有未处理的请求，则延迟销毁
  if (imageProcessorHandles.size > 0) {
    imageProcessorDeinitTimeout = setTimeout(deinitializeImageProcessor, 10000)
    return
  }

  // 移除事件监听器
  imageProcessor.removeListener('message', imageProcessorOnMessage)
  imageProcessor.removeListener('error', imageProcessorOnError)

  // 终止 Worker 实例
  imageProcessor
    .terminate()
    .then(() => (imageProcessor = null))
    .catch(() => (imageProcessor = null))

  // 清除定时器引用
  imageProcessorDeinitTimeout = null
}

/**
 * 从 URL 中提取图像处理选项
 * 解析 URL 查询参数以获取图像质量和尺寸信息
 * @param url 请求的 URL 对象
 * @returns 图像处理选项对象
 */
const extractImageOptions = (url: URL): ImageProcessingOptions => {
  return {
    // 从 URL 查询参数获取图像质量参数，默认为 null
    quality: url.searchParams.has('quality')
      ? Number.parseInt(url.searchParams.get('quality') ?? '100')
      : null,
    // 从 URL 查询参数获取图像最大尺寸参数，默认为 null
    maxDimension: url.searchParams.has('maxDimension')
      ? Number.parseInt(url.searchParams.get('maxDimension')!)
      : null
  }
}

/**
 * 生成图像缓存路径
 * 根据资源 ID 和处理选项生成唯一的缓存文件路径
 * @param resourceId 资源 ID
 * @param baseCacheDir 基础缓存目录
 * @param options 图像处理选项
 * @returns 完整的缓存文件路径
 */
const generateCachedPath = (
  resourceId: string,
  baseCacheDir: string,
  { quality, maxDimension }: ImageProcessingOptions
): string => {
  // 从资源 ID 开始构建缓存文件名
  let cachedName = `/${resourceId}`

  // 添加质量参数（如果有）
  if (quality !== null) cachedName += `_quality-${quality}`

  // 添加最大尺寸参数（如果有）
  if (maxDimension !== null) cachedName += `_maxDimension-${maxDimension}`

  // 组合基础缓存目录和缓存文件名
  return join(baseCacheDir, cachedName)
}

/**
 * 使用 Worker 处理图像
 * 向图像处理 Worker 发送任务，并返回处理结果的 Promise
 * @param imageProcessor Worker 实例
 * @param params 图像处理参数
 * @returns Promise，解析为处理后的图像响应
 */
const processImageWithWorker = async (
  imageProcessor: Worker,
  params: {
    imgPath: string
    savePath: string
    quality: number | null
    maxDimension: number | null
  }
): Promise<Response> => {
  // 使用图像路径作为消息 ID
  const messageID = params.imgPath
  if (messageID === undefined) throw 'HSAF'

  // 检查是否已经有相同的请求在处理中
  let postJob = true
  if (imageProcessorHandles.has(messageID)) postJob = false

  // 创建 Promise 用于异步获取处理结果
  let resolve: ((value: Response) => void) | null = null
  const promise = new Promise<Response>((res) => {
    resolve = res
  })

  // 处理 Promise 创建失败的情况
  if (resolve === null) {
    return new Response(`Image Processing Error: Could not setup processing handle!`, {
      status: 500
    })
  }

  // TODO: 考虑添加超时处理
  // 记录请求句柄，避免重复处理相同的图像
  if (imageProcessorHandles.get(messageID)) {
    imageProcessorHandles.get(messageID)?.push({
      promise,
      resolve
    })
  } else {
    // 如果是新请求，添加到 Map 并向 Worker 发送任务
    imageProcessorHandles.set(messageID, [
      {
        promise,
        resolve
      }
    ])

    imageProcessor.postMessage({ ...params, messageID })
  }

  // 重置 Worker 销毁的定时器
  if (imageProcessorDeinitTimeout) {
    clearTimeout(imageProcessorDeinitTimeout)
    imageProcessorDeinitTimeout = null
  }

  // 设置新的定时器，10秒后尝试销毁 Worker
  imageProcessorDeinitTimeout = setTimeout(deinitializeImageProcessor, 10000)

  // 返回 Promise，等待图像处理完成
  return promise
}

/**
 * 如果缓存目录不存在，则创建它
 * 确保图像处理的缓存目录可用
 * @param cacheDir 缓存目录路径
 */
const createCacheDirIfNotExists = async (cacheDir: string) => {
  try {
    // 检查目录是否已存在
    await stat(cacheDir)
  } catch {
    // 如果不存在，递归创建目录
    await mkdir(cacheDir, { recursive: true })
  }
}

/**
 * 处理图像协议请求
 * 实现图像资源的加载、处理和缓存逻辑
 * @param params 图像处理参数
 * @returns Promise，解析为图像响应
 */
const surfProtocolHandleImages = async ({
  requestURL,
  resourceId,
  imgPath,
  cacheDir
}: ImageProcessingParams): Promise<Response> => {
  try {
    // 确保缓存目录存在
    await createCacheDirIfNotExists(cacheDir)

    // 解析请求 URL
    const url = new URL(requestURL)

    // 提取图像处理选项
    const options = extractImageOptions(url)

    // 设置缓存控制头
    const cacheHeaders = {
      'Cache-Control': 'max-age=172800', // 缓存 24 小时
      // TODO: 是否需要哈希值？
      ETag: `"${resourceId}"`,
      'Last-Modified': new Date().toUTCString()
    }

    // 如果不需要处理（没有指定质量和尺寸参数），直接返回原始文件
    if (options.quality === null && options.maxDimension === null) {
      const response = await net.fetch(`file://${imgPath}`)
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
      })
    }

    // 生成缓存文件路径
    const cachedPath = generateCachedPath(resourceId, cacheDir, options)

    // 如果缓存文件已存在，直接返回
    const stats = await stat(cachedPath).catch(() => null)
    if (stats) {
      const response = await net.fetch(`file://${cachedPath}`)
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
      })
    }

    // 初始化图像处理 Worker（如果尚未初始化）
    if (!imageProcessor) {
      initializeImageProcessor()
    }

    // 使用 Worker 处理图像
    const response = await processImageWithWorker(imageProcessor!, {
      imgPath,
      savePath: cachedPath,
      quality: options.quality,
      maxDimension: options.maxDimension
    })

    // 返回处理后的图像响应，添加缓存头
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...cacheHeaders }
    })
  } catch (err) {
    // 记录错误并返回错误响应
    log.error('Image processing error:', err)
    return new Response(`'Internal Server Error: ${err}`, { status: 500 })
  }
}

// 允许的主机名列表
const ALLOWED_HOSTNAMES = ['core', 'overlay', 'surf']

// 主机名到根 HTML 路径的映射
const HOSTNAME_TO_ROOT = {
  core: '/Core/core.html',
  overlay: '/Overlay/overlay.html',
  surf: '/Resource/resource.html'
}

/**
 * 提供文件服务
 * 从文件系统读取并返回指定路径的文件
 * @param req 请求对象
 * @param targetPath 目标文件路径
 * @returns Promise，解析为文件响应
 */
export const serveFile = async (req: Request, targetPath: string) => {
  try {
    // 构建基础路径和目标路径
    const basePath = path.join(app.getAppPath(), 'out', 'renderer')
    const target = path.join(basePath, targetPath)

    // 路径安全检查，防止路径遍历攻击
    if (!isPathSafe(basePath, target)) {
      log.error('Path is not safe:', basePath, targetPath)
      return new Response('Forbidden', { status: 403 })
    }

    // 构建文件 URL
    let mainURL = pathToFileURL(target).href

    // 开发模式下使用开发服务器 URL
    const devRendererURL = import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL
    if (devRendererURL) {
      mainURL = `${devRendererURL}${targetPath}`
    }

    // 创建 URL 对象并保留查询参数和哈希
    const newURL = new URL(mainURL)
    if (devRendererURL) {
      const reqURL = URL.parse(req.url)
      if (reqURL) {
        newURL.search = reqURL.search || ''
        newURL.hash = reqURL.hash || ''
      }
    }

    // 对于 HTML 文件，记录调试日志
    if (targetPath.endsWith('.html')) {
      log.debug('serve file:', req.url, targetPath, newURL.href)
    }

    // 发送请求获取文件内容
    const response = await net.fetch(newURL.href)

    // 开发模式下直接返回原始响应
    if (import.meta.env.DEV && process.env.ELECTRON_RENDERER_URL) {
      return response
    }

    // 确定文件的 MIME 类型
    const mimeType = getContentType(mainURL)

    // 创建带有正确 MIME 类型的新响应
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': mimeType
      }
    })
  } catch (err) {
    // 记录错误并返回错误响应
    log.error('serve file:', err, req.url, targetPath)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * 处理 Breakwind 文件请求
 * 解析 Breakwind 协议 URL 并提供相应的文件服务
 * @param req 全局请求对象
 * @returns Promise，解析为文件响应
 */
export const handleSurfFileRequest = async (req: GlobalRequest) => {
  try {
    const url = new URL(req.url)

    // 验证协议
    if (url.protocol !== 'surf-internal:' && url.protocol !== 'surf:') {
      log.error('Invalid protocol:', url.protocol)
      return new Response('Invalid Breakwind protocol URL', { status: 400 })
    }

    // 验证主机名
    if (!ALLOWED_HOSTNAMES.includes(url.hostname.toLowerCase())) {
      log.error('Invalid hostname:', url.hostname)
      return new Response('Invalid Breakwind internal protocol hostname', { status: 400 })
    }

    // 确定目标文件路径
    let targetPath = url.pathname

    // 处理根路径请求
    if (targetPath === '/') {
      const rootPath = HOSTNAME_TO_ROOT[url.hostname as keyof typeof HOSTNAME_TO_ROOT]
      if (!rootPath) {
        log.error('Invalid hostname for root path:', url.hostname)
        return new Response('Invalid Breakwind internal protocol hostname', { status: 400 })
      }
      targetPath = rootPath
    }
    // 特殊处理 surf 主机名的资源请求
    else if (url.hostname === 'surf') {
      // 处理根请求 (surf://surf/notebook/:id) 和根资源
      const match = url.pathname.match(/^\/(notebook|resource)(?:\/([^\/]+))?\/?$/)

      if (match) {
        const [, type, id] = match

        if (id) {
          // 如果只有 ID，则提供主 HTML 文件
          if (url.pathname === `/${type}/${id}`) {
            const rootPath = HOSTNAME_TO_ROOT['surf']
            if (!rootPath) {
              log.error('Invalid hostname for root path:', url.hostname)
              return new Response('Invalid Breakwind internal protocol hostname', { status: 400 })
            }
            targetPath = rootPath
          } else if (url.pathname === `/${type}`) {
            const rootPath = HOSTNAME_TO_ROOT['surf']
            if (!rootPath) {
              log.error('Invalid hostname for root path:', url.hostname)
              return new Response('Invalid Breakwind internal protocol hostname', { status: 400 })
            }
            targetPath = rootPath
          } else {
            // 对于资源请求 (surf://surf/notebook/:id/some/file.js)，移除类型和 ID 前缀
            targetPath = url.href.replace(`surf://surf/${type}/${id}/`, '')
          }
        } else if (url.pathname === `/${type}`) {
          const rootPath = HOSTNAME_TO_ROOT['surf']
          if (!rootPath) {
            log.error('Invalid hostname for root path:', url.hostname)
            return new Response('Invalid Breakwind internal protocol hostname', { status: 400 })
          }
          targetPath = rootPath
        } else {
          // 对于根资源 (surf://surf/notebook/assets/style.css)
          targetPath = `${url.pathname.substring(type.length + 1)}`
        }
      } else {
        targetPath = url.pathname
      }
    }

    // 提供文件服务
    return serveFile(req, targetPath)
  } catch (err) {
    log.error('surf internal protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * 从文件系统获取文件
 * 安全地读取指定路径的文件内容
 * @param base 基础路径
 * @param filePath 文件路径
 * @returns Promise，解析为文件响应、路径和基础路径的对象，或 null（出错时）
 */
const fetchFilePath = async (base: string, filePath: string) => {
  try {
    // 路径安全检查
    if (!isPathSafe(base, filePath)) {
      return {
        response: new Response('Forbidden', { status: 403 }),
        filePath,
        base
      }
    }

    // 获取文件内容
    const response = await net.fetch(`file://${filePath}`)
    return { response, filePath, base }
  } catch (error) {
    return null
  }
}

/**
 * 迁移资源文件
 * 将资源文件从旧路径迁移到新路径，并更新 SFFS 中的资源记录
 * @param legacyFilePath 旧文件路径
 * @param newFilePath 新文件路径
 * @param resource 资源对象（可选）
 */
const migrateResourceFile = async (
  legacyFilePath: string,
  newFilePath: string,
  resource?: SFFSResource
) => {
  log.debug('Migrating resource file to new path with extension:', newFilePath)

  // 如果路径不同，重命名文件
  if (legacyFilePath !== newFilePath) {
    await rename(legacyFilePath, newFilePath)
  }

  // 获取 SFFS 实例
  const sffs = useSFFSMain()
  if (!resource || !sffs) return

  // 更新 SFFS 中的资源记录
  await sffs.updateResource({
    id: resource.id,
    resource_path: newFilePath,
    resource_type: resource.type,
    created_at: resource.createdAt,
    updated_at: resource.updatedAt,
    deleted: resource.deleted ? 1 : 0
  } satisfies SFFSRawResource)
}

/**
 * 获取资源文件
 * 从 SFFS 中读取指定 ID 的资源文件，支持向后兼容
 * @param resourceId 资源 ID
 * @param resource 资源对象（可选）
 * @returns Promise，解析为文件响应、路径和基础路径的对象
 */
const fetchResourceFile = async (resourceId: string, resource?: SFFSResource) => {
  // 构建资源目录路径
  const base = join(app.getPath('userData'), 'sffs_backend', 'resources')
  const filePath = join(base, resourceId)

  try {
    let extension = ''
    let newFileName = resourceId
    // 如果有资源信息，获取文件扩展名和文件名
    if (resource) {
      extension = getResourceFileExtension(resource.type)
      newFileName = getResourceFileName(SFFSMain.convertResourceToCompositeResource(resource))
    }

    // 首先尝试使用存储的资源路径
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

    // 然后尝试新路径（带有新文件名和扩展名）
    let newFilePath = join(base, extension ? `${newFileName}.${extension}` : resourceId)
    let result = await fetchFilePath(base, newFilePath)
    if (result) {
      // 如果资源路径不同，更新资源记录
      if (resource?.path !== newFilePath) {
        await migrateResourceFile(newFilePath, newFilePath, resource)
      }
      return result
    }

    // 尝试旧路径（只有资源 ID）
    const legacyFilePath = join(base, resourceId)
    result = await fetchFilePath(base, legacyFilePath)
    if (result) {
      // 迁移文件到新路径
      await migrateResourceFile(legacyFilePath, newFilePath, resource)
      return result
    }

    // 资源未找到
    return { response: new Response('Not Found', { status: 404 }), filePath, base }
  } catch (error) {
    log.error('Error fetching resource file:', error)
    return { response: new Response('Not Found', { status: 404 }), filePath, base }
  }
}

/**
 * 处理 Breakwind 资源数据请求
 * 根据资源类型提供相应的内容，对图像进行特殊处理
 * @param req 全局请求对象
 * @param resourceId 资源 ID
 * @returns Promise，解析为资源响应
 */
const handleSurfResourceDataRequest = async (req: GlobalRequest, resourceId: string) => {
  // 获取 SFFS 实例
  const sffs = useSFFSMain()
  // 读取资源信息
  const resource = await sffs?.readResource(resourceId).catch(() => null)

  // 获取资源文件
  const { response, filePath, base } = await fetchResourceFile(resourceId, resource ?? undefined)

  // 对非 GIF 图像进行特殊处理（调整大小、压缩等）
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

  // 对于非图像资源，直接返回原始响应
  return response
}

/**
 * surf-internal 协议处理器
 * 处理内部使用的 Breakwind 协议请求
 * @param req 全局请求对象
 * @returns Promise，解析为请求响应
 */
export const surfInternalProtocolHandler = async (req: GlobalRequest) => {
  return handleSurfFileRequest(req)
}

/**
 * surf 协议处理器
 * 处理外部和内部的 Breakwind 协议请求，支持直接资源访问
 * @param req 全局请求对象
 * @returns Promise，解析为请求响应
 */
export const surfProtocolHandler = async (req: GlobalRequest) => {
  try {
    // 检查是否是直接资源请求
    const id = req.url.match(/^surf:\/\/surf\/resource\/([^\/\?]+)/)?.[1]
    if (id) {
      const searchParams = new URL(req.url).searchParams
      // 如果请求原始资源（raw=true）
      if (searchParams.has('raw') && searchParams.get('raw') !== 'false') {
        return handleSurfResourceDataRequest(req, id)
      }
    }

    // 处理常规文件请求
    return handleSurfFileRequest(req)
  } catch (err) {
    log.error('surf protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * surflet 协议处理器
 * 处理 Surflet（扩展）相关的协议请求，支持 CSP 安全策略
 * @param req 全局请求对象
 * @returns Promise，解析为请求响应
 */
export const surfletProtocolHandler = async (req: GlobalRequest) => {
  try {
    // 定义内容安全策略（CSP）
    const cspPolicy =
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https://picsum.photos https://via.placeholder.com https://images.unsplash.com; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"

    // 解析 URL
    const url = new URL(req.url)

    // 验证主机名格式
    if (!url.hostname.endsWith('.app.local')) {
      return new Response('Invalid Surflet protocol URL', { status: 400 })
    }

    // 检查是否是 v2 协议
    const isV2Protocol = url.hostname.endsWith('.v2.app.local')
    const suffix = isV2Protocol ? '.v2.app.local' : '.app.local'
    // 提取资源 ID
    const id = url.hostname.replace(suffix, '')

    // 获取资源
    const sffs = useSFFSMain()
    const resource = await sffs?.readResource(id).catch(() => null)

    // 获取资源文件
    const { response } = await fetchResourceFile(id, resource ?? undefined)
    if (!response.ok) {
      return new Response('Not Found', { status: 404 })
    }

    // 读取文件内容
    const code = await response.text()

    // 设置响应头
    let headers = {
      'Content-Type': 'text/html'
    }

    // NOTE: 仅为 v2 协议添加 CSP 头
    // 这是为了不破坏不期望 CSP 的现有 surflet
    if (isV2Protocol) {
      headers['Content-Security-Policy'] = cspPolicy
    }

    // 返回带有适当头的响应
    return new Response(code, {
      headers: headers
    })
  } catch (err) {
    log.error('surflet protocol error:', err, req.url)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * 检查是否是有效的 Breakwind 协议请求
 * 验证 URL 是否符合 Breakwind 协议的格式要求
 * @param url 要检查的 URL 字符串
 * @returns 布尔值，表示是否是有效的 Breakwind 协议请求
 */
export const checkSurfProtocolRequest = (url: string) => {
  try {
    const parsed = new URL(url)
    // 检查协议是否为 surf: 并且主机名在允许列表中
    return parsed.protocol === 'surf:' && ALLOWED_HOSTNAMES.includes(parsed.hostname.toLowerCase())
  } catch {
    // 解析失败时返回 false
    return false
  }
}
