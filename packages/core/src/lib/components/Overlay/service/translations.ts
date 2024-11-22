/**
 * This file contains utility functions that convert various data types into Teletype objects.
 * Teletype is a type that represents items in a command menu, which can include search engine suggestions,
 * history entries, resources, tabs, spaces, and browser commands.
 */

import { get } from 'svelte/store'
import type { HistoryEntry, Space, Tab } from '../../../types'
import { truncateURL, truncate, normalizeURL } from '@horizon/utils'
import { ResourceTagsBuiltInKeys } from '@horizon/types'
import { Resource, ResourceJSON } from '../../../service/resources'
import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'
import {
  dispatchTeletypeEvent,
  TeletypeAction,
  TeletypeActionGroup,
  type TeletypeStaticAction
} from './teletypeActions'
import type { OasisSpace } from '../../../service/oasis'

export const searchActionToTeletypeItem = (searchQuery: string) => ({
  id: 'search',
  name: searchQuery,
  icon: 'search',
  execute: TeletypeAction.NavigateGeneralSearch,
  section: 'Search',
  selectPriority: ActionSelectPriority.HIGH,
  displayPriority: ActionDisplayPriority.HIGH,
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateGeneralSearch,
        payload: { query: searchQuery },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateGeneralSearch,
        payload: { query: searchQuery },
        success: false,
        error
      })
    }
  }
})

export const navigateActionToTeletypeItem = (url: string) => ({
  id: 'navigate',
  name: `Navigate to ${url}`,
  icon: 'world',
  execute: TeletypeAction.NavigateURL,
  section: 'Navigate',
  selectPriority: ActionSelectPriority.HIGH,
  displayPriority: ActionDisplayPriority.HIGH,
  actionPanel: [
    {
      id: 'open-url-in-mini-browser',
      name: 'Open in Mini-Browser',
      icon: 'plus-square',
      shortcut: 'return',
      handler: async () => {
        try {
          dispatchTeletypeEvent({
            execute: TeletypeAction.OpenURLInMiniBrowser,
            payload: { url },
            success: true
          })
        } catch (error) {
          dispatchTeletypeEvent({
            execute: TeletypeAction.OpenURLInMiniBrowser,
            payload: { url },
            success: true,
            error
          })
        }
      }
    }
  ],
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateURL,
        payload: { url },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateURL,
        payload: { url },
        success: false,
        error
      })
    }
  }
})

export const searchEngineSuggestionToTeletypeItem = (suggestion: string) => ({
  id: `google-suggestion-${suggestion}`,
  name: suggestion,
  icon: 'search',
  execute: TeletypeAction.NavigateSuggestion,
  displayPriority: ActionDisplayPriority.HIGH,
  section: 'Suggestion',
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateSuggestion,
        payload: { suggestion },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateSuggestion,
        payload: { suggestion },
        success: false,
        error
      })
    }
  }
})

export const historyEntryToTeletypeItem = (
  entry: HistoryEntry,
  historyEntriesResults: HistoryEntry[]
) => ({
  id: `history-${entry.id}`,
  name:
    historyEntriesResults.filter((e) => e.title === entry.title).length > 1
      ? `${truncate(entry.title ?? '', 25)}  —  ${truncateURL(entry.url ?? '', 15)}`
      : (entry.title ?? ''),
  icon: 'history',
  imageIcon: '',
  execute: TeletypeAction.NavigateHistoryElement,
  section: 'History',
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateHistoryElement,
        payload: { entry },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateHistoryElement,
        payload: { entry },
        success: false,
        error
      })
    }
  }
})

export const hostnameHistoryEntryToTeletypeItem = (entry: HistoryEntry) => ({
  id: `hostname-${entry.id}`,
  name: normalizeURL(entry.url!),
  icon: 'history',
  execute: TeletypeAction.NavigateSuggestionHostname,
  section: 'Hostname',
  selectPriority: ActionSelectPriority.HIGHEST,
  displayPriority: ActionDisplayPriority.HIGH,
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateSuggestionHostname,
        payload: { entry },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.NavigateSuggestionHostname,
        payload: { entry },
        success: false,
        error
      })
    }
  }
})

export const resourceToTeletypeItem = (resource: Resource) => {
  const url =
    resource.metadata?.sourceURI ??
    resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value
  const data = (resource as ResourceJSON<any>).parsedData

  return {
    id: resource.id,
    name:
      data?.title ||
      resource.metadata?.name ||
      url ||
      `${resource.id} - ${resource.type}` ||
      'Undefined',
    icon: 'file',
    execute: TeletypeAction.OpenResource,
    group: TeletypeActionGroup.Resources,
    section: 'Resource',
    handler: () => {
      try {
        dispatchTeletypeEvent({
          execute: TeletypeAction.OpenResource,
          payload: { resource },
          success: true
        })
      } catch (error) {
        dispatchTeletypeEvent({
          execute: TeletypeAction.OpenResource,
          payload: { resource },
          success: false,
          error
        })
      }
    }
  }
}

export const tabToTeletypeItem = (tab: Tab) => ({
  id: tab.id,
  name: tab.title,
  icon: 'tab',
  execute: TeletypeAction.OpenTab,
  section: 'Tab',
  handler: () => {
    try {
      dispatchTeletypeEvent({ execute: TeletypeAction.OpenTab, payload: { tab }, success: true })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.OpenTab,
        payload: { tab },
        success: false,
        error
      })
    }
  }
})

export const spaceToTeletypeItem = (space: OasisSpace) => ({
  id: space.id,
  name: get(space.data).folderName ?? 'Unnamed Space',
  icon: 'space',
  execute: TeletypeAction.OpenSpace,
  group: TeletypeActionGroup.Space,
  section: 'Space',
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: TeletypeAction.OpenSpace,
        payload: { space },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: TeletypeAction.OpenSpace,
        payload: { space },
        success: false,
        error
      })
    }
  }
})

export const browserCommandToTeletypeItem = (command: TeletypeStaticAction) => ({
  id: command.id,
  name: command.name,
  execute: command.execute,
  section: 'Browser Commands',
  icon: command.icon,
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: command.execute,
        payload: { command },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: command.execute,
        payload: { command },
        success: false,
        error
      })
    }
  }
})

export const staticActionToTeletypeItem = (action: TeletypeStaticAction) => ({
  id: action.id,
  name: action.name,
  icon: action.icon,
  type: action.type,
  keywords: action.keywords,
  component: action.component,
  selectPriority: action.selectPriority,
  displayPriority: action.displayPriority,
  ignoreFuse: action.ignoreFuse,
  view: action.view,
  handler: () => {
    try {
      dispatchTeletypeEvent({
        execute: action.execute,
        payload: {
          id: action.id,
          url: action.creationUrl,
          component: action.component,
          view: action.view
        },
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: action.execute,
        payload: {
          id: action.id,
          url: action.creationUrl,
          component: action.component,
          view: action.view
        },
        success: false,
        error
      })
    }
  }
})
