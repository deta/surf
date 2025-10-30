// 导入 Electron 核心模块
import { app, BrowserWindow, protocol } from 'electron'
// 导入 Electron 工具库
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
// 导入文件系统相关的异步函数
import { readdir, unlink, stat } from 'fs/promises'
// 导入路径处理相关函数
import { join, dirname } from 'path'
// 导入文件系统同步函数
import { mkdirSync } from 'fs'
// 导入系统环境检测工具
import { isDev, isMac, isWindows } from '@deta/utils/system'
// 导入主进程 IPC 事件常量
import { IPC_EVENTS_MAIN } from '@deta/services/ipc'

// 导入窗口管理相关函数
import { createWindow, getMainWindow } from './mainWindow'
// 导入应用菜单设置函数
import { setAppMenu } from './appMenu'
// 导入快捷键注册/注销函数
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
// 导入广告拦截器设置函数
import { setupAdblocker } from './adblocker'
// 导入 IPC 通信相关函数
import { ipcSenders, setupIpc } from './ipcHandlers'
// 导入用户配置相关函数
import { getUserConfig, updateUserConfig } from './config'
// 导入应用工具函数
import { isAppSetup, isDefaultBrowser, markAppAsSetup } from './utils'
// 导入后端服务管理器
import { SurfBackendServerManager } from './surfBackend'
// 导入崩溃处理器
import { CrashHandler } from './crashHandler'
// 导入 Breakwind 协议 URL 处理器
// import { surfProtocolExternalURLHandler } from './surfProtocolHandlers'
// 导入日志工具
import { useLogScope } from '@deta/utils'
// 导入文件系统主进程初始化函数
import { initializeSFFSMain } from './sffs'

// 创建主进程日志实例
const log = useLogScope('Main')

// 应用全局配置
const CONFIG = {
  // 应用名称，从环境变量获取，默认为 'Breakwind'
  appName: import.meta.env.M_VITE_PRODUCT_NAME || 'Breakwind',
  // 应用版本
  appVersion: import.meta.env.M_VITE_APP_VERSION,
  // 是否使用临时数据目录
  useTmpDataDir: import.meta.env.M_VITE_USE_TMP_DATA_DIR === 'true',
  // 是否禁用自动更新
  disableAutoUpdate: import.meta.env.M_VITE_DISABLE_AUTO_UPDATE === 'true',
  // 嵌入模型模式
  embeddingModelMode: import.meta.env.M_VITE_EMBEDDING_MODEL_MODE || 'default',
  // 是否强制创建设置窗口
  forceSetupWindow: import.meta.env.M_VITE_CREATE_SETUP_WINDOW === 'true',
  // Sentry 错误监控 DSN
  sentryDSN: import.meta.env.M_VITE_SENTRY_DSN,
  // 应用更新代理 URL
  appUpdatesProxyUrl: import.meta.env.M_VITE_APP_UPDATES_PROXY_URL,
  // 应用更新频道
  appUpdatesChannel: import.meta.env.M_VITE_APP_UPDATES_CHANNEL,
  // 公告 URL
  announcementsUrl: import.meta.env.M_VITE_ANNOUNCEMENTS_URL
}

// 应用状态标志
let isAppLaunched = false
// 应用通过 URL 打开时的 URL
let appOpenedWithURL: string | null = null
// 后端服务管理器实例
let surfBackendManager: SurfBackendServerManager | null = null

/**
 * 清理临时文件
 * 删除超过 24 小时未修改的临时文件，防止磁盘空间占用过大
 */
async function cleanupTempFiles() {
  try {
    // 获取应用临时目录中的文件列表
    const files = await readdir(join(app.getPath('temp'), CONFIG.appName))
    const now = Date.now()
    // 并行处理所有文件
    await Promise.all(
      files.map((file) =>
        stat(join(app.getPath('temp'), CONFIG.appName, file))
          .then((stats) => {
            // 检查文件是否超过 24 小时未修改
            if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
              // 删除过期文件
              return unlink(join(app.getPath('temp'), CONFIG.appName, file))
            }
            return Promise.resolve()
          })
          .catch(() => {})
      )
    )
  } catch {}
}

/**
 * 初始化应用路径
 * 根据配置决定用户数据存储位置，并创建必要的目录结构
 * @returns 初始化后的用户数据路径
 */
const initializePaths = () => {
  // 根据配置决定用户数据路径
  const userDataPath = CONFIG.useTmpDataDir
    ? join(app.getPath('temp'), CONFIG.appVersion || '', CONFIG.appName)
    : join(dirname(app.getPath('userData')), CONFIG.appName)
  // 创建目录（如果不存在）
  mkdirSync(userDataPath, { recursive: true })
  // 设置应用的用户数据路径
  app.setPath('userData', userDataPath)
  return userDataPath
}

