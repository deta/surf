import { useLogScope } from '@horizon/utils'
import { app, Menu, shell } from 'electron'
import { checkUpdatesMenuClickHandler } from './appUpdates'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { join, resolve } from 'path'
import { isDefaultBrowser } from './utils'
import { TelemetryEventTypes } from '@horizon/types'
import { createSettingsWindow } from './settingsWindow'
import { toggleHistorySwipeGestureConfig } from './historySwipe'

const log = useLogScope('Main App Menu')
const isMac = process.platform === 'darwin'

const useAsDefaultBrowserClickHandler = () => {
  try {
    // Register the app to handle URLs (from: https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('http', process.execPath, [resolve(process.argv[1])])
        app.setAsDefaultProtocolClient('https', process.execPath, [resolve(process.argv[1])])
      }
    } else {
      app.setAsDefaultProtocolClient('http')
      app.setAsDefaultProtocolClient('https')
    }

    // TODO: figure out a better way to do this. Problem: the setAsDefaultProtocolClient method doesn't actually tell us if the user set the app as the default browser through the system prompt or not.
    const timeout = 1000 * 30 // 30 seconds
    setTimeout(() => {
      const isSet = isDefaultBrowser()
      if (isSet) {
        ipcSenders.trackEvent(TelemetryEventTypes.SetDefaultBrowser, { value: true })
      }
    }, timeout)
  } catch (error) {
    log.error('Error setting as default browser:', error)
  }
}

const showSurfDataInFinder = () => {
  const userDataPath = app.getPath('userData')
  const surfDataPath = join(userDataPath, 'sffs_backend')
  shell.openPath(surfDataPath)
}

const template = [
  ...(isMac
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
              click: useAsDefaultBrowserClickHandler
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
      ...(isMac
        ? [{ role: 'close', accelerator: 'CmdOrCtrl+Shift+W' }]
        : [
            { label: 'Check for Updates...', click: checkUpdatesMenuClickHandler },
            {
              label: 'Use as Default Browser',
              click: useAsDefaultBrowserClickHandler
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
      {
        label: 'Copy URL',
        accelerator: 'CmdOrCtrl+Shift+C',
        click: () => ipcSenders.copyActiveTabURL()
      },
      { type: 'separator' },
      ...(!isMac
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
        accelerator: 'CmdOrCtrl+Shift+I',
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
        accelerator: isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
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
        accelerator: 'Alt+C',
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
      ...(isMac
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

export function setAppMenu(): void {
  const menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
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

  const menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}
