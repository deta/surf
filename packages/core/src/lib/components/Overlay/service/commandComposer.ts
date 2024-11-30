/**
 * Defines the `CommandComposer` class for managing search operations in the command menu.
 *
 * Key functionalities:
 * - Handling search value changes and triggering search operations.
 * - Fetching search engine suggestions, Oasis results, history, and hostname entries.
 * - Filtering command items and browser commands.
 * - Managing search state and providing loading state indicators.
 * - Public methods to update search values, reset states, and access search results.
 */

import { writable, derived, get } from 'svelte/store'
import { useLogScope, useDebounce, normalizeURL, optimisticCheckIfUrl } from '@horizon/utils'
import { staticActions } from './staticActions'
import { TeletypeAction, TeletypeActionGroup, type TeletypeStaticAction } from './teletypeActions'
import type { OasisService, OasisSpace } from '../../../service/oasis'
import type { ConfigService } from '../../../service/config'
import type { CMDMenuItem } from '../types'

import {
  searchActionToTeletypeItem,
  navigateActionToTeletypeItem,
  searchEngineSuggestionToTeletypeItem,
  historyEntryToTeletypeItem,
  hostnameHistoryEntryToTeletypeItem,
  resourceToTeletypeItem,
  tabToTeletypeItem,
  spaceToTeletypeItem,
  browserCommandToTeletypeItem,
  staticActionToTeletypeItem
} from './translations'

import {
  Resource,
  ResourceJSON,
  ResourceManager,
  type ResourceSearchResultItem
} from '../../../service/resources'
import { ResourceTagsBuiltInKeys, ResourceTypes, SearchOasisEventTrigger } from '@horizon/types'
import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../../constants/searchEngines'
import type { HistoryEntry, Space, Tab } from '../../../types'
import Fuse from 'fuse.js'
import type { TabsManager } from '../../../service/tabs'

export class CommandComposer {
  private log = useLogScope('CommandComposer')
  private resourceManager
  private telemetry
  private userConfigSettings
  private spaces

  // Store declarations
  private searchValue = writable('')
  private oasisSearchResults = writable<Resource[]>([])
  private searchEngineSuggestionResults = writable<string[]>([])
  private historyEntriesResults = writable<HistoryEntry[]>([])
  private hostnameHistoryEntriesResults = writable<HistoryEntry[]>([])
  private tabEntriesResults = writable<Tab[]>([])
  private spaceSearchResults = writable<Space[]>([])
  private filteredCommandItems = writable<CMDMenuItem[]>([])
  private filteredBrowserCommands = writable<TeletypeStaticAction[]>([])
  private isFetchingOasisSearchResults = writable(false)
  private isFetchingSearchEngineSuggestionResults = writable(false)
  private isFetchingHistoryEntriesResults = writable(false)
  private isFetchingTabEntryResults = writable(false)
  private isFetchingHostnameHistoryEntriesResults = writable(false)
  private isFilteringCommandItems = writable(false)
  private isFilteringBrowserCommands = writable(false)

  // State variables
  private searchTimeout: NodeJS.Timeout | null = null
  private hasSearched = false
  private isSearching = false

  // Constants
  private readonly fuseOptions = {
    keys: [
      { name: 'label', weight: 0.3 },
      { name: 'value', weight: 0.4 },
      { name: 'type', weight: 0.1 }
    ],
    threshold: 0.7,
    includeScore: true
  }

  constructor(
    private oasis: OasisService,
    private config: ConfigService,
    private tabsManager: TabsManager
  ) {
    this.log.debug('CommandComposer: Initialized')
    this.resourceManager = this.oasis.resourceManager
    this.telemetry = this.resourceManager.telemetry
    this.userConfigSettings = this.config.settings
    this.spaces = this.oasis.spaces
    this.tabsManager = this.tabsManager

    // Subscribe to search value changes
    this.searchValue.subscribe((value) => {
      this.onSearchValueChange(value)
    })
  }

