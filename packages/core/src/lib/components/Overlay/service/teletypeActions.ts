import { type SvelteComponent } from 'svelte'

import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'

// actionTypes.ts
export enum TeletypeAction {
  Ask = 'ASK',
  NavigateGeneralSearch = 'GENERAL_SEARCH',
  NavigateURL = 'NAVIGATE',
  NavigateSuggestion = 'SUGGESTION',
  NavigateHistoryElement = 'HISTORY',
  NavigateSuggestionHostname = 'SUGGESTION_HOSTNAME',
  OpenResource = 'RESOURCE',
  OpenTab = 'TAB',
  OpenSpace = 'SPACE',
  OpenStuff = 'STUFF',
  OpenURLInMiniBrowser = 'OPEN_URL_MINI_BROWSER',
  OpenResourceInMiniBrowser = 'OPEN_RESOURCE_MINI_BROWSER',
  ExecuteBrowserCommand = 'BROWSER_COMMAND',
  Create = 'CREATE',
  CreateNote = 'CREATE_NOTE',
  CreateSpace = 'CREATE_SPACE',
  OpenSpaceItem = 'SPACE_ITEM',
  CloseTab = 'CLOSE_TAB',
  ToggleBookmark = 'TOGGLE_BOOKMARK',
  ToggleSidebar = 'TOGGLE_SIDEBAR',
  Reload = 'TOGGLE_RELOAD',
  ShowHistoryTab = 'SHOW_HISTORY',
  ZoomIn = 'ZOOM_IN',
  ZoomOut = 'ZOOM_OUT',
  ResetZoom = 'RESET_ZOOM'
}

export const TeletypeActionDisplayLabels = {
  [TeletypeAction.Ask]: 'Ask',
  [TeletypeAction.NavigateGeneralSearch]: 'General Search',
  [TeletypeAction.NavigateURL]: 'Navigate',
  [TeletypeAction.NavigateSuggestion]: 'Suggestion',
  [TeletypeAction.NavigateHistoryElement]: 'History',
  [TeletypeAction.NavigateSuggestionHostname]: 'Suggestion Hostname',
  [TeletypeAction.OpenResource]: 'Resource',
  [TeletypeAction.OpenTab]: 'Open Tab',
  [TeletypeAction.OpenSpace]: 'Open Space ↗',
  [TeletypeAction.OpenStuff]: 'Open Stuff',
  [TeletypeAction.OpenURLInMiniBrowser]: 'Open URL in Mini Browser',
  [TeletypeAction.OpenResourceInMiniBrowser]: 'Open Resource in Mini Browser',
  [TeletypeAction.ExecuteBrowserCommand]: 'Browser Command',
  [TeletypeAction.Create]: 'Create',
  [TeletypeAction.CreateNote]: 'Create Note',
  [TeletypeAction.CreateSpace]: 'Create Space',
  [TeletypeAction.OpenSpaceItem]: 'Space Item',
  [TeletypeAction.CloseTab]: 'Close Tab',
  [TeletypeAction.ToggleBookmark]: 'Toggle Bookmark',
  [TeletypeAction.ToggleSidebar]: 'Toggle Sidebar',
  [TeletypeAction.Reload]: 'Reload',
  [TeletypeAction.ShowHistoryTab]: 'Show History',
  [TeletypeAction.ZoomIn]: 'Zoom In',
  [TeletypeAction.ZoomOut]: 'Zoom Out',
  [TeletypeAction.ResetZoom]: 'Reset Zoom'
}

export enum TeletypeActionGroup {
  ChatCommands = 'CHAT',
  BrowserCommands = 'BROWSER_COMMANDS',
  CreateCommands = 'CREATE_SPACE',
  Resources = 'RESOURCES',
  Space = 'SPACE'
}

export interface TeletypeStaticAction {
  id: string
  execute: TeletypeAction
  name: string
  type?: string
  keywords?: string[]
  group?: TeletypeActionGroup
  description?: string
  component?: typeof SvelteComponent
  view?: string
  shortcut?: string
  actionPanel?: [any]
  section?: string
  selectPriority?: ActionSelectPriority
  displayPriority?: ActionDisplayPriority
  icon?: string
  ignoreFuse?: boolean
  hiddenOnRoot?: boolean
  creationUrl?: string
}

export interface TeletypeActionEvent {
  execute: TeletypeAction
  payload: any
  success: boolean
  group?: TeletypeActionGroup
  error?: Error
}

// actionEvents.ts
import { writable } from 'svelte/store'

export const teletypeActionStore = writable<TeletypeActionEvent | null>(null)

export function dispatchTeletypeEvent(event: TeletypeActionEvent) {
  teletypeActionStore.set(event)
  setTimeout(() => teletypeActionStore.set(null), 0)
}
