import { app, Menu } from 'electron'
import { checkUpdatesMenuClickHandler } from './appUpdates'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { resolve } from 'path'
import { isDefaultBrowser } from './utils'
import { TelemetryEventTypes } from '@horizon/types'
import { createSettingsWindow } from './settingsWindow'

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
    console.error('Error setting as default browser:', error)
  }
}

const template = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: 'About Horizon',
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
            { type: 'separator' },
            {
              id: 'adblocker',
              label: 'Toggle Adblocker',
              click: () => toggleAdblocker('persist:horizon')
            },
            { type: 'separator' },
            {
              label: 'Quit Horizon',
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
        ? [{ role: 'close' }]
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
          ])
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
      { role: 'forceReload', accelerator: 'CmdOrCtrl+Alt+Shift+R' },
      { role: 'toggleDevTools' },
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
      { label: 'Open Cheat Sheet', click: () => ipcSenders.openCheatSheet() },
      { label: 'Give Feedback', click: () => ipcSenders.openFeedbackPage() }
    ]
  }
]

export function setAppMenu(): void {
  const menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}

export function changeMenuItemLabel(id: string, newLabel: string): void {
  if (template[0] && template[0].submenu) {
    const adBlockItem = template[0].submenu.find((item) => (item as any).id === id)
    if (adBlockItem && adBlockItem.label) {
      adBlockItem.label = newLabel
    }
  }

  const menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}
