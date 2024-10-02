import { isMac, isWindows, isLinux, useLogScope } from '@horizon/utils'
import { app, Menu, shell } from 'electron'
import { checkUpdatesMenuClickHandler } from './appUpdates'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { join } from 'path'
import { isDefaultBrowser } from './utils'
import { TelemetryEventTypes } from '@horizon/types'
import { createSettingsWindow } from './settingsWindow'
import { toggleHistorySwipeGestureConfig } from './historySwipe'
import { updateUserConfig } from './config'
import { execFile } from 'child_process'
import { promisify } from 'util'

const log = useLogScope('Main App Menu')
const execFileAsync = promisify(execFile)

let menu: Electron.Menu | null = null

const checkForChangeWithTimeout = async (checkFn: any, interval: number, timeout: number) => {
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

    return (await checkForChangeWithTimeout(isDefaultBrowser, 1000, 10000)) as boolean
  } catch (error) {
    log.error('error setting as default browser on Windows:', error)
    return false
  }
}

const setAsDefaultBrowserMac = async (): Promise<boolean> => {
  try {
    app.setAsDefaultProtocolClient('http')
    app.setAsDefaultProtocolClient('https')

    return (await checkForChangeWithTimeout(isDefaultBrowser, 1000, 10000)) as boolean
  } catch (error) {
    log.error('error setting as default browser on macOS:', error)
    return false
  }
}

const setAsDefaultBrowserLinux = async (): Promise<boolean> => {
  return false
}

export const useAsDefaultBrowser = async (): Promise<void> => {
  let isSet = false

  if (isWindows()) {
    isSet = await setAsDefaultBrowserWindows()
  } else if (isMac()) {
    isSet = await setAsDefaultBrowserMac()
  } else if (isLinux()) {
    isSet = await setAsDefaultBrowserLinux()
  } else {
    return
  }

  updateUserConfig({ defaultBrowser: isSet })
  ipcSenders.trackEvent(TelemetryEventTypes.SetDefaultBrowser, { value: isSet })
}

const showSurfDataInFinder = () => {
  const userDataPath = app.getPath('userData')
  const surfDataPath = join(userDataPath, 'sffs_backend')
  shell.openPath(surfDataPath)
}

