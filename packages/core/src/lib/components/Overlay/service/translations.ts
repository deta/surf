/**
 * This file contains utility functions that convert various data types into Teletype objects.
 * Teletype is a type that represents items in a command menu, which can include search engine suggestions,
 * history entries, resources, tabs, spaces, and browser commands.
 */

import { get } from 'svelte/store'
import { type HistoryEntry, type TabPage } from '../../../types'
import {
  truncateURL,
  truncate,
  normalizeURL,
  parseStringIntoBrowserLocation,
  conditionalArrayItem
} from '@horizon/utils'
import { ResourceTagsBuiltInKeys } from '@horizon/types'
import { Resource, ResourceJSON } from '../../../service/resources'
import {
  ActionDisplayPriority,
  ActionSelectPriority,
  type Action
} from '@deta/teletype/src/components/Teletype/types'
import {
  createSecondaryAction,
  dispatchTeletypeEvent,
  TeletypeAction,
  TeletypeActionGroup,
  type TeletypeStaticAction
} from './teletypeActions'
import type { OasisSpace } from '../../../service/oasis'

import { generateRootDomain } from '@horizon/utils'

// pls don't sue me for the name, just fit so well
export const createExecutioner = (action: TeletypeAction, payload: any) => {
  return () => {
    try {
      dispatchTeletypeEvent({
        execute: action,
        payload: payload,
        success: true
      })
    } catch (error) {
      dispatchTeletypeEvent({
        execute: action,
        payload: payload,
        success: true,
        error
      })
    }
  }
}

export const searchActionToTeletypeItem = (searchQuery: string) => ({
  id: 'search',
  name: searchQuery,
  icon: 'search',
  execute: TeletypeAction.NavigateGeneralSearch,
  section: 'Search',
  selectPriority: ActionSelectPriority.HIGH,
  displayPriority: ActionDisplayPriority.HIGH,
  actionText: 'Open as Tab',
  actionPanel: [
    createSecondaryAction({
      id: 'open-history-in-mini-browser',
      name: 'Open in Mini-Browser',
      handler: createExecutioner(TeletypeAction.OpenGeneralSearchInMiniBrowser, {
        query: searchQuery
      })
    }),
    {
      id: `copy-history`,
      name: 'Copy URL',
      icon: 'copy',
      handler: createExecutioner(TeletypeAction.CopyGeneralSearch, { query: searchQuery })
    }
  ],
  handler: createExecutioner(TeletypeAction.NavigateGeneralSearch, { query: searchQuery })
})

export const navigateActionToTeletypeItem = (searchValue: string, isEditMode = false) => {
  const url = parseStringIntoBrowserLocation(searchValue)

  return {
    id: 'navigate',
    name: `${searchValue}`,
    icon: 'world',
    execute: TeletypeAction.NavigateURL,
    section: 'Navigate',
    selectPriority: ActionSelectPriority.HIGHEST,
    displayPriority: ActionDisplayPriority.HIGH,
    ...(isEditMode
      ? {}
      : {
          actionText: 'Open as Tab',
          actionPanel: [
            createSecondaryAction({
              id: 'open-url-in-mini-browser',
              name: 'Open in Mini-Browser',
              handler: createExecutioner(TeletypeAction.OpenURLInMiniBrowser, { url })
            }),
            {
              id: `copy-url`,
              name: 'Copy URL',
              icon: 'copy',
              handler: createExecutioner(TeletypeAction.CopyURL, { url })
            }
          ]
        }),
    handler: createExecutioner(TeletypeAction.NavigateURL, { url })
  }
}

export const searchEngineSuggestionToTeletypeItem = (suggestion: string) => ({
  id: `google-suggestion-${suggestion}`,
  name: suggestion,
  icon: 'search',
  execute: TeletypeAction.NavigateSuggestion,
  displayPriority: ActionDisplayPriority.HIGH,
  section: 'Suggestion',
  actionText: 'Open as Tab',
  actionPanel: [
    createSecondaryAction({
      id: 'open-suggestion-in-mini-browser',
      name: 'Open in Mini-Browser',
      handler: createExecutioner(TeletypeAction.OpenSuggestionInMiniBrowser, { suggestion })
    }),
    {
      id: `copy-suggestion`,
      name: 'Copy URL',
      icon: 'copy',
      handler: createExecutioner(TeletypeAction.CopySuggestion, { suggestion })
    }
  ],
  handler: createExecutioner(TeletypeAction.NavigateSuggestion, { suggestion })
})

