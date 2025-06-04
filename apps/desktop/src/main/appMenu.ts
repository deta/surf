import { app, Menu, shell } from 'electron'
import { isMac, isWindows, isLinux, useLogScope } from '@horizon/utils'
import { checkUpdatesMenuClickHandler } from './appUpdates'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { join } from 'path'
import { isAppSetup, isDefaultBrowser } from './utils'
import { TelemetryEventTypes } from '@horizon/types'
import { createSettingsWindow } from './settingsWindow'
import { getHistorySwipeGestureConfig, toggleHistorySwipeGestureConfig } from './historySwipe'
import { updateUserConfig } from './config'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { importFiles } from './importer'

const log = useLogScope('Main App Menu')
const execFileAsync = promisify(execFile)

let appMenu: AppMenu | null = null

interface MenuConfig {
  id?: string
  label?: string
  role?: string
  type?: 'separator' | 'submenu' | 'checkbox' | 'radio' | undefined
  accelerator?: string
  click?: () => void
  submenu?: MenuConfig[]
}

class AppMenu {
  private menu: Electron.Menu | null = null
  private template: MenuConfig[] = []

  constructor() {
    this.initializeTemplate()
  }

  private initializeTemplate(): void {
    this.template = [
      this.getSurfMenu(),
      this.getFileMenu(),
      this.getEditMenu(),
      this.getViewMenu(),
      this.getNavigateMenu(),
      this.getWindowMenu(),
      this.getToolsMenu(),
      this.getHelpMenu()
    ]
  }

  public buildMenu(): void {
    this.menu = Menu.buildFromTemplate(this.template as any)
    Menu.setApplicationMenu(this.menu)
  }

  public updateMenuItem(id: string, newLabel: string): void {
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const item = menuItem.submenu.find((item) => item.id === id)
        if (item) {
          item.label = newLabel
          break
        }
      }
    }
    this.buildMenu()
  }

  public getMenu(): Electron.Menu | null {
    return this.menu
  }

  private createDataLocationMenuItem(): MenuConfig {
    const userDataPath = app.getPath('userData')
    const surfDataPath = join(userDataPath, 'sffs_backend')
    const label = isMac() ? 'Show Surf Data in Finder' : 'Show Surf Data in File Manager'

    return {
      label,
      click: () => shell.openPath(surfDataPath)
    }
  }

  private getSurfMenu(isMacApp = isMac()): MenuConfig {
    const surfItems = [
      ...(isMacApp
        ? ([{ label: 'About Surf', role: 'about' }, { type: 'separator' }] as MenuConfig[])
        : []),
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: () => createSettingsWindow()
      },
      { type: 'separator' },
      this.createDataLocationMenuItem(),
      {
        label: 'Use as Default Browser',
        click: useAsDefaultBrowser
      },
      {
        label: 'Check for Updates',
        click: checkUpdatesMenuClickHandler
      },
      {
        label: 'Invite Friends',
        click: () => ipcSenders.openInvitePage()
      },
      ...(isMacApp
        ? [
            { type: 'separator' },
            { role: 'services', label: 'Services' },
            { type: 'separator' },
            {
              label: 'Hide Surf',
              accelerator: 'CmdOrCtrl+H',
              role: 'hide'
            },
            {
              label: 'Hide Others',
              accelerator: 'CmdOrCtrl+Shift+H',
              role: 'hideOthers'
            },
            { label: 'Show All', role: 'unhide' }
          ]
        : []),
      { type: 'separator' },
      { label: 'Quit Surf', role: 'quit' }
    ]

    return {
      label: isMacApp ? app.name : 'Surf',
      submenu: surfItems as MenuConfig[]
    }
  }

  private getFileMenu(): MenuConfig {
    return {
      label: 'File',
      submenu: [
        ...(isMac() ? ([{ role: 'close', accelerator: 'CmdOrCtrl+Shift+W' }] as MenuConfig[]) : []),
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => ipcSenders.createNewTab()
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => ipcSenders.closeActiveTab()
        },
        { type: 'separator' },
        {
          label: 'Take Screenshot',
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => ipcSenders.startScreenshotPicker()
        },
        {
          id: 'importFiles',
          label: 'Import Files',
          click: () => importFiles()
        },
        {
          id: 'openImporter',
          label: 'Import Bookmarks and History',
          click: () => {
            ipcSenders.openImporter()
          }
        },
        ...(isMac() ? [] : [{ type: 'separator' }, { role: 'quit' }])
      ] as MenuConfig[]
    }
  }

  private getEditMenu(): MenuConfig {
    return {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Copy URL',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => ipcSenders.copyActiveTabURL()
        }
      ]
    }
  }

  private getViewMenu(): MenuConfig {
    return {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Tabs',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => ipcSenders.toggleSidebar()
        },
        {
          label: 'Toggle Right Sidebar',
          accelerator: 'Alt+X',
          click: () => ipcSenders.toggleRightSidebar()
        },
        {
          label: 'Toggle Chat Sidebar',
          accelerator: 'CmdOrCtrl+E',
          click: () => ipcSenders.toggleRightSidebarTab('chat')
        },
        {
          label: 'Toggle Annotations Sidebar',
          accelerator: 'Alt+A',
          click: () => ipcSenders.toggleRightSidebarTab('annotations')
        },
        { type: 'separator' },
        {
          label: 'Change Tabs Orientation',
          accelerator: 'CmdOrCtrl+Shift+Alt+B',
          click: () => ipcSenders.toggleTabsPosition()
        },
        {
          id: 'toggleTheme',
          label: 'Switch Theme',
          click: () => ipcSenders.toggleTheme()
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac() ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => ipcSenders.openDevTools()
        }
      ]
    }
  }

  private getNavigateMenu(): MenuConfig {
    return {
      label: 'Navigate',
      submenu: [
        {
          label: 'My Stuff',
          accelerator: 'CmdOrCtrl+O',
          click: () => ipcSenders.openOasis()
        },
        {
          label: 'Browsing History',
          accelerator: 'CmdOrCtrl+Y',
          click: () => ipcSenders.openHistory()
        },
        { type: 'separator' },
        {
          label: 'Reload Tab',
          accelerator: 'CmdOrCtrl+R',
          click: () => ipcSenders.reloadActiveTab()
        },
        {
          label: 'Force Reload Tab',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => ipcSenders.reloadActiveTab(true)
        }
      ]
    }
  }

  private getToolsMenu(): MenuConfig {
    return {
      label: 'Tools',
      submenu: [
        {
          id: 'adblocker',
          // this will automatically change to the correct label on startup
          // based on the previous stored state when the adblocker is initialized
          label: 'Enable Adblocker',
          click: () => toggleAdblocker('persist:horizon')
        },
        {
          id: 'historySwipe',
          label: getHistorySwipeGestureConfig()
            ? 'Disable History Swipe Gesture'
            : 'Enable History Swipe Gesture',
          click: () => toggleHistorySwipeGestureConfig()
        },

        { type: 'separator' },
        {
          label: 'Reload App',
          role: 'reload',
          accelerator: 'CmdOrCtrl+Alt+R'
        },
        {
          label: 'Force Reload App',
          role: 'forceReload',
          accelerator: 'CmdOrCtrl+Alt+Shift+R'
        },
        {
          label: 'Toggle Developer Tools for Surf',
          accelerator: isMac() ? 'Cmd+Shift+I' : 'Option+Shift+I',
          role: 'toggleDevTools'
        }
      ]
    }
  }

  private getWindowMenu(): MenuConfig {
    return {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac()
          ? ([
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ] as MenuConfig[])
          : [{ role: 'close' }])
      ]
    }
  }

  private getHelpMenu(): MenuConfig {
    return {
      label: 'Help',
      submenu: [
        {
          label: 'Open Cheat Sheet',
          click: () => ipcSenders.openCheatSheet(),
          accelerator: 'F1'
        },
        {
          label: 'Open Changelog',
          click: () => ipcSenders.openChangelog()
        },
        {
          label: 'Open Welcome Page',
          click: () => ipcSenders.openWelcomePage()
        },
        { type: 'separator' },
        {
          label: 'Give Feedback',
          click: () => ipcSenders.openFeedbackPage(),
          accelerator: 'CmdOrCtrl+Shift+H'
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => ipcSenders.openShortcutsPage()
        }
      ]
    }
  }
}

