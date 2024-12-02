import { TeletypeAction, TeletypeActionGroup, type TeletypeStaticAction } from './teletypeActions'
import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'

export const staticActions: TeletypeStaticAction[] = [
  {
    id: 'ask',
    execute: TeletypeAction.Ask,
    group: TeletypeActionGroup.ChatCommands,
    displayPriority: ActionDisplayPriority.LOW,
    name: 'Ask this Page',
    section: 'Chat',
    ignoreFuse: true,
    shortcut: '⌘N',
    icon: 'face'
  },
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
    id: 'create.note',
    execute: TeletypeAction.CreateNote,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Create Surf Note',
    shortcut: '⌘N',
    icon: 'docs'
  },
  {
    id: 'create.notion',
    execute: TeletypeAction.Create,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Notion Document',
    keywords: ['create', 'create notion', 'notion', 'document', 'page'],
    creationUrl: 'https://notion.new',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'create.gdoc',
    execute: TeletypeAction.Create,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Google Doc',
    keywords: ['create', 'create google', 'google document', 'document', 'page'],
    creationUrl: 'https://docs.new',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'create.gsheet',
    execute: TeletypeAction.Create,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Google Sheet',
    keywords: ['create', 'create google', 'create sheet', 'sheet', 'table'],
    creationUrl: 'https://sheets.new',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'create.gslides',
    execute: TeletypeAction.Create,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Google Slides',
    keywords: [
      'create',
      'create gooogle,',
      'create slides',
      'create presentation',
      'google',
      'slides',
      'presentation'
    ],
    creationUrl: 'https://slides.new',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'create.figma',
    execute: TeletypeAction.Create,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Figma File',
    keywords: ['create', 'create figma', 'figma', 'design'],
    creationUrl: 'https://figma.new',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'create.space',
    execute: TeletypeAction.CreateSpace,
    group: TeletypeActionGroup.CreateCommands,
    name: 'Create Context',
    keywords: ['smart', 'smart-space'],
    // component: CreateNewSpace,
    // view: 'ModalLarge',
    shortcut: '',
    icon: 'add'
  },
  {
    id: 'close.active.tab',
    execute: TeletypeAction.CloseTab,
    group: TeletypeActionGroup.BrowserCommands,
    name: 'Close Tab',
    shortcut: '⌘W',
    icon: 'close'
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