const template = [
  ...(isMac()
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: 'About Surf',
              role: 'about'
            },
            { type: 'separator' },
            {
              label: 'Preferences...',
              accelerator: 'CmdOrCtrl+,',
              click: () => createSettingsWindow()
            },
            { type: 'separator' },
            {
              label: 'Check for Updates...',
              click: checkUpdatesMenuClickHandler
            },
            {
              label: 'Use as Default Browser',
              click: useAsDefaultBrowser
            },
            {
              label: 'Show Surf Data in Finder',
              click: showSurfDataInFinder
            },
            { type: 'separator' },
            {
              id: 'adblocker',
              label: 'Toggle Adblocker',
              click: () => toggleAdblocker('persist:horizon')
            },
            { type: 'separator' },
            {
              label: 'Quit Surf',
              role: 'quit'
            }
          ]
        }
      ]
    : []),
  {
    label: 'File',
    submenu: [
      ...(isMac()
        ? [{ role: 'close', accelerator: 'CmdOrCtrl+Shift+W' }]
        : [
            { label: 'Check for Updates...', click: checkUpdatesMenuClickHandler },
            {
              label: 'Use as Default Browser',
              click: useAsDefaultBrowser
            },
            { type: 'separator' },
            {
              id: 'adblocker',
              label: 'Toggle Adblocker',
              click: () => toggleAdblocker('persist:horizon')
            },
            { type: 'separator' },
            { role: 'quit' }
          ]),
      { type: 'separator' },
      {
        label: 'New Tab',
        accelerator: 'CmdOrCtrl+T',
        click: () => ipcSenders.createNewTab()
      },
      {
        label: 'Close Tab',
        accelerator: 'CmdOrCtrl+W',
        click: () => {
          log.log('Close Tab')
          ipcSenders.closeActiveTab()
        }
      },
      { type: 'separator' },
      {
        label: 'My Stuff',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          log.log('Open Oasis')
          ipcSenders.openOasis()
        }
      },
      {
        label: 'Browsing History',
        accelerator: 'CmdOrCtrl+Y',
        click: () => {
          log.log('Open History')
          ipcSenders.openHistory()
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      // {
      //   label: 'Find in Page',
      //   accelerator: 'CmdOrCtrl+F',
      //   click: () => ipcSenders.startFindInPage()
      // },
      {
        label: 'Toggle Screenshot...',
        accelerator: 'CmdOrCtrl+Shift+1',
        click: () => ipcSenders.startScreenshotPicker()
      },
      {
        label: 'Copy URL',
        accelerator: 'CmdOrCtrl+Shift+C',
        click: () => ipcSenders.copyActiveTabURL()
      },
      { type: 'separator' },
      ...(!isMac()
        ? [
            {
              label: 'Settings...',
              accelerator: 'CmdOrCtrl+,',
              click: () => {
                createSettingsWindow()
              }
            }
          ]
        : [])
    ]
  },
  {
    label: 'View',
    submenu: [
      { label: 'Reload App', role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
      { label: 'Force Reload App', role: 'forceReload', accelerator: 'CmdOrCtrl+Alt+Shift+R' },
      {
        label: 'Toggle Developer Tools for Surf',
        accelerator: isMac() ? 'Cmd+Shift+I' : 'Option+Shift+I',
        role: 'toggleDevTools'
      },
      // { role: 'toggleDevTools' },
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
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: isMac() ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
        click: () => ipcSenders.openDevTools()
      },
      {
        id: 'historySwipe',
        label: 'Toggle History Swipe Gesture',
        click: () => toggleHistorySwipeGestureConfig()
      },
      { type: 'separator' },
      {
        label: 'Toggle Sidebar',
        accelerator: 'CmdOrCtrl+Shift+B',
        click: () => ipcSenders.toggleSidebar()
      },
      {
        label: 'Toggle Tabs Orientation',
        accelerator: 'CmdOrCtrl+Shift+Alt+B',
        click: () => ipcSenders.toggleTabsPosition()
      },
      { type: 'separator' },
      {
        label: 'Toggle Right Sidebar',
        accelerator: 'Alt+X',
        click: () => ipcSenders.toggleRightSidebar()
      },
      {
        label: 'Toggle Chat Mode',
        accelerator: 'CmdOrCtrl+E',
        click: () => ipcSenders.toggleRightSidebarTab('chat')
      },
      {
        label: 'Toggle Annotations',
        accelerator: 'Alt+A',
        click: () => ipcSenders.toggleRightSidebarTab('annotations')
      },
      {
        label: 'Toggle Go Wild',
        accelerator: 'Alt+g',
        click: () => ipcSenders.toggleRightSidebarTab('go-wild')
      },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac()
        ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
        : [{ role: 'close' }])
    ]
  },
  {
    label: 'Help',
    submenu: [
      { label: 'Open Cheat Sheet', click: () => ipcSenders.openCheatSheet(), accelerator: 'F1' },
      {
        label: 'Give Feedback',
        click: () => ipcSenders.openFeedbackPage(),
        accelerator: 'CmdOrCtrl+Shift+H'
      }
    ]
  }
]

export function getAppMenu(): Electron.Menu | null {
  return menu
}

export function setAppMenu(): void {
  menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}

export function changeMenuItemLabel(id: string, newLabel: string): void {
  for (let i = 0; i < template.length; i++) {
    if (template[i] && template[i].submenu) {
      const item = template[i].submenu.find((item) => (item as any).id === id)
      if (item && item.label) {
        item.label = newLabel
        break
      }
    }
  }

  menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}
