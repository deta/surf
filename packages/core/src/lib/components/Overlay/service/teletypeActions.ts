import { type SvelteComponent } from 'svelte'

import {
  type ActionBase,
  ActionDisplayPriority,
  type ActionPanelOption,
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
  OpenSpaceInStuff = 'SPACE_IN_STUFF',
  OpenSpaceAsContext = 'SPACE_AS_CONTEXT',
  OpenSpaceAsTab = 'SPACE_AS_TAB',
  OpenStuff = 'STUFF',
  CopyURL = 'COPY_URL',
  CopySuggestion = 'COPY_SUGGESTION',
  CopyGeneralSearch = 'COPY_GENERAL_SEARCH',
  OpenURLInMiniBrowser = 'OPEN_URL_MINI_BROWSER',
  OpenSuggestionInMiniBrowser = 'OPEN_SUGGESTION_MINI_BROWSER',
  OpenGeneralSearchInMiniBrowser = 'OPEN_GENERAL_SEARCH_MINI_BROWSER',
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
  [TeletypeAction.OpenSpaceInStuff]: 'Open Space in Stuff ↗',
  [TeletypeAction.OpenSpaceAsContext]: 'Open Context ↗',
  [TeletypeAction.OpenSpaceAsTab]: 'Open as Tab ↗',
  [TeletypeAction.OpenStuff]: 'Open Stuff',
  [TeletypeAction.CopyURL]: 'Copy URL',
  [TeletypeAction.CopySuggestion]: 'Copy Suggestion',
  [TeletypeAction.CopyGeneralSearch]: 'Copy General Search',
  [TeletypeAction.OpenURLInMiniBrowser]: 'Open URL in Mini Browser',
  [TeletypeAction.OpenSuggestionInMiniBrowser]: 'Open Suggestion in Mini Browser',
  [TeletypeAction.OpenGeneralSearchInMiniBrowser]: 'Open General Search in Mini Browser',
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

export interface TeletypeStaticAction extends ActionBase {
  execute: TeletypeAction
  type?: string
  group?: TeletypeActionGroup
  component?: typeof SvelteComponent
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

export function createSecondaryAction(action: ActionPanelOption) {
  return {
    icon: 'eye',
    shortcutType: 'secondary',
    ...action
  } as ActionPanelOption
}

export function createTertiaryAction(action: ActionPanelOption) {
  return {
    icon: 'arrow.up.right',
    shortcutType: 'tertiary',
    ...action
  } as ActionPanelOption
}
