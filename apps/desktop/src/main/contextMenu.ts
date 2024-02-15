import contextMenu from 'electron-context-menu'

export function setupContextMenu(options: contextMenu.Options = {}) {
  const defaultOpts: contextMenu.Options = {
    showSearchWithGoogle: false
  }

  const opts = Object.assign(defaultOpts, options)
  contextMenu(opts)
}

export function attachContextMenu(window: Electron.WebContents) {
  setupContextMenu({ window })
}
