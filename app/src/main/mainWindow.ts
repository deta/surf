// 导入 Electron 主进程模块
import { app, BrowserWindow, session, screen } from 'electron'
// 导入路径处理模块
import path, { join } from 'path'
// 导入 Electron 工具库
import { is } from '@electron-toolkit/utils'
// 导入上下文菜单
import { attachContextMenu } from './contextMenu'
// 导入窗口状态管理
import { WindowState } from './winState'
// 导入广告拦截器初始化
import { initAdblocker } from './adblocker'
// 导入下载管理器初始化
import { initDownloadManager } from './downloadManager'
// 导入系统工具函数
import { isDev, isMac } from '@deta/utils/system'
// 导入格式处理工具
import { PDFViewerParams, parseURL } from '@deta/utils/formatting'

// 导入 IPC 事件定义
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'
// 导入权限处理器设置
import { setupPermissionHandlers } from './permissionHandler'
// 导入 CSP (内容安全策略) 应用函数
import { applyCSPToSession } from './csp'
// 导入应用工具函数
import {
  isAppSetup,
  normalizeElectronUserAgent,
  PDFViewerEntryPoint,
  SettingsWindowEntrypoint
} from './utils'

// 导入网络请求管理器
import { getWebRequestManager } from './webRequestManager'
// 导入文件系统写入功能
import { writeFile } from 'fs/promises'
// 导入自定义协议处理器
import {
  checkSurfProtocolRequest,
  surfInternalProtocolHandler,
  surfProtocolHandler,
  surfletProtocolHandler
} from './surfProtocolHandlers'
// 导入 WebContents 视图管理器
import { attachWCViewManager, WCViewManager } from './viewManager'
// 导入日志工具
import { useLogScope } from '@deta/utils'

// 创建日志记录器，指定作用域为 'MainWindow'
const log = useLogScope('MainWindow')

// 主窗口实例引用
let mainWindow: BrowserWindow | undefined
// WebContents 视图管理器实例引用
let viewManager: WCViewManager | undefined

// 禁用的拖拽点击功能
// electronDragClick()

/**
 * 创建应用程序的主窗口
 * 此函数是应用程序启动流程的核心部分，负责初始化和配置主窗口
 */