export const historyEntryToTeletypeItem = (
  entry: HistoryEntry,
  historyEntriesResults: HistoryEntry[]
) => {
  const url = entry.url ?? ''
  return {
    id: `history-${entry.id}`,
    name:
      historyEntriesResults.filter((e) => e.title === entry.title).length > 1
        ? `${truncate(entry.title ?? '', 25)}  —  ${truncateURL(entry.url ?? '', 15)}`
        : (entry.title ?? ''),
    icon: 'history',
    imageIcon: '',
    execute: TeletypeAction.NavigateHistoryElement,
    section: 'History',
    actionText: 'Open as Tab',
    actionPanel: [
      createSecondaryAction({
        id: 'open-history-in-mini-browser',
        name: 'Open in Mini-Browser',
        handler: createExecutioner(TeletypeAction.OpenURLInMiniBrowser, { url })
      }),
      {
        id: `copy-history`,
        name: 'Copy URL',
        icon: 'copy',
        handler: createExecutioner(TeletypeAction.CopyURL, { url })
      }
    ],
    handler: createExecutioner(TeletypeAction.NavigateHistoryElement, { entry })
  }
}

export const hostnameHistoryEntryToTeletypeItem = (entry: HistoryEntry) => {
  const url = entry.url ?? ''
  return {
    id: `hostname-${entry.id}`,
    name: normalizeURL(entry.url!),
    icon: 'history',
    execute: TeletypeAction.NavigateSuggestionHostname,
    section: 'Hostname',
    selectPriority: ActionSelectPriority.HIGHEST,
    displayPriority: ActionDisplayPriority.HIGH,
    actionText: 'Open as Tab',
    actionPanel: [
      createSecondaryAction({
        id: 'open-history-in-mini-browser',
        name: 'Open in Mini-Browser',
        handler: createExecutioner(TeletypeAction.OpenURLInMiniBrowser, { url })
      }),
      {
        id: `copy-history`,
        name: 'Copy URL',
        icon: 'copy',
        handler: createExecutioner(TeletypeAction.CopyURL, { url })
      },
      {
        id: 'remove-history-entry',
        name: 'Remove from History',
        icon: 'trash',
        handler: createExecutioner(TeletypeAction.RemoveHostnameSuggestion, { entry })
      }
    ],
    handler: createExecutioner(TeletypeAction.NavigateSuggestionHostname, { entry })
  }
}

export const resourceToTeletypeItem = (resource: Resource) => {
  const url =
    resource.metadata?.sourceURI ??
    resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value
  const data = (resource as ResourceJSON<any>).parsedData

  return {
    id: resource.id,
    name: truncate(
      data?.title ||
        resource.metadata?.name ||
        url ||
        `${resource.id} - ${resource.type}` ||
        'Undefined',
      30
    ),
    icon: 'file',
    execute: TeletypeAction.OpenResource,
    group: TeletypeActionGroup.Resources,
    section: 'Resource',
    actionText: 'Open as Tab',
    actionPanel: [
      createSecondaryAction({
        id: 'open-history-in-mini-browser',
        name: 'Open in Mini-Browser',
        handler: createExecutioner(TeletypeAction.OpenResourceInMiniBrowser, { resource })
      }),
      {
        id: `copy-history`,
        name: 'Copy URL',
        icon: 'copy',
        handler: createExecutioner(TeletypeAction.CopyURL, { url })
      }
    ],
    handler: createExecutioner(TeletypeAction.OpenResource, { resource })
  }
}

export const tabToTeletypeItem = (tab: TabPage) => {
  const url = tab.type === 'page' ? tab.currentLocation || tab.initialLocation : ''
  return {
    id: `tab-${tab.id}`,
    name: tab.title,
    icon: `favicon;;${tab.currentLocation}`,
    execute: TeletypeAction.OpenTab,
    section: 'Open Tabs',
    selectPriority: ActionSelectPriority.NORMAL,
    displayPriority: ActionDisplayPriority.NORMAL,
    keywords: ['tab', tab.title, generateRootDomain(tab.currentLocation ?? '')],
    actionText: 'Open Tab',
    actionPanel: conditionalArrayItem(tab.type === 'page', [
      createSecondaryAction({
        id: 'open-history-in-mini-browser',
        name: 'Open in Mini-Browser',
        handler: createExecutioner(TeletypeAction.OpenURLInMiniBrowser, { url })
      }),
      {
        id: `copy-history`,
        name: 'Copy URL',
        icon: 'copy',
        handler: createExecutioner(TeletypeAction.CopyURL, { url })
      }
    ]),
    handler: createExecutioner(TeletypeAction.OpenTab, { tab })
  }
}

export const spaceToTeletypeItem = (space: OasisSpace) =>
  ({
    id: space.id,
    name: get(space.data).folderName ?? 'Unnamed Context',
    icon: `space;;${space.id}`,
    execute: TeletypeAction.OpenSpaceAsContext,
    group: TeletypeActionGroup.Space,
    section: 'Context',
    actionIcon: 'circle-dot',
    actionText: 'Open Context',
    handler: createExecutioner(TeletypeAction.OpenSpaceAsContext, { space })
  }) as Action

export const browserCommandToTeletypeItem = (command: TeletypeStaticAction) => ({
  id: command.id,
  name: command.name,
  execute: command.execute,
  section: 'Browser Commands',
  icon: command.icon,
  handler: createExecutioner(command.execute, { command })
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
  handler: createExecutioner(action.execute, {
    id: action.id,
    url: action.creationUrl,
    component: action.component,
    view: action.view
  })
})
