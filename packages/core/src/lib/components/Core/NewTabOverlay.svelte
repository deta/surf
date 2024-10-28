<script lang="ts" context="module">
  export type OverlayEvents = {
    'copy-active-url': void
    'close-active-tab': void
    bookmark: void
    'toggle-horizontal': void
    'toggle-sidebar': void
    'reload-window': void
    'create-history-tab': void
    zoom: void
    'zoom-out': void
    'reset-zoom': void
    'open-url': string
    'activate-tab': string
    'open-resource': string
    'create-chat': string
    'open-space': Space
    'create-note': string
    open: string
    'create-resource-from-oasis': string
    'create-tab-from-space': { tab: TabSpace; active: boolean }
    deleted: string
  }
</script>

<script lang="ts">
  import { derived, writable } from 'svelte/store'

  import {
    useLogScope,
    optimisticCheckIfURLOrIPorFile,
    parseStringIntoBrowserLocation,
    isModKeyAndKeyPressed,
    truncateURL,
    getFileType,
    useDebounce,
    useLocalStorageStore,
    tooltip,
    truncate,
    normalizeURL
  } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin,
    type DragTypes,
    type HistoryEntry,
    type Space
  } from '../../types'
  import DropWrapper from '../Oasis/DropWrapper.svelte'
  import stuffAdd from '../../../../public/assets/demo/stuffsave.gif'
  import stuffSmart from '../../../../public/assets/demo/stuffsmart.gif'
  import stuffSearch from '../../../../public/assets/demo/stuffsearch.gif'

  import Tooltip from '../Onboarding/Tooltip.svelte'

  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    processDrop
  } from '../../service/mediaImporter'

  import { useToasts } from '../../service/toast'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'
  import { DragOperation, Dragcula, DragculaDragEvent } from '@horizon/dragcula'
  import type { Tab, TabPage, TabSpace } from '../../types/browser.types'

  import * as Command from '../Command'
  import Fuse from 'fuse.js'
  import CommandMenuItem, { type CMDMenuItem } from './CommandMenuItem.svelte'
  import type { HistoryEntriesManager } from '../../service/history'
  import OasisSpace from '../Oasis/OasisSpace.svelte'
  import SpacesView from '../Oasis/SpacesView.svelte'
  import CreateNewSpace from '../Oasis/CreateNewSpace.svelte'
  import { useConfig } from '../../service/config'
  import { Drawer } from 'vaul-svelte'
  import {
    CreateTabEventTrigger,
    DeleteResourceEventTrigger,
    MultiSelectResourceEventAction,
    OpenResourceEventFrom,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  import { useTabsManager } from '../../service/tabs'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../constants/searchEngines'
  import { CONTEXT_MENU_OPEN } from './ContextMenu.svelte'
  import Onboarding from './Onboarding.svelte'

  export let activeTabs: Tab[] = []
  export let showTabSearch = 0
  export let spaceId: string
  export let historyEntriesManager: HistoryEntriesManager
  export let activeTab: Tab | undefined = undefined

  const log = useLogScope('NewTabOverlay')
  const tabsManager = useTabsManager()
  const dispatch = createEventDispatcher<OverlayEvents>()
  const config = useConfig()
  const userConfigSettings = config.settings
  let oasisSpace: OasisSpace

  let createSpaceRef: any

  let page: 'tabs' | 'oasis' | 'history' | 'spaces' | null = null
  let filteredItems: CMDMenuItem[] = []
  let historyEntries: HistoryEntry[] = []
  let searchEngineSuggestions: string[] = []
  let oasisResources: Resource[] = []
  const CACHE_EXPIRY = 1000 * 30 // 30 seconds
  let historyCache: { data: any[]; timestamp: number } | null = null
  const fuseOptions = {
    keys: [
      { name: 'label', weight: 0.3 },
      { name: 'value', weight: 0.4 },
      { name: 'type', weight: 0.1 }
    ],
    threshold: 0.7,
    includeScore: true
  }
  let onboardingOpen = writable($userConfigSettings.onboarding.completed_stuff === false)

  let selectFirstCommandItem: () => void
  let hasLoadedEverything = false
  const searchValue = writable('')
  const oasisSearchResults = writable<Resource[]>([])
  const searchEngineSuggestionResults = writable<string[]>([])
  const historyEntriesResults = writable<HistoryEntry[]>([])
  const hostnameHistoryEntriesResults = writable<HistoryEntry[]>([])
  const filteredCommandItems = writable<CMDMenuItem[]>([])
  const isFetchingOasisSearchResults = writable(false)
  const isFetchingSearchEngineSuggestionResults = writable(false)
  const isFetchingHistoryEntriesResults = writable(false)
  const isFetchingHostnameHistoryEntriesResults = writable(false)
  const isCreatingNewSpace = writable(false)
  const isFilteringCommandItems = writable(false)
  const selectedFilter = useLocalStorageStore<'all' | 'saved_by_user'>(
    'oasis-filter-resources',
    'all'
  )
  const isLoadingCommandItems = derived(
    [
      isFetchingOasisSearchResults,
      isFetchingSearchEngineSuggestionResults,
      isFetchingHistoryEntriesResults,
      isFetchingHostnameHistoryEntriesResults,
      isFilteringCommandItems
    ],
    ([
      isFetchingOasisSearchResults,
      isFetchingSearchEngineSuggestionResults,
      isFetchingHistoryEntriesResults,
      isFetchingHostnameHistoryEntriesResults,
      isFilteringCommandItems
    ]) => {
      return (
        isFetchingOasisSearchResults ||
        isFetchingSearchEngineSuggestionResults ||
        isFetchingHistoryEntriesResults ||
        isFetchingHostnameHistoryEntriesResults ||
        isFilteringCommandItems
      )
    }
  )

  let hasSearched = false

  $: commandItems = [
    ...browserCommands,
    ...$spaces.map((space) => spaceToItem(space, { weight: 1 }))
  ]

  $: placeholder =
    showTabSearch === 2
      ? 'Search Your Stuff...'
      : page === 'tabs'
        ? 'Search for a tab...'
        : page === 'oasis'
          ? 'Search for a resource...'
          : page === 'history'
            ? 'Search for a page...'
            : page === 'spaces'
              ? 'Search for a space...'
              : 'Search the web or enter a URL...'
  $: breadcrumb =
    page === 'tabs'
      ? 'Active Tabs'
      : page === 'oasis'
        ? 'My Stuff'
        : page === 'history'
          ? 'History'
          : page === 'spaces'
            ? 'Spaces'
            : undefined

  const deboundedSelectFirstCommandItem = useDebounce(() => {
    if (selectFirstCommandItem) {
      selectFirstCommandItem()
    }
  }, 100)

  function tabToItem(tab: Tab, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    return {
      id: tab.id,
      label: tab.title,
      value: tab.type === 'page' ? (tab.currentLocation ?? tab.initialLocation) : '',
      ...(tab.type === 'page'
        ? { iconUrl: tab.icon }
        : tab.type === 'space'
          ? { iconColors: tab.colors }
          : {}),
      type: 'tab',
      ...params
    } as CMDMenuItem
  }

  function hostnameHistoryEntryToItem(
    entry: HistoryEntry,
    params: Partial<CMDMenuItem> = {}
  ): CMDMenuItem {
    return {
      id: `hostname-${entry.id}`,
      // we have to use the URL as the label because the title saved in the history entry
      // will be the title of the page when it was saved with the full path
      label: normalizeURL(entry.url!),
      value: entry.url,
      iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(entry.url!)}`,
      type: 'suggestion-hostname',
      score: 0.4,
      ...params
    } as CMDMenuItem
  }

  function historyEntryToItem(entry: HistoryEntry, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    const hasItemsWithSameTitle =
      $historyEntriesResults.filter((e) => e.title === entry.title).length > 1
    return {
      id: `history-${entry.id}`,
      label: hasItemsWithSameTitle
        ? `${truncate(entry.title!, 25)}  —  ${truncateURL(entry.url!, 15)}`
        : entry.title,
      value: entry.url,
      // description: truncateURL(entry.url, 10),
      iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(entry.url!)}`,
      type: 'history',
      score: 0.4,
      ...params
    } as CMDMenuItem
  }

  function resourceToItem(resource: Resource, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value
    const data = (resource as ResourceJSON<any>).parsedData
    return {
      id: resource.id,
      label: data?.title || resource.metadata?.name || url || `${resource.id} - ${resource.type}`,
      value: url,
      type: 'resource',
      description: getFileType(resource.type),
      ...(url
        ? { iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}` }
        : { icon: 'file' }),
      ...params
    } as CMDMenuItem
  }

  function spaceToItem(space: Space, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    return {
      id: space.id,
      label: space.name.folderName,
      type: 'space',
      iconColors: space.name.colors,
      ...params
    } as CMDMenuItem
  }

  function searchEngineSuggestionToItem(suggestion: string) {
    // TODO: OO
    return {
      id: `google-suggestion-${suggestion}`,
      type: 'suggestion',
      label: suggestion,
      value: suggestion,
      icon: 'search',
      score: 0.5
    } as CMDMenuItem
  }

  // TODO: this should be a proper subscribe
  const commandFilter = derived([searchValue], ([searchValue]) => {
    if (!searchValue || showTabSearch !== 1) {
      return []
    }

    log.debug('Filtering command items', searchValue)

    if (searchValue.length > 2) {
      if (!$isFilteringCommandItems) {
        filterCommandItems(searchValue)
      }

      /*
      if (!$isFetchingOasisSearchResults) {
        fetchOasisResults(searchValue)
      }
      */

      if (!$isFetchingOasisSearchResults) {
        fetchSearchEngineSuggestions(searchValue)
      }

      if (!$isFetchingHistoryEntriesResults) {
        fetchHistoryEntries(searchValue)?.then(() => {
          log.debug('Fetched history entries done')
        })
      }

      if (!$isFetchingHostnameHistoryEntriesResults) {
        fetchHostnameEntries(searchValue)?.then(() => {
          log.debug('Fetched hostname entries done')
        })
      }
    }

    return []
  })

  const commandFilterResult = derived(
    [
      searchValue,
      commandFilter,
      filteredCommandItems,
      oasisSearchResults,
      searchEngineSuggestionResults,
      historyEntriesResults,
      hostnameHistoryEntriesResults
    ],
    ([
      searchValue,
      commandFilter,
      filteredCommandItems,
      oasisSearchResults,
      searchEngineSuggestionResults,
      historyEntriesResults,
      hostnameHistoryEntriesResults
    ]) => {
      deboundedSelectFirstCommandItem()

      const items = [
        // ...(activeTab && (activeTab.type === 'page' || activeTab.type === 'space')
        //   ? [
        //       {
        //         id: `create-chat`,
        //         type: 'command',
        //         label: `Ask ${activeTab.type === 'space' ? 'Space' : 'Page'}: ${activeTab.title}`,
        //         icon: 'message',
        //         value: `Chat with ${searchValue}`,
        //         // shortcut: '⌥C',
        //         score: 0.9
        //       }
        //     ]
        //   : []),
        ...commandFilter,
        ...hostnameHistoryEntriesResults.map((entry) => hostnameHistoryEntryToItem(entry)),
        ...filteredCommandItems,
        ...searchEngineSuggestionResults.map((suggestion) =>
          searchEngineSuggestionToItem(suggestion)
        ),
        ...historyEntriesResults
          // filter out history entries that are already in the hostname history entries
          .filter(
            (entry) =>
              !hostnameHistoryEntriesResults.find(
                (e) => e.id === entry.id || normalizeURL(e.url!) === normalizeURL(entry.url!)
              )
          )
          .map((entry) => historyEntryToItem(entry))
        // NOTE: Disabled until it works better with the new stuff seach work
        //...oasisSearchResults.map((resource) => resourceToItem(resource, { score: 0.4 }))
      ]

      if (
        !items.some(
          (item) =>
            (item.label === searchValue || item.value === searchValue) && item.type !== 'space'
        )
      ) {
        const hostnameMatch = hostnameHistoryEntriesResults.find((entry) =>
          normalizeURL(entry.url!).startsWith(normalizeURL(searchValue))
        )

        const generalSearchItem = {
          id: `general-search-${searchValue}`,
          type: 'general-search',
          label: `${searchValue}`,
          value: searchValue,
          icon: 'search',
          score: 1
        } as CMDMenuItem

        if (searchValue.length > 2 && hostnameMatch) {
          // insert the general search item at the second position
          items.splice(1, 0, generalSearchItem)
        } else {
          // insert the general search item at the top
          items.unshift(generalSearchItem)
        }
      }

      const url = parseStringIntoBrowserLocation(searchValue)
      if (url) {
        items.unshift({
          id: `open-search-url`,
          type: 'navigate',
          label: `Navigate to ${truncateURL(url)}`,
          icon: 'world',
          value: url,
          score: 1
        } as CMDMenuItem)
      }

      return items
    }
  )

  const filterCommandItems = useDebounce((searchValue: string) => {
    try {
      $isFilteringCommandItems = true
      const items = commandItems
      const fuse = new Fuse(items, fuseOptions)

      const fuseResults = fuse.search(searchValue)

      const result = fuseResults
        .map((result) => ({ ...result.item, score: result.score }))
        .filter((x) => x.score! < fuseOptions.threshold) as CMDMenuItem[]
      log.debug('Fuse search result items', result)

      $filteredCommandItems = result
    } catch (error) {
      log.error('Error filtering command items:', error)
      $filteredCommandItems = []
    } finally {
      $isFilteringCommandItems = false
    }
  }, 150)

  const fetchHostnameEntries = useDebounce(async ($searchValue: string) => {
    if ($searchValue.length < 2) {
      $hostnameHistoryEntriesResults = []
      return
    }
    try {
      $isFetchingHostnameHistoryEntriesResults = true
      const now = new Date()
      const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90) // 90 days
      const hostnames = await resourceManager.searchHistoryEntriesByHostnamePrefix(
        $searchValue,
        since
      )
      log.debug('Fetched hostname history entries:', hostnames)
      $hostnameHistoryEntriesResults = hostnames.slice(0, 1)
    } catch (error) {
      log.error('Error fetching history entries:', error)
      $hostnameHistoryEntriesResults = []
    } finally {
      $isFetchingHostnameHistoryEntriesResults = false
    }
  }, 300)

  const fetchHistoryEntries = useDebounce(async ($searchValue: string) => {
    if ($searchValue.length < 2) {
      $historyEntriesResults = []
      return
    }
    try {
      $isFetchingHistoryEntriesResults = true
      const now = new Date()
      const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90) // 90 days
      const entries = await resourceManager.searchHistoryEntriesByUrlAndTitle($searchValue, since)
      log.debug('Fetched history entries:', entries)
      $historyEntriesResults = entries.slice(0, 10)
    } catch (error) {
      log.error('Error fetching history entries:', error)
      $historyEntriesResults = []
    } finally {
      $isFetchingHistoryEntriesResults = false
    }
  }, 300)

  const fetchOasisResults = useDebounce(async (query: string) => {
    try {
      $isFetchingOasisSearchResults = true
      if (query.length > 2) {
        // const data = await resourceManager.listResourcesByTags([
        const data = await resourceManager.searchResources(
          query,
          [
            ResourceManager.SearchTagDeleted(false),
            ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
            ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
            ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
            // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
          ],
          { includeAnnotations: false }
        )
        log.debug('Oasis search results:', data)

        const resources = data.map((x) => x.resource)

        await Promise.all(
          resources.map((resource) => {
            if (resource instanceof ResourceJSON) {
              return resource.getParsedData()
            }
          })
        )

        $oasisSearchResults = resources.slice(0, 5)
      } else {
        $oasisSearchResults = []
      }
      // updateFilteredItems()
    } catch (error) {
      log.error('Error fetching Oasis search results:', error)
      $oasisSearchResults = []
    } finally {
      $isFetchingOasisSearchResults = false
    }
  }, 300)

  const fetchSearchEngineSuggestions = useDebounce(async (query: string) => {
    try {
      const engine =
        //SEARCH_ENGINES.find((e) => e.key === $userConfigSettings.search_engine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')

      if (engine.getCompletions !== undefined) {
        if (query.length > 2) {
          $isFetchingOasisSearchResults = true
          const suggestions = await engine.getCompletions(query)
          log.debug('Search engine suggestions:', suggestions)
          $searchEngineSuggestionResults = suggestions // TODO: -> Make this generalized for other engines
            .slice(0, 3)
            .filter((suggestion: string) => suggestion !== $searchValue)
        } else {
          $searchEngineSuggestionResults = []
        }
      }
      // updateFilteredItems()
    } catch (error) {
      log.error('Error fetching Search Engine suggestions:', error)
      $searchEngineSuggestionResults = []
    } finally {
      $isFetchingOasisSearchResults = false
    }
  }, 150)

  function handleSelect(e: CustomEvent<CMDMenuItem>) {
    const item = e.detail
    log.debug('handleSelect', item)
    if (item.type === 'tab') {
      dispatch('activate-tab', item.id)
    } else if (item.type === 'history' || item.type === 'suggestion-hostname') {
      dispatch('open-url', item.value!)
    } else if (item.type === 'command' || item.type === 'navigate') {
      if (item.id === 'open-search-url') {
        dispatch('open-url', item.value!)
      } else if (item.id === 'create-chat') {
        dispatch('create-chat', $searchValue)
      } else {
        dispatch(item.id as any)
      }
    } else if (item.type === 'suggestion' || item.type === 'google-search') {
      const engine =
        SEARCH_ENGINES.find((e) => e.key === $userConfigSettings.search_engine) ??
        SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
      if (!engine) throw new Error('No search engine / default engine found, config error?')

      dispatch('open-url', engine.getUrl(encodeURIComponent(item.value!)))
    } else if (item.type === 'general-search') {
      // check if it's a URL
      const isValidURL = optimisticCheckIfURLOrIPorFile(item.value!)
      if (isValidURL) {
        dispatch('open-url', item.value!)
      } else {
        const engine =
          SEARCH_ENGINES.find((e) => e.key === $userConfigSettings.search_engine) ??
          SEARCH_ENGINES.find((e) => e.key === DEFAULT_SEARCH_ENGINE)
        if (!engine) throw new Error('No search engine / default engine found, config error?')

        dispatch('open-url', engine.getUrl(encodeURIComponent(item.value!)))
      }
    } else if (item.type === 'resource') {
      if (!item.id) {
        log.error('Resource item has no ID:', item)
        return
      }

      telemetry.trackSearchOasis(SearchOasisEventTrigger.CommandMenu, false)

      openResourceAsTab(item.id)
      // dispatch('open-resource', item.id!)
    } else if (item.type === 'space') {
      const space = $spaces.find((x) => x.id === item.id)
      if (!space) {
        log.error('Space not found:', item.id)
        return
      }
      dispatch('open-space', space)
    }
    resetSearch()
  }
  function resetSearch() {
    $searchValue = ''
    filteredItems = []
    searchEngineSuggestions = []
    showTabSearch = 0
    $selectedSpaceId = null
    hasLoadedEverything = false
  }
  const browserCommands = [
    { id: 'close-active-tab', label: 'Close Tab', shortcut: '⌘W', type: 'command', icon: 'close' },
    { id: 'bookmark', label: 'Toggle Bookmark', shortcut: '⌘D', type: 'command', icon: 'bookmark' },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      shortcut: '⌘B',
      type: 'command',
      icon: 'sidebar.left'
    },
    { id: 'reload-window', label: 'Reload', shortcut: '⌘R', type: 'command', icon: 'reload' },
    {
      id: 'create-history-tab',
      label: 'Show History',
      shortcut: '⌘Y',
      type: 'command',
      icon: 'history'
    },
    { id: 'zoom', label: 'Zoom In', shortcut: '⌘+', type: 'command', icon: 'zoom-in' },
    { id: 'zoom-out', label: 'Zoom Out', shortcut: '⌘-', type: 'command', icon: 'zoom-out' },
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: '⌘0', type: 'command', icon: 'maximize' },
    { id: 'create-note', label: 'Create Note', shortcut: '⌘n', type: 'command', icon: 'docs' }
  ] as CMDMenuItem[]

  $: isEverythingSpace = spaceId === 'all'

  const oasis = useOasis()
  const toasts = useToasts()
  const resourceManager = oasis.resourceManager
  const telemetry = resourceManager.telemetry
  const spaces = oasis.spaces
  const selectedItem = writable<string | null>(null)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  const showCreationModal = writable(false)
  const selectedSpaceId = writable<string | null>(null)
  const searchResults = writable<ResourceSearchResultItem[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])
  const spaceCreationActive = writable(false)

  const resourcesToShow = derived(
    [searchValue, searchResults, everythingContents],
    ([searchValue, searchResults, everythingContents]) => {
      if (searchValue && showTabSearch === 2) {
        return searchResults
      }

      return everythingContents
    }
  )

  const isResourceDetailsModalOpen = derived(
    [showResourceDetails, resourceDetailsModalSelected],
    ([$showResourceDetails, $resourceDetailsModalSelected]) => {
      return $showResourceDetails && !!$resourceDetailsModalSelected
    }
  )

  const loadEverything = async (initialLoad = false) => {
    try {
      if ($loadingContents) {
        log.debug('Already loading everything')
        return
      }

      // resets the selected space
      oasis.resetSelectedSpace()

      loadingContents.set(true)

      if (initialLoad) {
        everythingContents.set([])
        await tick()
        telemetry.trackOpenOasis()
      }

      const resources = await resourceManager.listResourcesByTags(
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ...($userConfigSettings.show_annotations_in_oasis
            ? []
            : [ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')])
        ],
        { includeAnnotations: true }
      )

      const items = resources
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(
          (resource) =>
            ({
              id: resource.id,
              resource: resource,
              annotations: resource.annotations,
              engine: 'local'
            }) as ResourceSearchResultItem
        )

      log.debug('Loaded everything:', items)

      everythingContents.set(items)
    } catch (error) {
      log.error('Error loading everything:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const handleSearch = async (searchValueInput: string) => {
    let value = searchValueInput

    const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
    const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

    if (hashtags.length === value.split(' ').length) {
      value = ''
    }

    // Only track telemetry if it's the first search after a reset
    if (!hasSearched) {
      await telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, false)
      hasSearched = true
    }

    const result = await resourceManager.searchResources(
      value,
      [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
        ...($selectedFilter === 'saved_by_user'
          ? [ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)]
          : []),
        ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x))
      ],
      {
        semanticEnabled: $userConfigSettings.use_semantic_search
      }
    )

    log.debug('searching all', result)

    searchResults.set(result)
  }

  const handleResourceRemove = async (e: CustomEvent<string | string[]>) => {
    const resourceIds = Array.isArray(e.detail) ? e.detail : [e.detail]
    log.debug('removing resources', resourceIds)

    const resources = []
    for (const resourceId of resourceIds) {
      const resource = await resourceManager.getResource(resourceId)
      if (!resource) {
        log.error('Resource not found:', resourceId)
        continue
      }
      resources.push(resource)
    }

    if (resources.length === 0) {
      toasts.error('No resources found to remove.')
      return
    }

    let totalReferences = 0
    let isFromLiveSpace = false

    for (const resource of resources) {
      const references = await resourceManager.getAllReferences(resource.id, $spaces)
      if (isEverythingSpace) {
        totalReferences += references.length
      }
      const resourceIsFromLiveSpace = !!resource.tags?.find(
        (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
      )
      isFromLiveSpace = isFromLiveSpace || resourceIsFromLiveSpace
    }

    const confirm = window.confirm(
      !isEverythingSpace && !isFromLiveSpace
        ? `Remove reference? The original will still be in Everything.`
        : totalReferences > 0
          ? `These resources will be removed from ${totalReferences} space${
              totalReferences > 1 ? 's' : ''
            } and deleted permanently.`
          : `These resources will be deleted permanently.`
    )

    if (!confirm) {
      return
    }

    try {
      for (const resource of resources) {
        const references = await resourceManager.getAllReferences(resource.id, $spaces)
        log.debug('removing resource references', references)
        for (const reference of references) {
          log.debug('deleting reference', reference)
          await resourceManager.deleteSpaceEntries([reference.entryId])
        }

        if (isEverythingSpace) {
          log.debug('deleting resource from oasis', resource.id)
          await resourceManager.deleteResource(resource.id)
          everythingContents.update((contents) => {
            return contents.filter((x) => x.id !== resource.id)
          })

          // update tabs to remove any links to the resource
          await tabsManager.removeResourceBookmarks(resource.id)
        }

        await telemetry.trackDeleteResource(
          resource.type,
          !isEverythingSpace,
          resources.length > 1
            ? DeleteResourceEventTrigger.OasisMultiSelect
            : DeleteResourceEventTrigger.OasisItem
        )

        log.debug('Resource removed:', resource.id)
      }

      if (resources.length > 1) {
        await telemetry.trackMultiSelectResourceAction(
          MultiSelectResourceEventAction.Delete,
          resources.length,
          isEverythingSpace ? 'oasis' : 'space'
        )
      }
    } catch (error) {
      log.error('Error removing references:', error)
    }

    if ($searchValue) {
      await handleSearch($searchValue)
    }

    toasts.success('Resources deleted!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  const handleDropOnSpace = async (spaceId: string, drag: DragculaDragEvent<DragTypes>) => {
    //const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    const toast = toasts.loading(`Adding to space...`)

    try {
      if (drag.isNative) {
        const parsed = await processDrop(drag.event!)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
        log.debug('Resources', newResources)

        await oasis.addResourcesToSpace(
          spaceId,
          newResources.map((r) => r.id),
          SpaceEntryOrigin.ManuallyAdded
        )

        for (const r of newResources) {
          telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
        }
      } else if (
        drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        let resource: Resource | null = null
        if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
          resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
        } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
          const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
          resource = await resourceFetcher()
        }

        if (resource === null) {
          log.warn('Dropped resource but resource is null! Aborting drop!')
          drag.abort()
          return
        }

        await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)

        // FIX: Not exposed outside OasisSpace component.. cannot reload directlry :'( !?
        //await loadSpaceContents(spaceId)
      }

      await loadEverything()
    } catch (error) {
      log.error('Error dropping:', error)
      toast.error('Error dropping: ' + (error as Error).message)
      drag.abort()
      return
    }
    drag.continue()

    toast.success(`Resources added!`)
  }

  const openResourceDetailsModal = (resourceId: string) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)
  }

  const closeResourceDetailsModal = () => {
    resourceDetailsModalSelected.set(null)
    showResourceDetails.set(false)
  }

  const openResourceAsTab = async (id: string) => {
    const resource = await resourceManager.getResource(id)
    if (!resource) {
      log.error('Resource not found')
      return
    }

    const url =
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
      resource.metadata?.sourceURI
    if (!url) {
      // TODO: figure out what to do with resources that don't have a URL
      log.error('Resource URL not found')
      toasts.error('Resource can not be opened as a tab')
      return
    }

    tabsManager.addPageTab(url, {
      active: true,
      trigger: CreateTabEventTrigger.AddressBar
    })
  }

  const handleOpen = async (e: CustomEvent<string>, trackSource: boolean = false) => {
    openResourceDetailsModal(e.detail)

    if (trackSource) {
      resourceManager.getResource(e.detail, { includeAnnotations: false }).then((resource) => {
        if (resource) {
          telemetry.trackOpenResource(resource.type, OpenResourceEventFrom.Oasis)
        }
      })
    }
  }

  const handleCreateEmptySpace = async () => {
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace({
      detail: {
        name: '.tempspace',
        aiEnabled: false,
        colors: ['#000000', '#ffffff'],
        userPrompt: ''
      }
    })

    isCreatingNewSpace.set(true)
    selectedSpaceId.set(spaceID)
  }

  const handleCreateSpace = async (
    e: CustomEvent<{
      name: string
      aiEnabled: boolean
      colors: ['string', 'string']
      userPrompt: string
    }>
  ) => {
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace(
      e,
      e.detail.name,
      e.detail.colors,
      e.detail.userPrompt
    )

    if (e.detail.aiEnabled) {
      await tick()
      await createSpaceRef.createSpaceWithAI(spaceID, e.detail.userPrompt, e.detail.colors)
    }
  }

  const handleDeleteSpace = async () => {
    await oasisSpace.handleDeleteSpace(false, true)
    isCreatingNewSpace.set(false)
  }

  const handleSpaceDeleted = async (e: CustomEvent) => {
    selectedSpaceId.set('all')
  }

  const handleSpaceSelected = async (e: CustomEvent<string>) => {
    log.debug('Space selected:', e.detail)
    selectedSpaceId.set(e.detail)
  }

  const handleUpdatedSpace = async (e: CustomEvent<string | undefined>) => {
    log.debug('Space updated:', e.detail)
    isCreatingNewSpace.set(false)
    await tick()

    if (e.detail) {
      selectedSpaceId.set(e.detail)
      oasis.selectedSpace.set(e.detail)
    }
  }

  const handleCreatingNewSpace = () => {
    isCreatingNewSpace.set(true)
  }

  const handleDoneCreatingNewSpace = () => {
    isCreatingNewSpace.set(true)
  }

  let isSearching = false
  let searchTimeout: NodeJS.Timeout | null = null

  const debouncedSearch = useDebounce((value: string) => {
    if (showTabSearch !== 2) return

    if (value.length === 0) {
      searchResults.set([])
      hasSearched = false
      isSearching = false
      if (!hasLoadedEverything) {
        hasLoadedEverything = true
        loadEverything()
      }
    } else {
      handleSearch(value).then(() => {
        isSearching = false
      })
    }

    hasLoadedEverything = value.length === 0
  }, 300)

  let previousSearchValue = ''

  $: if (showTabSearch === 2) {
    loadEverything(true)
  }

  $: if (showTabSearch === 2 && $searchValue !== previousSearchValue) {
    isSearching = true
    previousSearchValue = $searchValue

    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    // does two things: second layer flood defense & prevents empty state from loading everything immediately, which clogs input
    searchTimeout = setTimeout(async () => {
      await debouncedSearch($searchValue)
    }, 300)
  }

  $: if (showTabSearch !== 2) {
    closeResourceDetailsModal()
  }

  const handleOasisFilterChange = (e: CustomEvent<string>) => {
    log.debug('Filter change:', e.detail)
    debouncedSearch($searchValue)
  }

  const closeOnboarding = async () => {
    onboardingOpen.set(false)

    const existingOnboardingSettings = window.api.getUserConfigSettings().onboarding
    await window.api.updateUserConfigSettings({
      onboarding: {
        ...existingOnboardingSettings,
        completed_stuff: true
      }
    })
  }

  let dragculaDragStartOpenTimeout: Timer | null = null // Used to delay opening stuff a bit, so that it doesnt laaagggg
  const handleDragculaDragStart = () => {
    dragculaDragStartOpenTimeout = setTimeout(() => {
      showTabSearch = 2
    }, 150)
  }
  const handleDragculaDragEnd = (drag: DragOperation) => {
    // TODO: Only close when dropped outside
    if (dragculaDragStartOpenTimeout !== null) clearTimeout(dragculaDragStartOpenTimeout)

    for (const toId of ['drawer', 'folder-']) {
      if (drag.to?.id.startsWith(toId)) {
        for (const fromId of ['drawer', 'folder-']) {
          if (drag.from?.id.startsWith(fromId)) {
            return
          }
        }
      }
    }

    showTabSearch = 0
  }

  onDestroy(
    Dragcula.get().targetDomElement.subscribe((el: HTMLElement) => {
      // We need to manually query as bits-ui/svelte-vaul shit doesnt expose element ref.. because ofc why would anyone neeeed that!!?
      const drawerContentEl = document.querySelector('.drawer-content')
      if (drawerContentEl?.contains(el)) {
        drawerContentEl?.classList.add('hovering')
      } else {
        drawerContentEl?.classList.remove('hovering')
      }
    })
  )

  onMount(() => {
    Dragcula.get().on('dragstart', handleDragculaDragStart)
    Dragcula.get().on('dragend', handleDragculaDragEnd)
  })
  onDestroy(() => {
    Dragcula.get().off('dragstart', handleDragculaDragStart)
    Dragcula.get().off('dragend', handleDragculaDragEnd)
  })
</script>

<Drawer.Root
  dismissible={!$CONTEXT_MENU_OPEN}
  direction="bottom"
  open={showTabSearch !== 0}
  onOpenChange={(e) => {
    if (e === false) {
      resetSearch()
    }
  }}
>
  <Drawer.Portal>
    <Drawer.Overlay
      class="drawer-overlay fixed inset-0 z-10 transition-opacity duration-300 no-drag"
    />
    <Drawer.Content
      data-vaul-no-drag
      class="drawer-content fixed inset-x-4 bottom-4 will-change-transform no-drag z-[50001] mx-auto overflow-hidden rounded-xl transition duration-400 bg-[#FEFFFE] outline-none"
      style="width: fit-content;"
    >
      {#if $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
        <OasisResourceModalWrapper
          resourceId={$resourceDetailsModalSelected}
          active
          on:close={() => closeResourceDetailsModal()}
        />
      {/if}
      <!-- <Motion
        let:motion
        animate={{
          height: showTabSearch === 1 ? 'auto' : 'calc(100vh - 200px)',
          width: showTabSearch === 1 ? '496px' : 'calc(70vw - 0px)',
          transition: {
            duration: showTabSearch === 1 ? 0.45 : 0.8,
            ease: [0.16, 1, 0.3, 1]
          }
        }}
      > -->
      <div class="">
        {#if $searchValue.length > 0 && showTabSearch === 2}
          <button
            data-vaul-no-drag
            class="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F8F9] text-[#949595] transition-transform focus:scale-95 focus-visible:shadow-focus-ring-button active:scale-75"
            on:click={() => {
              resetSearch()
            }}
          >
            <Icon name="close" />
          </button>
        {:else if showTabSearch === 1 && $searchValue.length < 20 && !$isCreatingNewSpace}
          <button
            class="absolute right-3 transform bottom-[0.85rem] z-10 flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-pink-300/50 p-2 rounded-lg duration-200 focus-visible:shadow-focus-ring-button active:scale-95"
            on:click={() => {
              showTabSearch = 2
            }}
            aria-label="Switch tabs"
          >
            <span>
              {$searchValue.length > 0 ? 'Search My Stuff' : 'Open My Stuff'}
            </span>
            <Command.Shortcut class="flex-shrink-0 bg-neutral-100 rounded-lg p-1">
              {#if navigator.platform.startsWith('Mac')}
                ⌘O
              {:else}
                Ctrl+O
              {/if}
            </Command.Shortcut>
          </button>
        {/if}

        <Command.Root
          class="[&_[data-cmdk-group-heading]]:text-neutral-500 {showTabSearch === 2 &&
          $selectedSpaceId === null
            ? ''
            : ''} !relative w-full transition-transform will-change-transform flex flex-col items-center justify-end [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group]:not([hidden])_~[data-cmdk-group]]:pt-0 [&_[data-cmdk-group]]:px-2 [&_[data-cmdk-input-wrapper]_svg]:h-5 [&_[data-cmdk-input-wrapper]_svg]:w-5 [&_[data-cmdk-input]]:h-12 [&_[data-cmdk-item]]:px-4 [&_[data-cmdk-item]]:py-4 [&_[data-cmdk-item]_svg]:h-5 [&_[data-cmdk-item]_svg]:w-5"
          loop
          shouldFilter={false}
          bind:selectFirstCommandItem
        >
          <!-- <AnimatePresence show={true} mode="popLayout"> -->
          <!-- <Motion
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: 0.5,
              ease: [0.26, 0.08, 0.25, 1]
            }}
            let:motion
          > -->
          <div
            class={`${
              showTabSearch === 1
                ? `w-[514px] overflow-y-scroll !no-scrollbar ${$searchValue.length > 0 ? 'h-[450px]' : 'h-[58px]'}`
                : 'w-[90vw] h-[calc(100vh-120px)]'
            }`}
          >
            {#if showTabSearch === 1 && $searchValue.length}
              <Command.List class="m-2 no-scrollbar">
                {#each $commandFilterResult as item (item.id)}
                  <CommandMenuItem {item} on:select={handleSelect} />
                {/each}
              </Command.List>
            {:else if showTabSearch === 2}
              <div class="flex h-full">
                {#if $onboardingOpen}
                  <Onboarding
                    on:close={closeOnboarding}
                    title="Stay on top of your stuff"
                    tip=""
                    sections={[
                      {
                        title: 'Save anything',
                        description: `<p>Save webpages, tweets, YouTube videos, screenshots, PDFs,and more. </p>`,
                        imgSrc: stuffAdd,
                        imgAlt: 'Save anything',
                        iconName: 'leave'
                      },
                      {
                        title: '(Auto)-organize',
                        description: `<p>Create spaces and curate your items manually. Or let Surf do it for you.</p>`,
                        imgSrc: stuffSmart,
                        imgAlt: '(Auto)-organize',
                        iconName: 'rectangle-group'
                      },
                      {
                        title: 'Find',
                        description: `<p>Easily find anything you've saved, with Surf search.</p>`,
                        imgSrc: stuffSearch,
                        imgAlt: 'Find',
                        iconName: 'search'
                      }
                    ]}
                    buttonText="Continue"
                  />
                {/if}

                <div class="sidebar-wrap h-full bg-sky-500/40 w-[18rem] max-w-[18rem]">
                  {#key $spaces}
                    <SpacesView
                      bind:this={createSpaceRef}
                      {spaces}
                      {resourceManager}
                      showPreview={true}
                      type="horizontal"
                      interactive={false}
                      on:space-selected={(e) => selectedSpaceId.set(e.detail.id)}
                      on:createTab={(e) => dispatch('create-tab-from-space', e.detail)}
                      on:create-empty-space={handleCreateEmptySpace}
                      on:open-space-and-chat
                      on:delete-space={handleDeleteSpace}
                      on:Drop
                    />
                  {/key}
                </div>

                <div class="stuff-wrap h-full w-full relative">
                  <Tooltip rootID="stuff" />
                  {#if showTabSearch === 2 && ($selectedSpaceId === 'all' || $selectedSpaceId === null)}
                    <button
                      class="absolute left-6 bottom-[1.4rem] transform z-[10000] flex items-center justify-center gap-2 transition-all cursor-pointer bg-white hover:bg-pink-300/50 p-2 rounded-lg duration-200 focus-visible:shadow-focus-ring-button active:scale-95"
                      on:click={() => {
                        $onboardingOpen = !$onboardingOpen
                      }}
                      use:tooltip={{
                        text: 'Need help?',
                        position: 'right'
                      }}
                      aria-label="Show onboarding"
                    >
                      <Icon name="info" />
                    </button>
                  {/if}

                  {#if $selectedSpaceId !== null && $selectedSpaceId !== 'all'}
                    {#key $selectedSpaceId}
                      <OasisSpace
                        spaceId={$selectedSpaceId}
                        active
                        showBackBtn
                        hideResourcePreview
                        handleEventsOutside
                        {historyEntriesManager}
                        on:open={handleOpen}
                        on:open-and-chat
                        on:go-back={() => selectedSpaceId.set(null)}
                        on:deleted={handleSpaceDeleted}
                        on:updated-space={handleUpdatedSpace}
                        on:creating-new-space={handleCreatingNewSpace}
                        on:done-creating-new-space={handleDoneCreatingNewSpace}
                        on:select-space={handleSpaceSelected}
                        on:batch-open
                        on:batch-remove={handleResourceRemove}
                        on:open-space-and-chat
                        insideDrawer={true}
                        bind:this={oasisSpace}
                        {searchValue}
                      />
                    {/key}
                  {:else}
                    <DropWrapper
                      acceptDrop={true}
                      {spaceId}
                      acceptsDrag={(drag) => {
                        if (
                          drag.isNative ||
                          drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                          drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                          drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
                        ) {
                          return true
                        }
                        return false
                      }}
                      on:Drop={(e) => handleDropOnSpace(spaceId, e.detail)}
                      zonePrefix="drawer-"
                    >
                      <div class="w-full h-full">
                        {#if $resourcesToShow.length > 0}
                          {#key $selectedSpaceId}
                            <OasisResourcesViewSearchResult
                              resources={resourcesToShow}
                              selected={$selectedItem}
                              isEverythingSpace={true}
                              isInSpace={false}
                              scrollTop={0}
                              on:click={handleItemClick}
                              on:open={(e) => handleOpen(e, true)}
                              on:open-and-chat
                              on:open-space-as-tab
                              on:remove={handleResourceRemove}
                              on:batch-remove={handleResourceRemove}
                              on:batch-open
                              on:new-tab
                              {searchValue}
                            />
                          {/key}

                          {#if $loadingContents}
                            <div class="floating-loading">
                              <Icon name="spinner" size="20px" />
                            </div>
                          {/if}
                        {:else if isSearching && $searchValue.length > 0}
                          <div class="content-wrapper h-full flex items-center justify-center">
                            <div
                              class="content flex flex-col items-center justify-center text-center space-y-4"
                            >
                              <Icon name="spinner" size="22px" />
                              <p class="text-lg font-medium text-gray-700">
                                Searching your stuff...
                              </p>
                            </div>
                          </div>
                        {:else if $resourcesToShow.length === 0 && $searchValue.length > 0}
                          <div class="content-wrapper h-full flex items-center justify-center">
                            <div
                              class="content flex flex-col items-center justify-center text-center space-y-4"
                            >
                              <Icon name="leave" size="22px" class="mb-2" />

                              <p class="text-lg font-medium text-gray-700">
                                No stuff found for "{$searchValue}". Try a different search term.
                              </p>
                            </div>
                          </div>
                        {/if}
                      </div>
                    </DropWrapper>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
          <!-- </Motion> -->
          <!-- </AnimatePresence> -->

          {#if $selectedSpaceId === 'all' || $selectedSpaceId === null || showTabSearch === 1}
            <div
              class={showTabSearch === 2
                ? 'w-[calc(100%-19rem)] absolute bottom-0 right-0 flex items-center justify-center bg-[rgba(255,255,255,0.9)] backdrop-blur-[30px] z-10 p-2 border-[1px] border-neutral-200 m-[0.5rem] rounded-2xl'
                : 'w-full absolute bottom-0 flex items-center justify-center p-2 border-t-[1px] border-neutral-100 bg-[rgba(255,255,255,0.9)] backdrop-blur-[30px]'}
            >
              <div class={'flex items-center relative'}>
                <Command.Input
                  id="search-field"
                  {placeholder}
                  {breadcrumb}
                  loading={$isLoadingCommandItems || isSearching || $loadingContents}
                  bind:value={$searchValue}
                  class={showTabSearch === 2
                    ? 'w-[32rem] bg-neutral-200 rounded-lg py-2 px-4'
                    : 'w-[32rem] py-4 pl-2'}
                />

                {#if showTabSearch === 2 && $selectedSpaceId === null && !!$searchValue}
                  <div class="rounded-lg bg-neutral-100 p-2 absolute left-full">
                    <select
                      bind:value={$selectedFilter}
                      on:change={handleOasisFilterChange}
                      class="bg-transparent focus:outline-none"
                    >
                      <option value="all">Show All</option>
                      <option value="saved_by_user">Saved by Me</option>
                    </select>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </Command.Root>
      </div>
      <!-- </Motion> -->
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow: hidden;
    border-radius: 12px;
  }

  .page-background {
    background: linear-gradient(180deg, #f9f5e6, rgb(237, 236, 226));
    background: linear-gradient(
      180deg,
      color(display-p3 0.9725 0.9686 0.949) 0%,
      color(display-p3 0.9725 0.9686 0.949) 100%
    );
  }

  .background {
    background: linear-gradient(180deg, #e6ddda 0%, #f8f7f1 100%);
  }

  .modal-wrapper {
    position: absolute;
    top: 4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }

  .drawer-bar {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1000;
  }

  /* FIXES double drop as webview still consumes drop if pointer is inside overlay. */
  :global(body:has(.drawer-content.hovering) webview) {
    pointer-events: none !important;
  }

  :global([data-dialog-portal] .drawer-overlay) {
    background: rgba(0, 0, 0, 0.35);
    opacity: 1;
  }
  :global(body[data-dragging='true'] .drawer-overlay) {
    pointer-events: none;
  }
  :global(
      body[data-dragging='true']:not(:has(.drawer-content.hovering))
        [data-dialog-portal]
        .drawer-overlay
    ) {
    opacity: 0 !important;
  }

  /* Hides the Drawer when dragging but not targeting it */
  :global(body[data-dragging='true'] .drawer-content:not(.hovering)) {
    transform: translateY(calc(100vh - 150px)) !important;
  }
</style>