export function createWindow() {
  // 检查应用是否已设置，如果未设置则不允许创建主窗口
  if (!isAppSetup) {
    log.warn('App is not setup, not allowed to create main window')
    return
  }

  // 创建窗口状态管理器，用于保存和恢复窗口状态
  const winState = new WindowState(
    {
      saveImmediately: is.dev // 开发环境下立即保存状态
    },
    {
      isMaximized: true // 默认窗口最大化
    }
  )

  // 确定当前显示的显示器
  const currentDisplay =
    winState.state.x && winState.state.y
      ? screen.getDisplayMatching({
          x: winState.state.x,
          y: winState.state.y,
          width: winState.state.width,
          height: winState.state.height
        })
      : screen.getPrimaryDisplay()
  const screenBounds = currentDisplay.bounds

  // 定义边界限制函数，确保值在指定范围内
  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max)
  }

  // 设置窗口边界，使用保存的状态或默认值
  const windowBounds = {
    x: winState.state.x ?? 0,
    y: winState.state.y ?? 0,
    width: winState.state.width ?? screenBounds.width,
    height: winState.state.height ?? screenBounds.height
  }

  // 确保窗口完全在显示器可见区域内
  const boundWindow = {
    x: clamp(
      windowBounds.x,
      screenBounds.x,
      screenBounds.x + screenBounds.width - windowBounds.width
    ),
    y: clamp(
      windowBounds.y,
      screenBounds.y,
      screenBounds.y + screenBounds.height - windowBounds.height
    ),
    width: Math.min(windowBounds.width, screenBounds.width),
    height: Math.min(windowBounds.height, screenBounds.height)
  }

  // 创建主窗口专用的会话，使用持久化存储
  const mainWindowSession = session.fromPartition('persist:surf-app-session')

  // 创建主窗口实例并配置窗口参数
  mainWindow = new BrowserWindow({
    // 窗口尺寸和位置
    width: boundWindow.width,
    height: boundWindow.height,
    minWidth: 542, // 最小宽度限制
    minHeight: 330, // 最小高度限制
    x: boundWindow.x,
    y: boundWindow.y,
    fullscreen: winState.state.isFullScreen,
    fullscreenable: true,
    show: false, // 最初隐藏窗口，在ready-to-show事件后显示
    autoHideMenuBar: true, // 自动隐藏菜单栏
    frame: isMac() ? false : true, // Mac上使用无框窗口，其他平台使用标准窗口
    titleBarStyle: 'hidden', // 隐藏标准标题栏
    // ...(isLinux() ? { icon } : {}), // Linux平台的图标设置（当前已注释）
    trafficLightPosition: { x: 15, y: 13.5 }, // Mac上交通灯按钮的位置
    webPreferences: {
      // 预加载脚本
      preload: join(__dirname, '../preload/core.js'),
      // 传递给渲染进程的额外参数
      additionalArguments: [
        `--userDataPath=${app.getPath('userData')}`, // 用户数据路径
        `--appPath=${app.getAppPath()}${isDev ? '' : '.unpacked'}`, // 应用路径
        `--pdf-viewer-entry-point=${PDFViewerEntryPoint}`, // PDF查看器入口点
        `--settings-window-entry-point=${SettingsWindowEntrypoint}`, // 设置窗口入口点
        ...(process.env.ENABLE_DEBUG_PROXY ? ['--enable-debug-proxy'] : []), // 调试代理开关
        ...(process.env.DISABLE_TAB_SWITCHING_SHORTCUTS
          ? ['--disable-tab-switching-shortcuts']
          : []) // 标签切换快捷键开关
      ],
      // 启用webview标签
      webviewTag: true,
      // 安全设置
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      // 使用自定义会话
      session: mainWindowSession,
      // 字体和拼写检查设置
      defaultFontSize: 14,
      spellcheck: isMac(), // 仅在Mac上启用拼写检查
      // 启用额外的Blink特性
      enableBlinkFeatures: 'CSSLayoutAPI'
    }
  })

  // 创建WebView专用的会话，使用持久化存储
  const webviewSession = session.fromPartition('persist:horizon')
  // 标准化webview的User-Agent（非Google服务）
  const webviewSessionUserAgent = normalizeElectronUserAgent(webviewSession.getUserAgent(), false)
  // 标准化webview的User-Agent（针对Google服务的特殊处理）
  const webviewSessionUserAgentGoogle = normalizeElectronUserAgent(
    webviewSession.getUserAgent(),
    true
  )
  // 获取网络请求管理器实例
  const webRequestManager = getWebRequestManager()

  // 创建请求头映射管理器，用于存储和检索请求头信息
  const requestHeaderMap = (() => {
    const MAP_MAX_SIZE = 50 // 映射的最大大小限制
    // 存储请求ID到请求信息的映射
    const map: Map<number, { url: string; headers: Record<string, string> }> = new Map()

    return {
      map,
      // 设置请求头信息，自动管理映射大小
      set: (id: number, url: string, headers: Record<string, string>) => {
        // 如果映射达到最大大小，删除最早的条目
        if (map.size >= MAP_MAX_SIZE) {
          map.delete(map.keys().next().value as number)
        }
        map.set(id, { url, headers })
      },
      // 获取并删除指定ID的请求头信息
      pop: (id: number) => {
        const headers = map.get(id)
        map.delete(id)
        return headers
      }
    }
  })()

  // 添加请求拦截处理器，用于安全检查和请求过滤
  webRequestManager.addBeforeRequest(webviewSession, (details, callback) => {
    // 检查请求协议类型
    const isSurfProtocol = details.url.startsWith('surf:')
    const isSurfletProtocol = details.url.startsWith('surflet:')
    const isInternalPageRequest = details.url.startsWith('surf-internal:')

    // 检查请求资源类型和上下文
    const isMainFrameRequest = details.resourceType === 'mainFrame'
    const urlString = details.webContents && details.webContents.getURL()
    const url = urlString ? new URL(urlString) : null

    // 注释掉的查看器URL检查
    // const isPDFViewerRequest = url && isInternalViewerURL(url, PDFViewerEntryPoint)
    // const isNotebookViewerRequest = url && isInternalViewerURL(url, NotebookViewerEntryPoint)
    // const isResourceViewerRequest = url && isInternalViewerURL(url, ResourceViewerEntryPoint)

    // 确定是否需要阻止surf协议请求
    const shouldBlockSurfRequest =
      isSurfProtocol && !(checkSurfProtocolRequest(details.url) || isMainFrameRequest)

    // 确定是否需要阻止surflet协议请求
    const shouldBlockSurfletRequest =
      isSurfletProtocol && (!isMainFrameRequest || !details.webContents)

    // 确定是否需要阻止内部页面请求
    const shouldBlockInternalRequest =
      isInternalPageRequest && (!isMainFrameRequest || !details.webContents)

    // 综合判断是否阻止请求
    const shouldBlock =
      shouldBlockSurfRequest || shouldBlockSurfletRequest || shouldBlockInternalRequest

    if (shouldBlock) {
      // 详细日志记录（当前已注释）
      // log.warn('Blocking request:', details.url, url, {
      //   shouldBlockSurfRequest,
      //   shouldBlockSurfletRequest,
      //   shouldBlockInternalRequest
      // })

      // 记录被阻止的请求
      log.warn('Blocked request:', details.url, url, details.frame, details.webContents?.id)
    }

    // 执行请求阻止或继续
    callback({ cancel: shouldBlock })
  })

  // 添加请求发送前的处理器，用于修改请求头
  webRequestManager.addBeforeSendHeaders(webviewSession, (details, callback) => {
    const { requestHeaders, url, id } = details
    const parsedURL = new URL(url)

    // 特殊网站检测
    const isTwitch = parsedURL.hostname === 'twitch.tv' || parsedURL.hostname.endsWith('.twitch.tv')
    const isGoogleAccounts = parsedURL.hostname === 'accounts.google.com'

    // 为不同网站设置不同的User-Agent
    if (!isTwitch) {
      requestHeaders['User-Agent'] = isGoogleAccounts
        ? webviewSessionUserAgentGoogle // Google账户使用特定的User-Agent
        : webviewSessionUserAgent // 其他网站使用标准的User-Agent
    }

    // 保存请求头信息以供后续使用
    requestHeaderMap.set(id, url, { ...requestHeaders })

    // 继续请求并应用修改后的请求头
    callback({ requestHeaders })
  })

  // 添加响应头接收处理器，用于处理特殊响应（如PDF文件）
  webRequestManager.addHeadersReceived(webviewSession, (details, callback) => {
    // 只处理主框架请求，忽略子资源请求
    if (details.resourceType !== 'mainFrame') {
      callback({ cancel: false })
      return
    }

    // 获取指定名称的响应头值（忽略大小写）
    const getHeaderValue = (headerName: string): string[] | undefined => {
      if (!details.responseHeaders) return
      const key = Object.keys(details.responseHeaders || {}).find(
        (k) => k.toLowerCase() === headerName.toLowerCase()
      )
      return key ? details.responseHeaders[key] : undefined
    }

    // 从Content-Disposition头中提取文件名
    const getFilename = (header: string | undefined): string | undefined => {
      if (!header) return
      const filenameMatch = header.match(/filename\*?=['"]?(?:UTF-\d['"])?([^"';]+)['"]?/i)
      return filenameMatch ? decodeURIComponent(filenameMatch[1]) : undefined
    }

    // 加载PDF查看器的函数
    const loadPDFViewer = (params: Partial<PDFViewerParams>) => {
      // 构建URL参数
      const searchParams = new URLSearchParams()
      searchParams.set('path', params.path!)
      if (params.pathOverride) searchParams.set('pathOverride', params.pathOverride)
      if (params.loading) searchParams.set('loading', 'true')
      if (params.error) searchParams.set('error', params.error)
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.filename) searchParams.set('filename', params.filename)

      // 检查是否有有效的webContentsId
      if (!details.webContentsId) {
        log.error('No webContentsId for PDF viewer load request')
        return
      }

      // 构建完整URL并加载PDF查看器
      const url = `${PDFViewerEntryPoint}?${searchParams}`
      const view = viewManager?.getViewByWebContentsId(details.webContentsId)
      if (view) {
        view.loadURL(url)
      } else {
        details.webContents?.loadURL(url)
      }
    }

    // 分析响应头以确定内容类型和文件名
    const contentTypeHeader = getHeaderValue('content-type')
    const dispositionHeader = getHeaderValue('content-disposition')
    const isPDF = contentTypeHeader?.[0]?.includes('application/pdf') ?? false
    const isAttachment = dispositionHeader?.[0]?.toLowerCase().includes('attachment') ?? false
    const filename = getFilename(dispositionHeader?.[0])

    // 获取请求数据并解析URL
    const requestData = requestHeaderMap.pop(details.id)
    const url = parseURL(requestData?.url ?? details.url)

    if (!url) {
      callback({ cancel: false })
      return
    }

    // 处理自定义surf协议的请求
    if (url.protocol === 'surf:') {
      if (isPDF) {
        // 对于PDF内容，使用内置查看器
        callback({ cancel: true })
        loadPDFViewer({ path: details.url, filename })
      } else {
        // 处理资源和笔记本的特殊路由
        if (url.hostname === 'resource') {
          callback({ cancel: true })
          details.webContents?.loadURL(`surf://surf/resource/${url.pathname.slice(1)}`)
        } else if (url.hostname === 'notebook') {
          callback({ cancel: true })
          details.webContents?.loadURL(`surf://surf/notebook/${url.pathname.slice(1)}`)
        } else {
          callback({ cancel: false })
        }
      }

      return
    }

    // 处理常规HTTP(S)请求中的PDF文件（非附件）
    if (isPDF && !isAttachment) {
      callback({ cancel: true })

      // 获取请求数据和URL
      const requestData = requestHeaderMap.pop(details.id)
      // 创建临时文件路径
      const tmpFile = join(app.getPath('temp'), crypto.randomUUID())
      const url = requestData?.url ?? details.url

      // 先显示加载状态
      loadPDFViewer({ path: details.url, loading: true, filename })

      // 下载PDF文件并在本地打开
      fetch(url, {
        headers: requestData?.headers,
        credentials: 'include' // 包含凭证以支持需要登录的PDF
      })
        .then(async (resp) => {
          // 保存文件到临时目录
          const buffer = await resp.arrayBuffer()
          await writeFile(tmpFile, Buffer.from(buffer))
          // 使用本地文件路径加载PDF
          loadPDFViewer({
            path: details.url,
            pathOverride: `file://${tmpFile}`,
            filename
          })
        })
        .catch((err) => {
          // 处理下载错误
          loadPDFViewer({
            path: details.url,
            error: String(err),
            filename
          })
        })
      return
    }

    // 所有其他情况，允许请求继续
    callback({ cancel: false })
  })

  try {
    webviewSession.protocol.handle('surf', surfProtocolHandler)
    webviewSession.protocol.handle('surflet', surfletProtocolHandler)
    mainWindowSession.protocol.handle('surf', surfProtocolHandler)
    mainWindowSession.protocol.handle('surf-internal', surfInternalProtocolHandler)
  } catch (e) {
    log.error('possibly failed to register surf protocol: ', e)
  }

  // 应用内容安全策略(CSP)到主窗口会话
  applyCSPToSession(mainWindowSession)

  // 设置权限处理器，用于管理和控制WebView的权限请求
  // TODO: 将这些功能通过IPC暴露给渲染进程，以便用户可以修改当前缓存状态
  //@ts-ignore
  const { clearSessionPermissions, clearAllPermissions, removePermission } =
    setupPermissionHandlers(webviewSession)

  // 初始化广告拦截器和下载管理器
  // TODO: 实现更好的会话管理？
  initAdblocker('persist:horizon')
  initDownloadManager('persist:horizon')

  // 使用窗口状态管理器管理主窗口的状态（最大化、位置、尺寸等）
  winState.manage(mainWindow)

  // 确保窗口在显示时获得正确的焦点（使用延时的hack方法）
  mainWindow.on('show', () => {
    setTimeout(() => {
      mainWindow?.focus()
    }, 200)
  })

  // 窗口准备好显示时的处理函数
  mainWindow.on('ready-to-show', () => {
    // 重置缩放级别和因子，限制视觉缩放级别范围
    mainWindow?.webContents.setZoomLevel(0)
    mainWindow?.webContents.setZoomFactor(1.0)
    mainWindow?.webContents.setVisualZoomLevelLimits(1, 1)

    // 根据保存的状态或开发环境决定窗口显示方式
    if (winState.state.isMaximized) {
      mainWindow?.maximize()
    } else if (!is.dev) {
      mainWindow?.showInactive() // 生产环境下先非活动状态显示
    } else {
      mainWindow?.show() // 开发环境下直接显示
    }
  })

  // mainWindow.on('enter-full-screen', () => {
  //   getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: true })
  // })

  // mainWindow.on('leave-full-screen', () => {
  //   getMainWindow()?.webContents.send('fullscreen-change', { isFullscreen: false })
  // })

  // 附加WebContents视图管理器到主窗口
  viewManager = attachWCViewManager(mainWindow)

  // 监听视图创建事件，为新创建的视图设置处理器
  viewManager.on('create', (view) => {
    setupWebContentsViewWebContentsHandlers(view.wcv.webContents)
  })

  // 为主窗口的WebContents设置处理器
  setupMainWindowWebContentsHandlers(mainWindow.webContents, viewManager)

  // 注释掉的开发环境加载URL的代码
  // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  //   mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/Core/core.html`)
  // } else {
  //   mainWindow.loadFile(join(__dirname, '../renderer/Core/core.html'))
  // }

  // 加载应用的核心页面（使用自定义协议）
  mainWindow.loadURL('surf-internal://Core/Core/core.html')
}

