import contextMenu from 'electron-context-menu'
import { ipcSenders } from './ipcHandlers'
import { getCachedSpaces } from './spaces'
import { type MenuItemConstructorOptions } from 'electron'
import { SpaceBasicData } from '@horizon/core/src/lib/service/ipc/events'

const createSpaceAction = (space: SpaceBasicData, handler: () => void) => {
  return {
    label: space.name,
    click: handler
  }
}

const createSpaceActions = (
  pinnedSpaces: SpaceBasicData[],
  unpinnedSpaces: SpaceBasicData[],
  handler: (space: SpaceBasicData) => void
) => {
  return [
    ...pinnedSpaces.map((space) => createSpaceAction(space, () => handler(space))),
    {
      label: 'More Contexts',
      submenu: unpinnedSpaces.map((space) => createSpaceAction(space, () => handler(space)))
    }
  ]
}

export function setupContextMenu(window: Electron.WebContents, options: contextMenu.Options = {}) {
  const defaultOpts: contextMenu.Options = {
    showSearchWithGoogle: false,
    showSaveImage: true,
    showSaveVideo: true,
    showCopyImage: true,
    showCopyImageAddress: true,
    showCopyLink: false,
    showCopyVideoAddress: true,
    showInspectElement: true,
    prepend: (defaultActions, parameters) => {
      const spaces = getCachedSpaces()

      let saveToSpaceItems: MenuItemConstructorOptions[] = []
      let openInSpaceItems: MenuItemConstructorOptions[] = []

      const pinnedSpaces = spaces.filter((space) => space.pinned)
      const unpinnedSpaces = spaces.filter((space) => !space.pinned)

      if (pinnedSpaces.length > 0) {
        saveToSpaceItems = createSpaceActions(pinnedSpaces, unpinnedSpaces, (space) => {
          ipcSenders.saveLink(parameters.linkURL, space.id)
        })

        openInSpaceItems = createSpaceActions(pinnedSpaces, unpinnedSpaces, (space) => {
          ipcSenders.openURL(parameters.linkURL, false, space.id)
        })
      } else {
        saveToSpaceItems = spaces.map((space) =>
          createSpaceAction(space, () => {
            ipcSenders.saveLink(parameters.linkURL, space.id)
          })
        )

        openInSpaceItems = spaces.map((space) =>
          createSpaceAction(space, () => {
            ipcSenders.openURL(parameters.linkURL, false, space.id)
          })
        )
      }

      return [
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
        {
          label: 'Open in Context',
          visible: parameters.linkURL.length > 0,
          submenu: openInSpaceItems
        },
        defaultActions.separator(),
        {
          label: 'Save Link',
          visible: parameters.linkURL.length > 0,
          click: () => {
            ipcSenders.saveLink(parameters.linkURL)
          }
        },
        {
          label: 'Save Link to Context',
          visible: parameters.linkURL.length > 0,
          submenu: saveToSpaceItems
        },
        defaultActions.copyLink({}),
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
  }

  const opts = Object.assign(defaultOpts, { window }, options)
  return contextMenu(opts)
}

export function attachContextMenu(window: Electron.WebContents) {
  return setupContextMenu(window)
}
