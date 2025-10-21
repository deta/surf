import { app, Menu, shell } from 'electron'
import { isMac, isWindows, isLinux } from '@deta/utils/system'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { join } from 'path'
import { createSettingsWindow } from './settingsWindow'
import { updateUserConfig, getUserConfig } from './config'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { importFiles } from './importer'
import { useLogScope } from '@deta/utils'

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
  checked?: boolean
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
      this.getToolsMenu()
      // this.getHelpMenu()
    ]
  }

  public buildMenu(): void {
    // Set initial checkbox states based on user config
    this.updateCheckboxStates()
    this.menu = Menu.buildFromTemplate(this.template as any)
    Menu.setApplicationMenu(this.menu)
  }

  private updateCheckboxStates(): void {
    const userConfig = getUserConfig()
    const isVertical = userConfig.settings.tabs_orientation === 'vertical'

    // Update the checkbox state for "Show Tabs in Sidebar"
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const tabsMenuItem = menuItem.submenu.find((item) => item.id === 'showTabsInSidebar')
        if (tabsMenuItem) {
          tabsMenuItem.checked = isVertical
          break
        }
      }
    }
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

  public updateTabOrientationMenuItem(): void {
    const userConfig = getUserConfig()
    const isVertical = userConfig.settings.tabs_orientation === 'vertical'

    // Update the checkbox state for "Show Tabs in Sidebar"
    for (const menuItem of this.template) {
      if (menuItem.submenu) {
        const tabsMenuItem = menuItem.submenu.find((item) => item.id === 'showTabsInSidebar')
        if (tabsMenuItem) {
          tabsMenuItem.checked = isVertical
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
      // {
      //   label: 'Invite Friends',
      //   click: () => ipcSenders.openInvitePage()
      // },
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
        // {
        //   label: 'Take Screenshot',
        //   accelerator: 'CmdOrCtrl+Shift+1',
        //   click: () => ipcSenders.startScreenshotPicker()
        // },
        {
          id: 'importFiles',
          label: 'Import Files',
          click: () => importFiles()
        },
        // {
        //   id: 'openImporter',
        //   label: 'Import Bookmarks and History',
        //   click: () => {
        //     ipcSenders.openImporter()
        //   }
        // },
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
          id: 'showTabsInSidebar',
          label: 'Show Tabs in Sidebar',
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+O',
          click: () => ipcSenders.toggleTabsPosition()
        },
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
        // {
        //   label: 'My Stuff',
        //   accelerator: 'CmdOrCtrl+O',
        //   click: () => ipcSenders.openOasis()
        // },
        // {
        //   label: 'Browsing History',
        //   accelerator: 'CmdOrCtrl+Y',
        //   click: () => ipcSenders.openHistory()
        // },
        // { type: 'separator' },
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
        /* TODO: renable when welcome page is ready and no bug
        {
          label: 'Open Welcome Page',
          click: () => ipcSenders.openWelcomePage()
        },
        */
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

export const updateTabOrientationMenuItem = (): void => {
  appMenu?.updateTabOrientationMenuItem()
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