// 获取主窗口实例的函数
export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow
}

// 获取所有WebContents视图的函数
export function getWebContentsViews() {
  return viewManager?.getWebContentsViews() ?? []
}

function setupMainWindowWebContentsHandlers(
  contents: Electron.WebContents,
  viewManager: WCViewManager
) {
  // Prevent direct navigation in the main window by handling the `will-navigate`
  // event and the `setWindowOpenHandler`. The main window should only host the SPA
  // Breakwind frontend and not navigate away from it. Any requested navigations should
  // be handled within the frontend.
  contents.on('will-navigate', (event) => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        url: event.url,
        disposition: 'foreground-tab'
        // we are explicitly not sending the webContentsId here
      })
    }

    event.preventDefault()
  })

  contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    const mainWindow = getMainWindow()

    if (!mainWindow) {
      return { action: 'deny' }
    }

    return {
      action: 'allow',
      outlivesOpener: true,
      createWindow: ({ webPreferences, ...constructorOptions }) => {
        log.log('Window open handler called with details:', details, constructorOptions)

        const componentId = details.features?.match(/componentId=([^;]+)/)?.[1]

        // IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
        //   url: details.url,
        //   disposition: details.disposition
        //   // we are explicitly not sending the webContentsId here
        // })

        const view = viewManager.createOverlayView(
          {
            id: componentId,
            overlayId: componentId
          },
          { ...constructorOptions, webPreferences }
        )

        return view.wcv.webContents
      }
    }
  })

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    webPreferences.webSecurity = !isDev
    webPreferences.sandbox = true
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = path.resolve(__dirname, '../preload/webcontents.js')
    webPreferences.spellcheck = isMac()
    webPreferences.additionalArguments = [`--pdf-viewer-entry-point=${PDFViewerEntryPoint}`]
  })

  // Handle navigation requests within webviews:
  // 1. Set up a window open handler for each webview when it's attached.
  // 2. Send navigation requests to the main window renderer (Breakwind preload) for handling.
  // 3. Allow opening new windows but deny other requests, and handle them within the renderer.
  contents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
      // If there is a frame name or features provided we assume the request
      // is part of a auth flow and we create a new isolated window for it
      const shouldCreateWindow =
        details.disposition === 'new-window' &&
        (details.frameName !== '' || details.features !== '')

      if (shouldCreateWindow) {
        // IMPORTANT NOTE: DO NOT expose any sort of Node.js capabilities to the newly
        // created window here. The creation of it is controlled from the renderer. Because
        // of this, Breakwind won't play well with websites that for some reason utilizes more
        // than one window. In the future, Each new window we create should receive its own
        // instance of Breakwind.
        return {
          action: 'allow',
          createWindow: undefined,
          outlivesOpener: false,
          overrideBrowserWindowOptions: {
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true
            }
          }
        }
      }

      const url = new URL(details.url)
      if (
        url.protocol === 'surf:' ||
        url.protocol === 'surflet:' ||
        url.protocol === 'surf-internal:'
      ) {
        return { action: 'deny' }
      }

      const mainWindow = getMainWindow()
      if (mainWindow) {
        IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
          url: details.url,
          disposition: details.disposition,
          webContentsId: contents.id
        })
      }

      return { action: 'deny' }
    })

    attachContextMenu(contents)
  })
}

