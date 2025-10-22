import { app, BrowserWindow, dialog, WebContents } from 'electron'
import { useLogScope } from '@deta/utils'

// TODO: better config
interface CrashHandlerConfig {}

export class CrashHandler {
  private static instance: CrashHandler
  private log = useLogScope('Crash Handler')
  private mainWindow: BrowserWindow | null = null
  private config: Required<CrashHandlerConfig>
  private mainContentsId: number | null = null

  private constructor() {
    this.config = {}
  }

  public static getInstance(): CrashHandler {
    if (!CrashHandler.instance) {
      CrashHandler.instance = new CrashHandler()
    }
    return CrashHandler.instance
  }

  private shouldShowError(details: Electron.RenderProcessGoneDetails): boolean {
    if (!details || !details.reason) {
      return false
    }
    return details.reason !== 'clean-exit'
  }

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
          // TODO: send an IPC event to the tabs manager to close the tab with the webContentsId
          // NOTE: what if webview is a surflet or an embedded webview etc?
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

  private isWebviewContents(webContents: WebContents): boolean {
    return webContents.getType() === 'webview'
  }

  private isMainUIContents(webContents: WebContents): boolean {
    return webContents.id === this.mainContentsId
  }

  private registerWebContentsEvents(webContents: WebContents) {
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
            case 1:
              webContents.close()
              break
            case 2:
              webContents.reload()
              break
          }
        }
      }
    })

    webContents.on('responsive', () => {
      this.log.info('WebContents recovered:', {
        id: webContents.id,
        url: webContents.getURL()
      })
    })

    webContents.on('plugin-crashed', (_event, name, version) => {
      this.log.error('Plugin crashed:', {
        name,
        version,
        webContentsId: webContents.id
      })
    })
  }

  public initialize(mainWindow: BrowserWindow, config?: CrashHandlerConfig) {
    this.mainWindow = mainWindow
    this.mainContentsId = mainWindow.webContents.id

    this.config = { ...this.config, ...config }

    // uncaught exceptions in the main process
    process.on('uncaughtException', (error: Error) => {
      this.log.error('Uncaught Exception:', {
        error: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    })

    // unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      this.log.error('Unhandled Rejection:', {
        reason: reason?.toString(),
        stack: reason?.stack,
        timestamp: new Date().toISOString()
      })
    })

    // renderer process crashes
    app.on('render-process-gone', async (_event, webContents, details) => {
      if (!this.shouldShowError(details)) return

      if (this.isMainUIContents(webContents)) {
        // main UI crash
        this.logRendererError('Main Window Renderer crash', details, webContents)
        if (this.mainWindow) {
          const { response } = await this.showErrorMessage(
            this.mainWindow,
            'Application Error',
            'Surf encountered a critical error. Would you like to reload the application?',
            ['Reload', 'Close App'],
            'error'
          )

          if (response === 0 && !webContents.isDestroyed()) {
            webContents.reload()
          } else {
            app.quit()
          }
        }
      } else if (this.isWebviewContents(webContents)) {
        this.logRendererError('Webview Crash', details, webContents)
        await this.handleWebviewCrash(webContents)
      }
    })

    // child process crashes
    app.on('child-process-gone', (_event, details) => {
      this.log.error('Child process crashed:', details)
      if (this.mainWindow) {
        let msgDetail = `Child process error\nType: ${details.type}\nReason: ${details.reason}\nExit Code: ${details.exitCode}`
        if (details.serviceName) {
          msgDetail += `\nService Name: ${details.serviceName}`
        }
        if (details.name) {
          msgDetail += `\nName: ${details.name}`
        }
        this.showErrorMessage(this.mainWindow, 'Child Process Error', msgDetail)
      }
    })

    app.on('web-contents-created', (_event, webContents) => {
      this.registerWebContentsEvents(webContents)
    })
  }
}