export const getAppMenu = (): Electron.Menu | null => {
  if (!appMenu) return null
  return appMenu.getMenu()
}

export const setAppMenu = (): void => {
  appMenu = new AppMenu()
  appMenu.buildMenu()
}

export const changeMenuItemLabel = (id: string, newLabel: string): void => {
  appMenu?.updateMenuItem(id, newLabel)
}

const checkForChangeWithTimeout = async (
  checkFn: () => Promise<boolean>,
  interval: number,
  timeout: number
): Promise<boolean> => {
  return new Promise(async (resolve) => {
    let elapsed = 0
    const initialResult = await checkFn()

    const intervalId = setInterval(async () => {
      elapsed += interval
      const currentResult = await checkFn()

      if (currentResult !== initialResult || elapsed >= timeout) {
        clearInterval(intervalId)
        resolve(currentResult !== initialResult)
      }
    }, interval)
  })
}

const setAsDefaultBrowserWindows = async (): Promise<boolean> => {
  try {
    const command = 'start ms-settings:defaultapps?registeredAppMachine=Surf'
    await execFileAsync('cmd', ['/c', command])
    return await checkForChangeWithTimeout(isDefaultBrowser, 1000, 10000)
  } catch (error) {
    log.error('Error setting as default browser on Windows:', error)
    return false
  }
}

const setAsDefaultBrowserMac = async (): Promise<boolean> => {
  try {
    app.setAsDefaultProtocolClient('http')
    app.setAsDefaultProtocolClient('https')
    return await checkForChangeWithTimeout(isDefaultBrowser, 1000, 10000)
  } catch (error) {
    log.error('Error setting as default browser on macOS:', error)
    return false
  }
}

export const useAsDefaultBrowser = async (): Promise<void> => {
  if (!isAppSetup) {
    log.warn('App is not setup, not setting as default browser')
    return
  }

  let isSet = false

  if (isWindows()) {
    isSet = await setAsDefaultBrowserWindows()
  } else if (isMac()) {
    isSet = await setAsDefaultBrowserMac()
  } else if (isLinux()) {
    isSet = false
  }

  updateUserConfig({ defaultBrowser: isSet })
  ipcSenders.trackEvent(TelemetryEventTypes.SetDefaultBrowser, { value: isSet })
}