  public readonly defaultActionsTeletype = derived(
    [
      this.searchValue,
      this.filteredCommandItems,
      this.oasisSearchResults,
      this.searchEngineSuggestionResults,
      this.historyEntriesResults,
      this.hostnameHistoryEntriesResults,
      this.tabEntriesResults,
      this.spaceSearchResults,
      this.filteredBrowserCommands
    ],
    ([
      searchValue,
      filteredCommandItems,
      oasisSearchResults,
      searchEngineSuggestionResults,
      historyEntriesResults,
      hostnameHistoryEntriesResults,
      tabEntriesResults,
      spaceSearchResults,
      filteredBrowserCommands
    ]) => {
      const result = [
        optimisticCheckIfUrl(searchValue)
          ? navigateActionToTeletypeItem(searchValue)
          : searchActionToTeletypeItem(searchValue),
        ...filteredBrowserCommands.map((command) => browserCommandToTeletypeItem(command)),
        ...tabEntriesResults.map((tab) => tabToTeletypeItem(tab)),
        ...hostnameHistoryEntriesResults.map((entry) => hostnameHistoryEntryToTeletypeItem(entry)),
        ...spaceSearchResults.map((space) => spaceToTeletypeItem(space)),
        ...searchEngineSuggestionResults.map((suggestion) =>
          searchEngineSuggestionToTeletypeItem(suggestion)
        ),
        ...oasisSearchResults.map((resource) => resourceToTeletypeItem(resource)),
        ...historyEntriesResults.map((entry) =>
          historyEntryToTeletypeItem(entry, get(this.historyEntriesResults))
        )
      ]
      return result
    }
  )

  public readonly askActions = derived([], () =>
    staticActions
      .filter((action) => action.group === TeletypeActionGroup.ChatCommands)
      .map((action) => staticActionToTeletypeItem(action))
  )

  public readonly stuffActions = derived([], () =>
    staticActions
      .filter((action) => action.group === TeletypeActionGroup.Resources)
      .map((action) => staticActionToTeletypeItem(action))
  )

  public readonly createActionsTeletype = derived([], () =>
    staticActions
      .filter((action) => action.group === TeletypeActionGroup.CreateCommands)
      .map((action) => staticActionToTeletypeItem(action))
  )

  /* === SEARCH VALUE HANDLERS === */
  public async handleSearch(searchValueInput: string): Promise<void> {
    let value = searchValueInput

    const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
    const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

    if (hashtags.length === value.split(' ').length) {
      value = ''
    }

    if (!this.hasSearched) {
      await this.telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, false)
      this.hasSearched = true
    }

