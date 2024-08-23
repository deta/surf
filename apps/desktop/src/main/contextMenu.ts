import contextMenu from 'electron-context-menu'
import { getMainWindow } from './mainWindow'

export function setupContextMenu(options: contextMenu.Options = {}) {
  const defaultOpts: contextMenu.Options = {
    showSearchWithGoogle: false,
    showSaveImage: true,
    showSaveVideo: true,
    showCopyImage: true,
    showCopyImageAddress: true,
    showCopyLink: true,
    showCopyVideoAddress: true,
    showInspectElement: true,
    prepend: (defaultActions, parameters) => [
      {
        label: 'Open in New Tab',
        visible: parameters.linkURL.length > 0,
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send('open-url', { url: parameters.linkURL, active: false })
        }
      },
      defaultActions.separator(),
      {
        label: 'Search Google for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send('open-url', {
            url: `https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`,
            active: true
          })
        }
      },
      {
        label: 'Search Perplexity for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send('open-url', {
            url: `https://www.perplexity.ai/?q=${encodeURIComponent(parameters.selectionText)}`,
            active: true
          })
        }
      }
    ]
  }

  const opts = Object.assign(defaultOpts, options)
  contextMenu(opts)
}

export function attachContextMenu(window: Electron.WebContents) {
  setupContextMenu({ window })
}
