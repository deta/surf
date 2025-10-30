// 导入 Electron 主进程模块，用于创建窗口和应用程序管理
import { app, BrowserWindow, dialog, WebContents } from 'electron'
// 导入日志工具，用于记录错误和调试信息
import { useLogScope } from '@deta/utils'

/**
 * CrashHandler 的配置接口
 * TODO: 优化配置项定义
 */
interface CrashHandlerConfig {}

/**
 * 崩溃处理器类 - 单例模式实现
 * 用于统一管理应用程序中的各种错误和崩溃情况，提供友好的用户提示和日志记录
 */
export class CrashHandler {
  // 单例实例
  private static instance: CrashHandler
  // 日志记录器，作用域为 'Crash Handler'
  private log = useLogScope('Crash Handler')
  // 主窗口引用，用于显示错误对话框
  private mainWindow: BrowserWindow | null = null
  // 配置对象
  private config: Required<CrashHandlerConfig>
  // 主界面内容的 ID，用于区分主界面崩溃和 webview 崩溃
  private mainContentsId: number | null = null

  /**
   * 私有构造函数，防止外部直接实例化
   */
  private constructor() {
    this.config = {}
  }

  /**
   * 获取 CrashHandler 的单例实例
   * @returns CrashHandler 实例
   */
  public static getInstance(): CrashHandler {
    if (!CrashHandler.instance) {
      CrashHandler.instance = new CrashHandler()
    }
    return CrashHandler.instance
  }

  /**
   * 判断是否应该显示错误信息
   * 只有在非正常退出的情况下才显示错误
   * @param details 渲染进程崩溃的详细信息
   * @returns 是否应该显示错误
   */
  private shouldShowError(details: Electron.RenderProcessGoneDetails): boolean {
    if (!details || !details.reason) {
      return false
    }
    return details.reason !== 'clean-exit'
  }

  /**
   * 显示错误消息对话框
   * @param browserWindow 要显示对话框的窗口
   * @param message 错误消息标题
   * @param detail 错误消息详情
   * @param buttons 对话框按钮选项
   * @param type 错误类型（error 或 warning）
   * @returns 用户选择的按钮索引
   */
  private async showErrorMessage(
    browserWindow: BrowserWindow,
    message: string,
    detail?: string,
    buttons: string[] = ['OK'],
    type: 'error' | 'warning' = 'error'
  ): Promise<{ response: number }> {
    return dialog.showMessageBox(browserWindow, {
      title: type === 'error' ? 'Error' : 'Warning',
      type,
      message,
      detail,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1
    })
  }

