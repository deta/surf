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
    prepend: (defaultActions, parameters) => [
      {
        label: 'Search Google for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send(
            'open-url',
            `https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`
          )
        }
      },
      {
        label: 'Search Perplexity for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send(
            'open-url',
            `https://www.perplexity.ai/?q=${encodeURIComponent(parameters.selectionText)}`
          )
        }
      },
      defaultActions.separator(),
      {
        label: 'Open in New Tab',
        visible: parameters.linkURL.length > 0 && parameters.mediaType === 'none',
        click: () => {
          const mainWindow = getMainWindow()
          mainWindow?.webContents.send('open-url', parameters.linkURL)
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
