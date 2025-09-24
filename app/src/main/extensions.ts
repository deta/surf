import { AuthenticatedAPI } from '@deta/api'
import { dialog, webContents, BrowserWindow, Session, WebContents } from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { installChromeWebStore } from 'electron-chrome-web-store'
import { formatPermissionsForUser } from './extensionsPermissions'
import fs from 'fs'
import { isDev } from '@deta/utils/system'

export class ExtensionsManager {
  private static instance: ExtensionsManager | null = null
  private extensions: ElectronChromeExtensions | null = null
  private mainWindow: BrowserWindow | null = null
  private extensionsSession: Session | null = null
  private activeWebContents: WebContents | null = null
  private constructor() {}
  private api: AuthenticatedAPI | null = null

  public static getInstance(): ExtensionsManager {
    if (!ExtensionsManager.instance) {
      ExtensionsManager.instance = new ExtensionsManager()
    }
    return ExtensionsManager.instance
  }

  private isChromeExtensionUrl(url: string): boolean {
    return url.startsWith('chrome-extension://')
  }

  private createExtensionWindow(url: string): BrowserWindow {
    const extensionPageWindow = new BrowserWindow({
      width: 1270,
      height: 820,
      fullscreenable: true,
      show: false,
      resizable: true,
      autoHideMenuBar: false,
      frame: true,
      webPreferences: {
        defaultFontSize: 14,
        session: this.extensionsSession!,
        webviewTag: false,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    extensionPageWindow.loadURL(url)
    extensionPageWindow.on('ready-to-show', () => {
      extensionPageWindow.show()
    })

    return extensionPageWindow
  }

  private async showErrorMessage(
    browserWindow: BrowserWindow,
    message: string,
    icon?: Electron.NativeImage
  ) {
    await dialog.showMessageBox(browserWindow, {
      title: 'Error',
      type: 'error',
      icon: icon,
      message
    })
  }

  public async initialize(
    mainWindow: BrowserWindow,
    extensionsSession: Session,
    api: AuthenticatedAPI,
    handleOpenUrl: (url: string) => void
  ) {
    this.mainWindow = mainWindow
    this.extensionsSession = extensionsSession
    this.api = api
    this.extensions = new ElectronChromeExtensions({
      license: 'Patron-License-2020-11-19',
      session: extensionsSession,
      // @ts-ignore
      createTab: (details) => {
        if (details.url) {
          if (this.isChromeExtensionUrl(details.url)) {
            const win = this.createExtensionWindow(details.url)
            return [win.webContents, win]
          } else {
            handleOpenUrl(details.url)
          }
        }
        return [mainWindow.webContents, mainWindow]
      }
    })

    await installChromeWebStore({
      session: extensionsSession,
      beforeInstall: async (details) => {
        if (!details.browserWindow || details.browserWindow.isDestroyed()) {
          return { action: 'deny' }
        }
        if (!this.api) {
          await this.showErrorMessage(
            details.browserWindow,
            'Extensions manager was not initialized properly'
          )
          return { action: 'deny' }
        }
        if (!isDev) {
          try {
            const res = await this.api.checkIfExtensionIsAllowed(details.id)
            if (!res.ok) {
              console.error('Failed to check if extension is allowed', res)
              await this.showErrorMessage(
                details.browserWindow,
                'Sorry we ran into an internal error while checking if the extension is supported.',
                details.icon
              )
              return { action: 'deny' }
            }
            if (!res.data.allowed) {
              await this.showErrorMessage(
                details.browserWindow,
                `Sorry "${details.localizedName}" is not supported at the moment.`,
                details.icon
              )
              return { action: 'deny' }
            }
          } catch (error) {
            console.error('Failed to check if extension is allowed', error)
            await this.showErrorMessage(details.browserWindow, `${error}`)
            return { action: 'deny' }
          }
        }

        const title = `Install “${details.localizedName}”?`

        let message = `${title}`
        let messageDetail: string | undefined
        if (details.manifest.permissions) {
          messageDetail = formatPermissionsForUser(details.manifest.permissions)
        }
        const returnValue = await dialog.showMessageBox(details.browserWindow, {
          title,
          message,
          detail: messageDetail,
          icon: details.icon,
          buttons: ['Cancel', 'Install']
        })
        const action = returnValue.response === 0 ? 'deny' : 'allow'
        if (action === 'allow' && !isDev) {
          this.api
            .trackInstalledExtension(details.id, true)
            .then((res) => {
              if (!res.ok) {
                console.error('Failed to track installed extension', res)
              }
            })
            .catch((error) => {
              console.error('Failed to track installed extension', error)
            })
        }
        return { action }
      }
    })
  }

  public setActiveTab(webContentsId: number): void {
    if (this.extensions) {
      const activeWebContents = webContents.fromId(webContentsId)
      if (activeWebContents) {
        this.activeWebContents = activeWebContents
        this.activateExtensions(activeWebContents)
      }
    }
  }

  public addTab(webContentsId: number): void {
    if (this.extensions) {
      const addedWebContents = webContents.fromId(webContentsId)
      if (addedWebContents) {
        console.log('Adding tab for webContentsId:', webContentsId)
        console.log('session:', addedWebContents.session)
        this.extensions.addTab(addedWebContents, this.mainWindow!)
      }
    }
  }

  /*
  public closeTab(webContentsId: number): void {
    if (this.extensions) {
      console.log('Closing tab for webContentsId:', webContentsId)
      const closedWebContents = webContents.fromId(webContentsId)
      if (closedWebContents && closedWebContents.id === this.activeWebContents?.id) {
        this.activeWebContents = null
        //@ts-ignore
        this.extensions.selectTab(null)
      }
    }
  }
  */

  private activateExtensions(webContents: WebContents): void {
    if (this.extensions) {
      this.extensions.addTab(webContents, this.mainWindow!)
      this.extensions.selectTab(webContents)
    }
  }

  public removeAllExtensions(): void {
    if (!this.extensionsSession) {
      return
    }
    const extensions = this.extensionsSession.extensions.getAllExtensions()
    for (const extension of extensions) {
      this.removeExtension(extension.id)
    }
  }

  public removeExtension(extensionId: string): void {
    if (!this.extensionsSession) {
      return
    }
    try {
      const extension = this.extensionsSession.extensions.getExtension(extensionId)
      if (!extension) {
        return
      }

      this.extensionsSession.extensions.removeExtension(extensionId)

      fs.rmSync(extension.path, { recursive: true })

      if (!isDev && this.api) {
        this.api
          .trackInstalledExtension(extensionId, false)
          .then((res) => {
            if (!res.ok) {
              console.error('Failed to track installed extension', res)
            }
          })
          .catch((error) => {
            console.error('Failed to track installed extension', error)
          })
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return
      }

      console.error('failed to remove extension', error)
    }
  }

  public listExtensions() {
    if (!this.extensionsSession) {
      return
    }
    const extensions = this.extensionsSession.extensions.getAllExtensions()
    return extensions
  }
}