  /**
   * 记录渲染进程错误
   * 收集详细的错误信息，包括错误原因、退出码、页面URL等
   * @param msg 错误消息
   * @param details 渲染进程崩溃的详细信息
   * @param webContents 相关的WebContents对象
   */
  private logRendererError(
    msg: string,
    details: Electron.RenderProcessGoneDetails,
    webContents?: WebContents
  ) {
    this.log.error(msg, {
      reason: details.reason,
      exitCode: details.exitCode,
      webContentsId: webContents?.id,
      url: webContents?.getURL(),
      title: webContents?.getTitle(),
      isDestroyed: webContents?.isDestroyed(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 处理Webview崩溃
   * 显示提示对话框，允许用户关闭或重新加载页面
   * @param webContents 崩溃的WebContents对象
   */
  private async handleWebviewCrash(webContents: WebContents) {
    if (this.mainWindow) {
      const response = await this.showErrorMessage(
        this.mainWindow,
        'Website Failed to Load',
        'The webpage has crashed. Would you like to close or reload it?',
        ['Close Page', 'Reload'],
        'warning'
      )
      if (!webContents.isDestroyed()) {
        switch (response.response) {
          // TODO: 发送IPC事件给标签管理器，使用webContentsId关闭标签页
          // NOTE: 如果webview是surflet或嵌入式webview等，需要特别处理
          case 0:
            webContents.close()
            break
          case 1:
            webContents.reload()
            break
        }
      }
    }
  }

  /**
   * 判断WebContents是否为webview类型
   * @param webContents WebContents对象
   * @returns 是否为webview
   */
  private isWebviewContents(webContents: WebContents): boolean {
    return webContents.getType() === 'webview'
  }

  /**
   * 判断WebContents是否为主界面内容
   * @param webContents WebContents对象
   * @returns 是否为主界面内容
   */
  private isMainUIContents(webContents: WebContents): boolean {
    return webContents.id === this.mainContentsId
  }

  /**
   * 注册WebContents相关事件监听
   * 处理无响应、恢复响应和插件崩溃等情况
   * @param webContents WebContents对象
   */
  private registerWebContentsEvents(webContents: WebContents) {
    // 处理页面无响应情况
    webContents.on('unresponsive', async () => {
      this.log.warn('WebContents unresponsive:', {
        id: webContents.id,
        url: webContents.getURL(),
        title: webContents.getTitle()
      })

      if (this.mainWindow) {
        const response = await this.showErrorMessage(
          this.mainWindow,
          'Webpage Unresponsive',
          'The webpage is not responding. Would you like to wait or close it?',
          ['Wait', 'Close Tab', 'Reload'],
          'warning'
        )
        if (!webContents.isDestroyed()) {
          switch (response.response) {
            case 1: // 用户选择关闭标签
              webContents.close()
              break
            case 2: // 用户选择重新加载
              webContents.reload()
              break
          }
        }
      }
    })

    // 处理页面恢复响应的情况
    webContents.on('responsive', () => {
      this.log.info('WebContents recovered:', {
        id: webContents.id,
        url: webContents.getURL()
      })
    })

    // 处理插件崩溃的情况
    webContents.on('plugin-crashed', (_event, name, version) => {
      this.log.error('Plugin crashed:', {
        name,
        version,
        webContentsId: webContents.id
      })
    })
  }

  /**
   * 初始化崩溃处理器
   * 注册各种事件监听器，设置主窗口引用
   * @param mainWindow 主窗口对象
   * @param config 可选配置
   */
  public initialize(mainWindow: BrowserWindow, config?: CrashHandlerConfig) {
    // 设置主窗口引用和主界面内容ID
    this.mainWindow = mainWindow
    this.mainContentsId = mainWindow.webContents.id

    // 合并配置
    this.config = { ...this.config, ...config }

    // 处理主进程中的未捕获异常
    process.on('uncaughtException', (error: Error) => {
      this.log.error('Uncaught Exception:', {
        error: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    })

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason: any) => {
      this.log.error('Unhandled Rejection:', {
        reason: reason?.toString(),
        stack: reason?.stack,
        timestamp: new Date().toISOString()
      })
    })

    // 处理渲染进程崩溃
    app.on('render-process-gone', async (_event, webContents, details) => {
      // 只有在非正常退出的情况下才处理
      if (!this.shouldShowError(details)) return

      // 区分主界面崩溃和webview崩溃
      if (this.isMainUIContents(webContents)) {
        // 主界面崩溃 - 这是一个严重错误
        this.logRendererError('Main Window Renderer crash', details, webContents)
        if (this.mainWindow) {
          const { response } = await this.showErrorMessage(
            this.mainWindow,
            'Application Error',
            'Breakwind encountered a critical error. Would you like to reload the application?',
            ['Reload', 'Close App'],
            'error'
          )

          if (response === 0 && !webContents.isDestroyed()) {
            // 用户选择重新加载应用
            webContents.reload()
          } else {
            // 用户选择关闭应用
            app.quit()
          }
        }
      } else if (this.isWebviewContents(webContents)) {
        // Webview崩溃 - 显示特定的错误处理
        this.logRendererError('Webview Crash', details, webContents)
        await this.handleWebviewCrash(webContents)
      }
    })

    // 处理子进程崩溃
    app.on('child-process-gone', (_event, details) => {
      this.log.error('Child process crashed:', details)
      if (this.mainWindow) {
        // 构建详细的错误信息
        let msgDetail = `Child process error\nType: ${details.type}\nReason: ${details.reason}\nExit Code: ${details.exitCode}`
        if (details.serviceName) {
          msgDetail += `\nService Name: ${details.serviceName}`
        }
        if (details.name) {
          msgDetail += `\nName: ${details.name}`
        }
        // 显示错误对话框
        this.showErrorMessage(this.mainWindow, 'Child Process Error', msgDetail)
      }
    })

    // 为新创建的WebContents注册事件监听
    app.on('web-contents-created', (_event, webContents) => {
      this.registerWebContentsEvents(webContents)
    })
  }
}
