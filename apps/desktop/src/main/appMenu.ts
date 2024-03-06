import { app, Menu } from 'electron'
import { checkUpdatesMenuClickHandler } from './appUpdates'
import { ipcSenders } from './ipcHandlers'
import { toggleAdblocker } from './adblocker'
import { resolve } from 'path'

const isMac = process.platform === 'darwin'

const useAsDefaultBrowserClickHandler = () => {
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
      { role: 'reload' },
      { role: 'forceReload' },
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
    submenu: [{ label: 'Open Cheat Sheet', click: () => ipcSenders.openCheatSheet() }]
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