function setupWebContentsViewWebContentsHandlers(contents: Electron.WebContents) {
  contents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    try {
      log.log('WebContentsView Window open handler called with details:', details)
      // If there is a frame name or features provided we assume the request
      // is part of a auth flow and we create a new isolated window for it
      const shouldCreateWindow =
        details.disposition === 'new-window' &&
        (details.frameName !== '' || details.features !== '')

      if (shouldCreateWindow) {
        // IMPORTANT NOTE: DO NOT expose any sort of Node.js capabilities to the newly
        // created window here. The creation of it is controlled from the renderer. Because
        // of this, Breakwind won't play well with websites that for some reason utilizes more
        // than one window. In the future, Each new window we create should receive its own
        // instance of Breakwind.
        return {
          action: 'allow',
          createWindow: undefined,
          outlivesOpener: false,
          overrideBrowserWindowOptions: {
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true
            }
          }
        }
      }

      const url = new URL(details.url)
      if (
        url.protocol === 'surf:' ||
        url.protocol === 'surflet:' ||
        url.protocol === 'surf-internal:'
      ) {
        log.warn('[main] Denied new window request:', details)
        return { action: 'deny' }
      }

      const mainWindow = getMainWindow()
      if (mainWindow) {
        log.log(
          '[main] Sending new window request to main window:',
          contents.id,
          details.url,
          details.disposition
        )
        IPC_EVENTS_MAIN.newWindowRequest.sendToWebContents(mainWindow.webContents, {
          url: details.url,
          disposition: details.disposition,
          webContentsId: contents.id
        })
      } else {
        log.warn('[main] No main window, cannot send new window request:', details)
      }

      return { action: 'deny' }
    } catch (error) {
      log.error('Error in setWindowOpenHandler:', error)
      return { action: 'deny' }
    }
  })

  attachContextMenu(contents)

  contents.on('will-attach-webview', (_event, webPreferences, _params) => {
    webPreferences.webSecurity = !isDev
    webPreferences.sandbox = true
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.preload = path.resolve(__dirname, '../preload/webcontents.js')
    webPreferences.spellcheck = isMac()
    webPreferences.additionalArguments = [`--pdf-viewer-entry-point=${PDFViewerEntryPoint}`]
  })
}
