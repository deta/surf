import contextMenu from 'electron-context-menu'
import { ipcSenders } from './ipcHandlers'

export function setupContextMenu(window: Electron.WebContents, options: contextMenu.Options = {}) {
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
          ipcSenders.openURL(parameters.linkURL, false)
        }
      },
      {
        label: 'Open in Mini Browser',
        visible: parameters.linkURL.length > 0,
        click: () => {
          const webContentsId = window.id

          ipcSenders.newWindowRequest({
            url: parameters.linkURL,
            disposition: 'new-window',
            webContentsId: webContentsId
          })
        }
      },
      defaultActions.separator(),
      {
        label: 'Search Google for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          ipcSenders.openURL(
            `https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`,
            true
          )
        }
      },
      {
        label: 'Search Perplexity for “{selection}”',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          ipcSenders.openURL(
            `https://www.perplexity.ai/?q=${encodeURIComponent(parameters.selectionText)}`,
            true
          )
        }
      }
    ]
  }

  const opts = Object.assign(defaultOpts, { window }, options)
  contextMenu(opts)
}

export function attachContextMenu(window: Electron.WebContents) {
  setupContextMenu(window)
}