/**
 * 注册自定义协议
 * 设置应用为 'surf' 协议的默认客户端，并注册其他自定义协议
 */
const registerProtocols = () => {
  // 设置应用为 'surf' 协议的默认客户端
  app.setAsDefaultProtocolClient('surf')

  // 注册具有特权的协议
  protocol.registerSchemesAsPrivileged([
    {
      // 主要的 surf 协议，用于外部调用
      scheme: 'surf',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        secure: true,
        corsEnabled: true,
        stream: true
      }
    },
    {
      // 内部使用的 surf 协议
      scheme: 'surf-internal',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        allowServiceWorkers: true,
        secure: true,
        corsEnabled: true,
        bypassCSP: true,
        stream: true
      }
    },
    {
      // surflet 协议，用于处理扩展
      scheme: 'surflet',
      privileges: {
        standard: true,
        supportFetchAPI: true,
        secure: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

/**
 * 处理 URL 打开请求
 * 当应用通过 URL 打开时，确保正确处理该 URL
 * @param url 要打开的 URL
 */
const handleOpenUrl = (url: string) => {
  try {
    // 检查应用是否已设置完成
    if (!isAppSetup) {
      log.warn('App not setup yet, cannot handle open URL')
      return
    }

    // 获取主窗口实例
    const mainWindow = getMainWindow()

    // 检查主窗口是否存在且未被销毁
    if (!mainWindow || mainWindow?.isDestroyed()) {
      log.warn('No main window found')
      // 如果没有窗口，则创建一个新窗口
      if (BrowserWindow.getAllWindows().length === 0) {
        IPC_EVENTS_MAIN.appReady.once(() => handleOpenUrl(url))
        createWindow()
      } else {
        log.error('There are windows, but no main window')
      }
      return
    }

    // 恢复最小化的窗口并聚焦
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()

    // 通过 IPC 发送 URL 到渲染进程
    IPC_EVENTS_MAIN.openURL.sendToWebContents(mainWindow.webContents, { url, active: true })
  } catch (error) {
    log.error('Error handling open URL:', error)
  }
}

/**
 * 设置后端服务
 * 初始化并启动 Breakwind 后端服务进程，配置相关事件监听器
 * @param appPath 应用路径
 * @param backendRootPath 后端根路径
 * @param userConfig 用户配置
 */
const setupBackendServer = async (appPath: string, backendRootPath: string, userConfig: any) => {
  // 构建后端服务可执行文件路径
  const backendServerPath = join(
    appPath,
    'resources',
    'bin',
    // 根据开发/生产环境和操作系统选择不同的可执行文件名
    `surf-backend${isDev ? '-dev' : ''}${isWindows() ? '.exe' : ''}`
  )

  // 创建后端服务管理器实例
  surfBackendManager = new SurfBackendServerManager(backendServerPath, [
    backendRootPath,
    'false',
    // 开发环境使用配置中的嵌入模型模式，生产环境使用用户配置中的嵌入模型
    isDev ? CONFIG.embeddingModelMode : userConfig.settings?.embedding_model
  ])

  // 配置后端服务日志事件监听器
  surfBackendManager
    .on('stdout', (data) => log.info('[backend:stdout] ', data))
    .on('stderr', (data) => log.error('[backend:stderr]', data))
    .on('error', (error) => log.error('[backend:error ]', error))
    .on('warn', (msg) => log.warn('[backend:warn  ]', msg))
    .on('info', (msg) => log.info('[backend:info  ]', msg))
    .on('exit', (code) => log.info('[backend:exit  ] code:', code))
    .on('signal', (signal) => log.info('[backend:signal] signal:', signal))

  // 配置后端服务状态变化事件监听器
  surfBackendManager
    ?.on('ready', () => {
      // 后端服务就绪时，通知渲染进程
      const webContents = getMainWindow()?.webContents
      if (webContents) IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, true)
    })
    .on('close', () => {
      // 后端服务关闭时，通知渲染进程
      const webContents = getMainWindow()?.webContents
      if (webContents) IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, false)
    })

  // 应用就绪时，发送后端健康状态
  IPC_EVENTS_MAIN.appReady.on(() => {
    if (surfBackendManager) {
      const webContents = getMainWindow()?.webContents
      if (webContents)
        IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(
          webContents,
          surfBackendManager.isHealthy
        )
    }
  })

  // 启动后端服务
  surfBackendManager.start()
  // 等待后端服务启动完成
  await surfBackendManager.waitForStart()

  // 初始化 SFFS (Breakwind File System)
  initializeSFFSMain()
}

/**
 * 初始化应用
 * 执行应用启动的主要初始化流程
 */
const initializeApp = async () => {
  // 记录应用启动信息
  log.log('initilizing app', is.dev ? 'in development mode' : 'in production mode')

  // 标记应用已启动
  isAppLaunched = true
  // 设置定时清理临时文件任务（每小时执行一次）
  setInterval(cleanupTempFiles, 60 * 60 * 1000)
  // 设置应用用户模型 ID
  electronApp.setAppUserModelId('ea.browser.deta.surf')

  // 构建路径
  const appPath = app.getAppPath() + (isDev ? '' : '.unpacked')
  const userDataPath = app.getPath('userData')
  const backendRootPath = join(userDataPath, 'sffs_backend')
  // 获取用户配置
  const userConfig = getUserConfig()

  // 设置 IPC 通信
  setupIpc(backendRootPath)

  // 开发模式特定配置
  if (isDev) {
    log.log('Running in development mode, setting app icon to dev icon')
    app.dock?.setIcon(join(app.getAppPath(), 'build/resources/dev/icon.png'))
  }

  // 标记应用已设置完成
  markAppAsSetup()
  // 设置广告拦截器
  await setupAdblocker()
  // 设置应用菜单
  setAppMenu()

  // 创建主窗口
  createWindow()

  // 启动后端服务
  try {
    await setupBackendServer(appPath, backendRootPath, userConfig)
  } catch (err) {
    log.error(`failed to start the surf backend process: ${err}`)
  }

  // 应用就绪事件处理
  IPC_EVENTS_MAIN.appReady.once(async () => {
    // 检查并更新默认浏览器状态
    const appIsDefaultBrowser = await isDefaultBrowser()
    if (userConfig.defaultBrowser !== appIsDefaultBrowser) {
      updateUserConfig({ defaultBrowser: appIsDefaultBrowser })
    }

    // 处理通过 URL 打开的情况
    if (appOpenedWithURL) {
      handleOpenUrl(appOpenedWithURL)
    }

    // 发送后端健康状态
    const webContents = getMainWindow()?.webContents
    const isHealthy = surfBackendManager?.isHealthy
    if (webContents && isHealthy)
      IPC_EVENTS_MAIN.setSurfBackendHealth.sendToWebContents(webContents, isHealthy)

    // 显示更新日志（如果配置了）
    if (userConfig.show_changelog) {
      ipcSenders.openChangelog()
      updateUserConfig({ show_changelog: false })
    }
  })

  // 初始化崩溃处理器
  const mainWindow = getMainWindow()
  if (mainWindow) {
    const crashHandler = CrashHandler.getInstance()
    crashHandler.initialize(mainWindow)
  }
}

/**
 * 设置应用程序
 * 配置应用程序的基本设置和事件监听器
 */
const setupApplication = () => {
  // 初始化应用路径
  initializePaths()

  // 请求单实例锁，确保只运行一个应用实例
  const gotTheLock = app.requestSingleInstanceLock()

  // 如果无法获取锁（已有实例运行），则退出
  if (!gotTheLock) {
    app.quit()
    return
  }

  // 检查命令行参数中是否有 URL
  appOpenedWithURL =
    process.argv.find((arg) => arg.startsWith('http://') || arg.startsWith('https://')) ?? null

  // 配置窗口相关事件监听器
  app
    // 窗口失去焦点时注销快捷键
    .on('browser-window-blur', unregisterShortcuts)
    // 窗口获得焦点时注册快捷键
    .on('browser-window-focus', registerShortcuts)
    // 通知渲染进程窗口焦点状态变化
    .on('browser-window-blur', () => ipcSenders.browserFocusChanged('unfocused'))
    .on('browser-window-focus', () => ipcSenders.browserFocusChanged('focused'))
    // 处理第二个实例启动事件
    .on('second-instance', (_event, commandLine) => handleOpenUrl(commandLine.pop() ?? ''))
    // 为新创建的窗口优化快捷键
    .on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    // 所有窗口关闭时的处理
    .on('window-all-closed', () => {
      unregisterShortcuts()
      // 在非 Mac 系统上退出应用
      if (!isMac()) app.quit()
    })

  // 配置应用程序生命周期事件
  app
    // 处理通过 URL 打开应用的情况
    .on('open-url', (_event, url) =>
      isAppLaunched ? handleOpenUrl(url) : (appOpenedWithURL = url)
    )
    // 在 macOS 上点击 dock 图标时重新创建窗口
    .on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
    // 应用即将退出时的清理工作
    .on('will-quit', async () => {
      // 停止后端服务
      surfBackendManager?.stop()
      // 清理临时文件
      await cleanupTempFiles()
    })

  // 注册自定义协议
  registerProtocols()
  // 应用就绪后初始化
  app.whenReady().then(initializeApp)
}

// 启动应用程序设置
setupApplication()
