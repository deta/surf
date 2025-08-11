import { TeletypeAction, TeletypeActionGroup, type TeletypeStaticAction } from './teletypeActions'
import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'

export const staticActions: TeletypeStaticAction[] = [
  /*
  {
    id: 'ask',
    execute: TeletypeAction.Ask,
    group: TeletypeActionGroup.ChatCommands,
    selectPriority: ActionSelectPriority.LOW,
    displayPriority: ActionDisplayPriority.HIGH,
    name: `Ask (${isMac ? '⌘' : 'Ctrl'} + ⏎)`,
    section: 'Chat',
    ignoreFuse: true,
    shortcut: '⌘N',
    icon: 'face'
  },
  */
  {
    id: 'open.stuff',
    execute: TeletypeAction.OpenStuff,
    group: TeletypeActionGroup.Resources,
    selectPriority: ActionSelectPriority.HIGHEST,
    displayPriority: ActionDisplayPriority.HIGHEST,
    name: 'Open Your Stuff',
    shortcut: '⌘O',
    icon: 'arrow.up.right'
  },
  {
    id: 'browser.bookmark',
    execute: TeletypeAction.ToggleBookmark,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Toggle Bookmark',
    shortcut: '⌘D',
    icon: 'save'
  },
  {
    id: 'browser.sidebar',
    execute: TeletypeAction.ToggleSidebar,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Toggle Sidebar',
    shortcut: '⌘B',
    icon: 'sidebar.left'
  },
  {
    id: 'browser.reload',
    execute: TeletypeAction.Reload,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Reload',
    shortcut: '⌘R',
    icon: 'reload'
  },
  {
    id: 'browser.history',
    execute: TeletypeAction.ShowHistoryTab,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Show History',
    shortcut: '⌘Y',
    icon: 'history'
  },
  {
    id: 'browser.zoom',
    execute: TeletypeAction.ZoomIn,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Zoom In',
    shortcut: '⌘+',
    icon: 'zoom-in'
  },
  {
    id: 'browser.zoomout',
    execute: TeletypeAction.ZoomOut,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Zoom Out',
    shortcut: '⌘-',
    icon: 'zoom-out'
  },
  {
    id: 'browser.resetzoom',
    execute: TeletypeAction.ResetZoom,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Reset Zoom',
    shortcut: '⌘0',
    icon: 'maximize'
  }
]
