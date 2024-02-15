import { app, Menu } from 'electron'
import { checkUpdatesMenuClickHandler } from './appUpdates'

const isMac = process.platform === 'darwin'

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
      isMac
        ? { role: 'close' }
        : [
            { label: 'Check for Updates...', click: checkUpdatesMenuClickHandler },
            { type: 'separator' },
            { role: 'quit' }
          ]
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
  }
]

export function setAppMenu(): void {
  const menu = Menu.buildFromTemplate(<Electron.MenuItemConstructorOptions[]>template)
  Menu.setApplicationMenu(menu)
}