    await this.resourceManager.searchResources(
      value,
      [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
        ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x))
      ],
      {
        semanticEnabled: get(this.userConfigSettings).use_semantic_search
      }
    )
  }

  private async onSearchValueChange(value: string) {
    this.isSearching = true

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }

    const resetResults = () => {
      this.spaceSearchResults.set([])
      this.oasisSearchResults.set([])
      this.searchEngineSuggestionResults.set([])
      this.historyEntriesResults.set([])
      this.hostnameHistoryEntriesResults.set([])
    }

    const fetchResults = async () => {
      const filteredSpaces = this.filterSpaces(value)
      this.spaceSearchResults.set(filteredSpaces)

      const tasks = [
        !get(this.isFetchingSearchEngineSuggestionResults) &&
          this.fetchSearchEngineSuggestions(value),
        !get(this.isFetchingHistoryEntriesResults) && this.fetchHistoryEntries(value),
        !get(this.isFetchingHostnameHistoryEntriesResults) && this.fetchHostnameEntries(value),
        !get(this.isFetchingTabEntryResults) && this.fetchTabEntries(value),
        !get(this.isFilteringCommandItems) && this.filterBrowserCommands(value),
        !get(this.isFilteringBrowserCommands) && this.filterBrowserCommands(value),
        !get(this.isFetchingOasisSearchResults) && this.fetchOasisResults(value)
      ].filter(Boolean)

      await Promise.all(tasks)
    }

    if (value.length > 2) {
      await fetchResults()
    } else {
      resetResults()
    }

    this.isSearching = false
  }

  /* === FETCHING AND DOING THE ACTUAL SEARCH LOGIC FOR ITEMS === */
  public async fetchSearchEngineSuggestions(query: string): Promise<void> {
    try {
      const engine = SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')

      if (engine.getCompletions !== undefined) {
        if (query.length > 2) {
          this.isFetchingSearchEngineSuggestionResults.set(true)
          const suggestions = await engine.getCompletions(query)
          this.searchEngineSuggestionResults.set(
            suggestions
              .slice(0, 3)
              .filter((suggestion: string) => suggestion !== get(this.searchValue))
          )

          this.log.debug(
            'Search engine suggestions:',
            this.searchEngineSuggestionResults,
            get(this.searchValue)
          )
        } else {
          this.searchEngineSuggestionResults.set([])
        }
      }
    } catch (error) {
      this.log.error('Error fetching Search Engine suggestions:', error)
      this.searchEngineSuggestionResults.set([])
    } finally {
      this.isFetchingSearchEngineSuggestionResults.set(false)
    }
  }

  public async fetchOasisResults(query: string): Promise<void> {
    try {
      this.isFetchingOasisSearchResults.set(true)
      if (query.length > 2) {
        try {
          const data = await this.resourceManager.searchResources(
            query,
            [
              ResourceManager.SearchTagDeleted(false),
              ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
              ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
              ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
            ],
            { includeAnnotations: false, semanticEnabled: true }
          )
          this.log.debug('Oasis search results:', data)

          const resources = data.map((x) => x.resource)

          await Promise.all(
            resources.map((resource) => {
              if (resource instanceof ResourceJSON) {
                return resource.getParsedData()
              }
            })
          )

          this.oasisSearchResults.set(resources.slice(0, 20))
        } catch (error) {
          this.log.error('Error fetching Oasis search results:', error)
          this.oasisSearchResults.set([])
        }
      } else {
        this.oasisSearchResults.set([])
      }
    } catch (error) {
      this.log.error('Error fetching Oasis search results:', error)
      this.oasisSearchResults.set([])
    } finally {
      this.isFetchingOasisSearchResults.set(false)
    }
  }

  public async fetchHistoryEntries(searchValue: string): Promise<void> {
    if (searchValue.length < 2) {
      this.historyEntriesResults.set([])
      return
    }
    try {
      this.isFetchingHistoryEntriesResults.set(true)
      const now = new Date()
      const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90) // 90 days
      const entries = await this.resourceManager.searchHistoryEntriesByUrlAndTitle(
        searchValue,
        since
      )
      this.log.debug('Fetched history entries:', entries)

      this.historyEntriesResults.set(entries.slice(0, 10))

      const filteredEntries = get(this.historyEntriesResults).filter(
        (entry: HistoryEntry) =>
          !get(this.hostnameHistoryEntriesResults).find(
            (e: HistoryEntry) =>
              e.id === entry.id || normalizeURL(e.url!) === normalizeURL(entry.url!)
          )
      )
      this.historyEntriesResults.set(filteredEntries)
    } catch (error) {
      this.log.error('Error fetching history entries:', error)
      this.historyEntriesResults.set([])
    } finally {
      this.isFetchingHistoryEntriesResults.set(false)
    }
  }

  public async fetchTabEntries(searchValue: string): Promise<void> {
    const ITEMS_LIMIT = 5
    if (searchValue.length < 2) {
      this.tabEntriesResults.set([])
      return
    }

    try {
      this.isFetchingTabEntryResults.set(true)

      const allTabs = this.tabsManager.activeTabsValue

      const filteredTabs = allTabs.filter((tab) => {
        if (tab.type === 'page') {
          return (
            tab.title.toLowerCase().includes(searchValue.toLowerCase()) ||
            (tab.currentLocation &&
              tab.currentLocation.toLowerCase().includes(searchValue.toLowerCase()))
          )
        }
        // Only return tabs that are pages, ignore spaces for now
        return false
      })

      this.tabEntriesResults.set(filteredTabs.slice(0, ITEMS_LIMIT))
    } catch (error) {
      this.log.error('Error fetching tab entries:', error)
      this.tabEntriesResults.set([])
    } finally {
      this.isFetchingTabEntryResults.set(false)
    }
  }

  public async fetchHostnameEntries(searchValue: string): Promise<void> {
    if (searchValue.length < 2) {
      this.hostnameHistoryEntriesResults.set([])
      return
    }
    try {
      this.isFetchingHostnameHistoryEntriesResults.set(true)
      const now = new Date()
      const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90) // 90 days
      const hostnames = await this.resourceManager.searchHistoryEntriesByHostnamePrefix(
        searchValue,
        since
      )
      this.log.debug('Fetched hostname history entries:', hostnames)
      this.hostnameHistoryEntriesResults.set(hostnames.slice(0, 1))
    } catch (error) {
      this.log.error('Error fetching history entries:', error)
      this.hostnameHistoryEntriesResults.set([])
    } finally {
      this.isFetchingHostnameHistoryEntriesResults.set(false)
    }
  }

  private filterSpaces(searchValue: string): OasisSpace[] {
    const spaces = get(this.spaces)
    if (!searchValue || searchValue.length < 2) return []

    const fuseSpaces = spaces.map((space) => ({
      name: get(space.data),
      originalSpace: space
    }))

    const fuse = new Fuse(fuseSpaces, {
      keys: [{ name: 'name.folderName', weight: 0.7 }],
      threshold: 0.4,
      includeScore: true
    })

    const results = fuse.search(searchValue)

    this.log.debug(
      'Space search results:',
      results.map((result) => result.item.originalSpace).slice(0, 5)
    )

    return results.map((result) => result.item.originalSpace).slice(0, 5)
  }

  private filterBrowserCommands(searchValue: string) {
    try {
      this.isFilteringBrowserCommands.set(true)
      const allActions = staticActions
      const items = allActions.filter(
        (action) => action.group === TeletypeActionGroup.BrowserCommands
      )
      const fuse = new Fuse(items, {
        ...this.fuseOptions,
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'id', weight: 0.3 }
        ]
      })

      const fuseResults = fuse.search(searchValue)

      const result = fuseResults.map((result) => ({ ...result.item, score: result.score }))

      this.filteredBrowserCommands.set(result as TeletypeStaticAction[])
    } catch (error) {
      this.log.error('Error filtering browser commands:', error)
      this.filteredBrowserCommands.set([])
    } finally {
      this.isFilteringBrowserCommands.set(false)
    }
  }

  public debouncedSearch = useDebounce((value: string) => {
    if (value.length === 0) {
      this.reset()
      return
    }
    void this.handleSearch(value).then(() => {
      this.isSearching = false
    })
  }, 300)

  /* === PUBLIC SETTERS FOR STORES === */
  public updateSearchValue(value: string) {
    this.searchValue.set(value)
  }

  /* === PUBLIC GETTERS FOR STORES === */
  public get searchResults() {
    return this.oasisSearchResults
  }

  public get suggestions() {
    return this.searchEngineSuggestionResults
  }

  public get historyResults() {
    return this.historyEntriesResults
  }

  public get hostnameResults() {
    return this.hostnameHistoryEntriesResults
  }

  public get commandItems() {
    return this.filteredCommandItems
  }

  public get spaceResults() {
    return this.spaceSearchResults
  }

  public get currentSearchValue() {
    return this.searchValue
  }

  public readonly isLoading = derived(
    [
      this.isFetchingOasisSearchResults,
      this.isFetchingSearchEngineSuggestionResults,
      this.isFetchingHistoryEntriesResults,
      this.isFetchingTabEntryResults,
      this.isFetchingHostnameHistoryEntriesResults,
      this.isFilteringCommandItems
    ],
    (statuses) => statuses.some(Boolean)
  )

  public reset(): void {
    this.searchValue.set('')
    this.oasisSearchResults.set([])
    this.searchEngineSuggestionResults.set([])
    this.historyEntriesResults.set([])
    this.hostnameHistoryEntriesResults.set([])
    this.filteredCommandItems.set([])
    this.hasSearched = false
    this.isSearching = false
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = null
    }
  }
}

export const useCommandComposer = (
  oasis: OasisService,
  config: ConfigService,
  tabsManager: TabsManager
) => {
  return new CommandComposer(oasis, config, tabsManager)
}
