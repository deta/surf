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
    'open-space': Space
    open: string
    'create-resource-from-oasis': string
    'create-tab-from-space': { tab: TabSpace; active: boolean }
    'new-tab': {
      url: string
      active: boolean
    }
    deleted: string
  }
</script>

<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { Motion, AnimatePresence } from 'svelte-motion'

  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import Chat from '../Browser/Chat.svelte'
  import SearchInput from '../Oasis/SearchInput.svelte'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    ResourcePost,
    ResourceTag,
    type ResourceObject,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import { wait } from '../../utils/time'
  import OasisResourcesView from '../Oasis/OasisResourcesView.svelte'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type HistoryEntry,
    type ResourceDataPost,
    type SFFSResourceTag,
    type Space,
    type SpaceEntry,
    type SpaceSource
  } from '../../types'
  import DropWrapper from '../Oasis/DropWrapper.svelte'
  import CreateNewResource from '../Oasis/CreateNewResource.svelte'
  import browserBackground from '../../../../public/assets/foggy-placeholder.png'

  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    processDrop,
    type MediaParserResult,
    type MediaParserResultURL,
    type MediaParserResultUnknown
  } from '../../service/mediaImporter'

  import { useToasts } from '../../service/toast'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'
  import { clickOutside, tooltip } from '../../utils/directives'
  import { fly } from 'svelte/transition'
  import OasisSpaceSettings from '../Oasis/OasisSpaceSettings.svelte'
  import { RSSParser } from '@horizon/web-parser/src/rss/index'
  import { summarizeText } from '../../service/ai'
  import type { ResourceContent } from '@horizon/web-parser'
  import {
    checkIfYoutubeUrl,
    optimisticCheckIfUrl,
    optimisticCheckIfURLOrIPorFile,
    parseStringIntoBrowserLocation
  } from '../../utils/url'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { isModKeyAndKeyPressed, isModKeyPressed } from '../../utils/keyboard'
  import { DragculaDragEvent } from '@horizon/dragcula'
  import type { Tab, TabPage, TabSpace } from '../Browser/types'

  import * as Command from '../command'
  import Fuse from 'fuse.js'
  import { debounce, result } from 'lodash'
  import TabSearchItem, { type CMDMenuItem } from './TabSearchItem.svelte'
  import { parseStringIntoUrl, truncateURL } from '../../utils/url'
  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../service/history'
  import { getFileType } from '../../utils/files'
  import * as Dialog from '../dialog'
  import OasisSpace from '../Oasis/OasisSpace.svelte'
  import SpacesView from '../Oasis/SpacesView.svelte'
  import CreateNewSpace from './CreateNewSpace.svelte'
  import { spring } from 'svelte/motion'
  import { useDebounce } from '../../utils/debounce'
  import { useConfig } from '../../service/config'
  import { Drawer } from 'vaul-svelte'
  import { useLocalStorageStore } from '../../utils/localstorage'
  import {
    AddResourceToSpaceEventTrigger,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  export let activeTabs: Tab[] = []
  export let showTabSearch = 0

  const log = useLogScope('NEWTABOVERLAY')
  const dispatch = createEventDispatcher<OverlayEvents>()
  const config = useConfig()
  const userConfigSettings = config.settings

  let createSpaceRef: any

  let page: 'tabs' | 'oasis' | 'history' | 'spaces' | null = null
  let filteredItems: CMDMenuItem[] = []
  let historyEntries: HistoryEntry[] = []
  let googleSuggestions: string[] = []
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

  let selectFirstCommandItem: () => void

  const preSelectedItemId = writable<string | null>(null)

  const searchValue = writable('')

  const oasisSearchResults = writable<Resource[]>([])
  const googleSuggestionResults = writable<string[]>([])
  const historyEntriesResults = writable<HistoryEntry[]>([])
  const filteredCommandItems = writable<CMDMenuItem[]>([])

  const isFetchingOasisSearchResults = writable(false)
  const isFetchingGoogleSuggestionResults = writable(false)
  const isFetchingHistoryEntriesResults = writable(false)
  const isFilteringCommandItems = writable(false)

  const selectedFilter = useLocalStorageStore<'all' | 'saved_by_user'>(
    'oasis-filter-resources',
    'all'
  )

  const isLoadingCommandItems = derived(
    [
      isFetchingOasisSearchResults,
      isFetchingGoogleSuggestionResults,
      isFetchingHistoryEntriesResults,
      isFilteringCommandItems
    ],
    ([
      isFetchingOasisSearchResults,
      isFetchingGoogleSuggestionResults,
      isFetchingHistoryEntriesResults,
      isFilteringCommandItems
    ]) => {
      return (
        isFetchingOasisSearchResults ||
        isFetchingGoogleSuggestionResults ||
        isFetchingHistoryEntriesResults ||
        isFilteringCommandItems
      )
    }
  )

  // $: commands = filteredItems.filter((item) => item.type === 'command')
  // $: tabs = filteredItems.filter((item) => item.type === 'tab')
  // $: history = filteredItems.filter((item) => item.type === 'history').slice(0, 5)
  // $: resources = filteredItems.filter((item) => item.type === 'resource')
  // $: spacesItems = filteredItems.filter((item) => item.type === 'space' && item.id !== 'all')
  // $: suggestions = filteredItems.filter(
  //   (item) => item.type === 'suggestion' || item.type === 'google-search'
  // )
  // $: navigate = filteredItems.filter((item) => item.type === 'navigate')
  // $: other = filteredItems.filter(
  //   (item) =>
  //     item.type !== 'command' &&
  //     item.type !== 'tab' &&
  //     item.type !== 'suggestion' &&
  //     item.type !== 'google-search' &&
  //     item.type !== 'history' &&
  //     item.type !== 'resource' &&
  //     item.type !== 'space' &&
  //     item.type !== 'navigate'
  // )

  $: commandItems = [
    ...browserCommands,
    ...$spaces.map((space) => spaceToItem(space, { weight: 1 }))
  ]

  $: placeholder =
    showTabSearch === 2
      ? 'Search Oasis...'
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
        ? 'Oasis'
        : page === 'history'
          ? 'History'
          : page === 'spaces'
            ? 'Spaces'
            : undefined
  // function handleKeyDown(e: KeyboardEvent) {
  //   log.debug('handleKeyDown', e.key, $searchValue)
  //   if (e.key === 'Backspace' && page && $searchValue === '') {
  //     page = null
  //   }
  // }
  //

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

  function historyEntryToItem(entry: HistoryEntry, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    return {
      id: entry.id,
      label: entry.title,
      value: entry.url,
      iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(entry.url!)}`,
      type: 'history',
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

  function googleSuggestionToItem(suggestion: string) {
    return {
      id: `google-suggestion-${suggestion}`,
      type: 'suggestion',
      label: suggestion,
      value: suggestion,
      icon: 'search',
      score: 0.5
    } as CMDMenuItem
  }
  // async function updateFilteredItems() {
  //   if (showTabSearch === 1) {
  //     let results = []
  //     if (page === 'oasis') {
  //       results = oasisResources.map((resource) => resourceToItem(resource, { score: 0.4 }))
  //     } else if ($searchValue) {
  //       const fuseResults = fuse.search($searchValue)
  //       results = fuseResults.map((result) => ({ ...result.item, score: result.score }))
  //       // Add Google search option as the first item if it's not an exact match
  //       if (!results.some((item) => item.title === $searchValue || item.url === $searchValue)) {
  //         results.unshift({
  //           id: `general-search-${$searchValue}`,
  //           type: 'general-search',
  //           label: `${$searchValue}`,
  //           value: $searchValue,
  //           icon: 'search',
  //           score: 0
  //         })
  //       }
  //       results.push(
  //         ...googleSuggestions.map((suggestion) => ({
  //           id: `google-suggestion-${suggestion}`,
  //           type: 'suggestion',
  //           label: suggestion,
  //           value: suggestion,
  //           icon: 'search',
  //           score: 0.5
  //         }))
  //       )
  //       const url = parseStringIntoBrowserLocation($searchValue)
  //       if (url) {
  //         const urlCommand = {
  //           id: `open-search-url`,
  //           type: 'navigate',
  //           label: `Navigate to ${truncateURL(url)}`,
  //           icon: 'world',
  //           value: url,
  //           score: 1
  //         } as CMDMenuItem
  //         results.unshift(urlCommand)
  //       }
  //       results = [
  //         ...results,
  //         ...oasisResources.map((resource) => resourceToItem(resource, { score: 0.4 }))
  //       ]
  //     } else if (page === 'spaces') {
  //       results = $spaces.map((space) => spaceToItem(space, { score: 0.1 }))
  //     } else if (page === 'tabs') {
  //       results = activeTabs.map((tab) => tabToItem(tab, { score: 0 }))
  //     } else if (page === 'history') {
  //       results = historyEntries.map((entry) => historyEntryToItem(entry, { score: 0.1 }))
  //     } else {
  //       results = [
  //         ...activeTabs.map((tab) => tabToItem(tab, { score: 0 })),
  //         ...historyEntries.map((entry) => historyEntryToItem(entry, { score: 0.1 })),
  //         ...$spaces.map((space) => spaceToItem(space, { score: 0.1 })),
  //         ...oasisResources.map((resource) => resourceToItem(resource, { score: 0.1 })),
  //         ...browserCommands.map((cmd) => ({ ...cmd, score: 0.2 }))
  //       ]
  //     }
  //     results.sort((a, b) => (a.score || 0) - (b.score || 0))
  //     // while (results.length < 5) {
  //     //   results.push({
  //     //     type: 'placeholder',
  //     //     title: `Suggestion ${results.length + 1}`,
  //     //     score: 1
  //     //   })
  //     // }
  //     filteredItems = results.slice(0, 15)
  //   }
  // }

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

      if (!$isFetchingOasisSearchResults) {
        fetchOasisResults(searchValue)
      }

      if (!$isFetchingGoogleSuggestionResults) {
        fetchGoogleSuggestions(searchValue)
      }

      // if (!$isFetchingHistoryEntriesResults) {
      //   fetchHistoryEntries(searchValue)?.then(() => {
      //     log.debug('Fetched history entries done')
      //   })
      // }
    }

    return []
  })

  const commandFilterResult = derived(
    [searchValue, commandFilter, filteredCommandItems, oasisSearchResults, googleSuggestionResults],
    ([
      searchValue,
      commandFilter,
      filteredCommandItems,
      oasisSearchResults,
      googleSuggestionResults
    ]) => {
      deboundedSelectFirstCommandItem()

      const items = [
        ...commandFilter,
        ...filteredCommandItems,
        // ...historyEntriesResults.map((entry) => historyEntryToItem(entry, { score: 0.1 })),
        ...googleSuggestionResults.map((suggestion) => googleSuggestionToItem(suggestion)),
        ...oasisSearchResults.map((resource) => resourceToItem(resource, { score: 0.4 }))
      ]

      if (!items.some((item) => item.label === searchValue || item.value === searchValue)) {
        items.unshift({
          id: `general-search-${searchValue}`,
          type: 'general-search',
          label: `${searchValue}`,
          value: searchValue,
          icon: 'search',
          score: 1
        })
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

  // const fetchHistoryEntries = useDebounce(async ($searchValue: string) => {
  //   try {
  //     if (!historyCache || Date.now() - historyCache.timestamp > CACHE_EXPIRY) {
  //       $isFetchingHistoryEntriesResults = true
  //       log.debug('Fetching history entries...')
  //       const entries = await historyEntriesManager.searchEntries($searchValue)
  //       log.debug('History entries:', entries)
  //       const sortedEntries = entries.sort(
  //         (a, b) => new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
  //       )
  //       const uniqueSites = Object.values(
  //         sortedEntries.reduce(
  //           (acc, entry) => {
  //             if (
  //               !acc[entry.site] ||
  //               new Date(entry.entry.createdAt) > new Date(acc[entry.site].createdAt)
  //             ) {
  //               acc[entry.site] = entry.entry
  //             }
  //             return acc
  //           },
  //           {} as Record<string, HistoryEntry>
  //         )
  //       )
  //       historyCache = { data: uniqueSites, timestamp: Date.now() }
  //     }

  //     $historyEntriesResults = historyCache.data
  //   } catch (error) {
  //     log.error('Error fetching history entries:', error)
  //     $historyEntriesResults = []
  //   } finally {
  //     $isFetchingHistoryEntriesResults = false
  //   }
  // }, 300)

  const fetchOasisResults = useDebounce(async (query: string) => {
    try {
      $isFetchingOasisSearchResults = true
      if (query.length > 2) {
        // const data = await resourceManager.listResourcesByTags([
        const data = await resourceManager.searchResources(
          query,
          [
            ResourceManager.SearchTagDeleted(false),
            ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')
            // ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne')
            // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
            // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
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

  const fetchGoogleSuggestions = useDebounce(async (query: string) => {
    try {
      if (query.length > 2) {
        $isFetchingGoogleSuggestionResults = true
        // @ts-ignore
        const data = await window.api.fetchJSON(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
          {
            // HACK: this is needed to get Google to properly encode the suggestions, without this Umlaute are not encoded properly
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            }
          }
        )
        log.debug('Google suggestions:', data)
        $googleSuggestionResults = data[1]
          .slice(0, 4)
          .filter((suggestion: string) => suggestion !== $searchValue)
      } else {
        $googleSuggestionResults = []
      }
      // updateFilteredItems()
    } catch (error) {
      log.error('Error fetching Google suggestions:', error)
      $googleSuggestionResults = []
    } finally {
      $isFetchingGoogleSuggestionResults = false
    }
  }, 150)

  // $: {
  //   fetchGoogleSuggestions($searchValue)
  //   updateHistory($searchValue)
  //   fetchOasisResults($searchValue)
  // }
  function handleSelect(e: CustomEvent<CMDMenuItem>) {
    const item = e.detail
    log.debug('handleSelect', item)
    if (item.type === 'tab') {
      dispatch('activate-tab', item.id)
    } else if (item.type === 'history') {
      dispatch('open-url', item.value!)
    } else if (item.type === 'command' || item.type === 'navigate') {
      if (item.id === 'open-search-url') {
        dispatch('open-url', item.value!)
      } else {
        dispatch(item.id as keyof TabSearchEvents)
      }
    } else if (item.type === 'suggestion' || item.type === 'google-search') {
      dispatch('open-url', `https://www.google.com/search?q=${encodeURIComponent(item.value!)}`)
    } else if (item.type === 'general-search') {
      // check if it's a URL
      const isValidURL = optimisticCheckIfURLOrIPorFile(item.value!)
      console.error('isValidURL', isValidURL)
      if (isValidURL) {
        dispatch('open-url', item.value!)
      } else {
        dispatch('open-url', `https://www.google.com/search?q=${encodeURIComponent(item.value!)}`)
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
    googleSuggestions = []
    showTabSearch = 0
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
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: '⌘0', type: 'command', icon: 'maximize' }
  ] as CMDMenuItem[]

  export let spaceId: string
  export let historyEntriesManager: HistoryEntriesManager

  $: isEverythingSpace = spaceId === 'all'

  const oasis = useOasis()

  const toasts = useToasts()

  const resourceManager = oasis.resourceManager
  const telemetry = resourceManager.telemetry
  const spaces = oasis.spaces

  const showChat = writable(false)
  const resourceIds = writable<string[]>([])
  const chatPrompt = writable('')
  const selectedItem = writable<string | null>(null)
  const showNewResourceModal = writable(false)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  const showCreationModal = writable(false)

  const selectedSpaceId = writable<string | null>(null)

  const searchResults = writable<ResourceSearchResultItem[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])
  const spaceContents = writable<SpaceEntry[]>([])

  const resourcesToShow = derived(
    [searchValue, searchResults, everythingContents],
    ([searchValue, searchResults, everythingContents]) => {
      if (searchValue && showTabSearch === 2) {
        return searchResults
      }

      return everythingContents
    }
  )

  $: log.debug('resourcesToShow', $resourcesToShow, $everythingContents)

  const isResourceDetailsModalOpen = derived(
    [showResourceDetails, resourceDetailsModalSelected],
    ([$showResourceDetails, $resourceDetailsModalSelected]) => {
      return $showResourceDetails && !!$resourceDetailsModalSelected
    }
  )

  const loadEverything = async () => {
    try {
      if ($loadingContents) {
        log.debug('Already loading everything')
        return
      }

      loadingContents.set(true)
      searchResults.set([])

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

      searchResults.set([])

      everythingContents.set([])

      await tick()

      everythingContents.set(items)
    } catch (error) {
      log.error('Error loading everything:', error)
    } finally {
      loadingContents.set(false)
    }
  }

  const handleSearch = async (searchValueInput: string) => {
    let value = searchValueInput

    if (!value) {
      searchResults.set([])
      return
    }

    const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
    const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

    if (hashtags.length === value.split(' ').length) {
      value = ''
    }

    await telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, false)

    const result = await resourceManager.searchResources(
      value,
      [
        ResourceManager.SearchTagDeleted(false),
        ...($selectedFilter === 'saved_by_user'
          ? [
              ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
              ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
              ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne')
            ]
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

  const handleResourceRemove = async (e: CustomEvent<string>) => {
    const resourceId = e.detail
    log.debug('removing resource', resourceId)

    const resource = await resourceManager.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found')
      return
    }

    const references = await resourceManager.getAllReferences(resourceId, $spaces)
    const isFromLiveSpace = !!resource.tags?.find(
      (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
    )

    let numberOfReferences = 0
    if (isEverythingSpace) {
      numberOfReferences = references.length
    }

    const confirm = window.confirm(
      !isEverythingSpace && !isFromLiveSpace
        ? `Remove reference? The original will still be in Everything.`
        : numberOfReferences > 0
          ? `This resource will be deleted permanently including all of its ${numberOfReferences} references.`
          : `This resource will be deleted permanently.`
    )

    if (!confirm) {
      return
    }

    try {
      log.debug('removing resource references', references)
      for (const reference of references) {
        log.debug('deleting reference', reference)
        await resourceManager.deleteSpaceEntries([reference.entryId])
      }
    } catch (error) {
      log.error('Error removing references:', error)
    }

    if (isEverythingSpace) {
      log.debug('deleting resource from oasis', resourceId)
      await resourceManager.deleteResource(resourceId)
      everythingContents.update((contents) => {
        return contents.filter((x) => x.id !== resourceId)
      })
    }

    await telemetry.trackDeleteResource(resource.type, !isEverythingSpace)

    log.debug('Resource removed:', resourceId)
    toasts.success('Resource deleted!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      showTabSearch = showTabSearch === 1 ? 2 : 1
      return
    }

    if (showTabSearch !== 2) return

    log.debug('Key down:', e.key)
    if (e.key === ' ' && $selectedItem && !$isResourceDetailsModalOpen && !$showSettingsModal) {
      e.preventDefault()
      openResourceDetailsModal($selectedItem)
    } else if (isModKeyAndKeyPressed(e, 'Enter') && $selectedItem && !$isResourceDetailsModalOpen) {
      e.preventDefault()

      const resource = await resourceManager.getResource($selectedItem)
      if (!resource) return

      const url = resource.metadata?.sourceURI
      if (!url) return

      dispatch('new-tab', { url: url, active: e.shiftKey })
    } else if (e.key === 'Backspace' && page && $searchValue === '') {
      page = null
    }
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)

    if (
      ['sidebar-pinned-tabs', 'sidebar-unpinned-tabs', 'sidebar-magic-tabs'].includes(
        drag.from?.id || ''
      ) &&
      !drag.metaKey
    ) {
      drag.item!.dragEffect = 'copy' // Make sure tabs are always copy from sidebar
    }

    let resourceIds: string[] = []
    try {
      if (drag.isNative) {
        const event = new DragEvent('drop', { dataTransfer: drag.data })
        log.debug('Dropped native', event)

        const isOwnDrop = event.dataTransfer?.types.includes(MEDIA_TYPES.RESOURCE)
        if (isOwnDrop) {
          log.debug('Own drop detected, ignoring...')
          log.debug(event.dataTransfer?.files)
          return
        }

        const parsed = await processDrop(event)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
        log.debug('Resources', newResources)

        for (const r of newResources) {
          resourceIds.push(r.id)
          telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
        }
      } else {
        log.debug('Dropped dragcula', drag.data)

        const existingResources: string[] = []

        const dragData = drag.data as { 'surf/tab': Tab; 'horizon/resource/id': string }
        if (dragData['surf/tab'] !== undefined) {
          if (dragData['horizon/resource/id'] !== undefined) {
            const resourceId = dragData['horizon/resource/id']
            resourceIds.push(resourceId)
            existingResources.push(resourceId)
          } else if (dragData['surf/tab'].type === 'page') {
            const tab = dragData['surf/tab'] as TabPage

            if (tab.resourceBookmark) {
              log.debug('Detected resource from dragged tab', tab.resourceBookmark)
              resourceIds.push(tab.resourceBookmark)
              existingResources.push(tab.resourceBookmark)
            } else {
              log.debug('Detected page from dragged tab', tab)
              const newResources = await createResourcesFromMediaItems(
                resourceManager,
                [
                  {
                    type: 'url',
                    data: new URL(tab.currentLocation || tab.initialLocation),
                    metadata: {}
                  }
                ],
                ''
              )
              log.debug('Resources', newResources)

              for (const r of newResources) {
                resourceIds.push(r.id)
                telemetry.trackSaveToOasis(r.type, SaveToOasisEventTrigger.Drop, false)
              }
            }
          }
        }

        if (existingResources.length > 0) {
          await Promise.all(
            existingResources.map(async (resourceId) => {
              const resource = await resourceManager.getResource(resourceId)
              if (!resource) {
                log.error('Resource not found')
                return
              }

              log.debug('Detected resource from dragged tab', resource)

              const isSilent =
                resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.SILENT) !==
                undefined
              if (isSilent) {
                // remove silent tag if it exists sicne the user is explicitly adding it
                log.debug('Removing silent tag from resource', resourceId)
                await resourceManager.deleteResourceTag(resourceId, ResourceTagsBuiltInKeys.SILENT)
                telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Drop, false)
              }
            })
          )
        }
      }
      /*
      if (spaceId !== 'all') {
        await oasis.addResourcesToSpace(spaceId, resourceIds)

        resourceIds.forEach((id) => {
          resourceManager.getResource(id).then((resource) => {
            if (resource) {
              telemetry.trackAddResourceToSpace(resource.type, AddResourceToSpaceEventTrigger.Drop)
            }
          })
        })
      } else {
        await loadEverything()
      }
      */
      await loadEverything()
    } catch (error) {
      log.error('Error dropping:', error)
      toast.error('Error dropping: ' + (error as Error).message)
      drag.abort()
      return
    }
    drag.continue()

    toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )
  }

  const handleDragEnter = (drag: DragculaDragEvent) => {
    /*if (drag.data['surf/tab'] !== undefined) {
      const dragData = drag.data as { 'surf/tab': Tab }
      if ((active && drag.isNative) || (active && dragData['surf/tab'].type !== 'space')) {
        drag.continue()
        return
      }
    } else if (drag.data['oasis/resource'] !== undefined) {
      drag.continue()
      return
    }
    drag.abort()*/

    if (drag.data['surf/tab'] !== undefined) {
      const dragData = drag.data as { 'surf/tab': Tab }
      if (drag.isNative || dragData['surf/tab'].type !== 'space') {
        drag.continue()
        return
      }
    } else if (drag.data['oasis/resource'] !== undefined) {
      drag.continue()
      return
    }
    drag.abort()
  }

  const openResourceDetailsModal = (resourceId: string) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
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

    dispatch('new-tab', { url: url, active: true })
  }

  const handleOpen = async (e: CustomEvent<string>) => {
    // openResourceDetailsModal(e.detail)
    openResourceAsTab(e.detail)
  }

  const handleCreateSpace = async (
    e: CustomEvent<{
      name: string
      aiEnabled: boolean
      colors: ['string', 'string']
      userPrompt: string
    }>
  ) => {
    console.log('CREATING SPACE', e.detail.name, e.detail.aiEnabled)
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

  const focusInput = async (loop = false) => {
    try {
      log.debug('Focusing input...')
      await tick()

      const inputElement = document.getElementById('search-field') as HTMLInputElement

      if (inputElement) {
        inputElement.focus()
      }

      if (!loop) {
        await wait(300)
        focusInput(true)
      }
    } catch (err) {
      log.error('Failed to focus input:', err)
    }
  }

  onMount(() => {
    focusInput()
  })

  $: if (showTabSearch === 1 || showTabSearch === 2) {
    focusInput()
  }

  const debouncedSearch = useDebounce((value: string) => {
    handleSearch(value)
  }, 200)

  const deboundedEverything = useDebounce(() => {
    loadEverything()
  }, 200)

  const handleOasisFilterChange = (e: CustomEvent<string>) => {
    log.debug('Filter change:', e.detail)
    debouncedSearch($searchValue)
  }

  const debouncedTrackOpenOasis = useDebounce(() => {
    telemetry.trackOpenOasis()
  }, 500)

  $: if (showTabSearch === 2 && !!$searchValue) {
    log.debug('case 1')
    debouncedSearch($searchValue)
  }

  $: if (showTabSearch === 2 && !$searchValue) {
    log.debug('case 2')
    $searchResults = []
    deboundedEverything()
  }

  $: if (showTabSearch === 2) {
    debouncedTrackOpenOasis()
  }
</script>

<svelte:window
  on:keydown={handleKeyDown}
  on:DragStart={(drag) => {
    showTabSearch = 2
  }}
  on:DragEnd={(drag) => {
    showTabSearch = 0
  }}
/>

<!-- {#if $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    active
    on:close={() => closeResourceDetailsModal()}
    on:new-tab
  />
{/if} -->

<Drawer.Root
  preventScroll
  shouldScaleBackground
  direction="bottom"
  scrollLockTimeout={300}
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
      class="drawer-content fixed inset-x-4 bottom-4 will-change-transform no-drag z-[50001] mx-auto overflow-hidden rounded-md transition duration-400 bg-[#FEFFFE] outline-none"
      style="width: fit-content;"
    >
      <Motion
        let:motion
        animate={{
          height: showTabSearch === 1 ? 'auto' : 'calc(100vh - 200px)',
          width: showTabSearch === 1 ? '476px' : 'calc(70vw - 0px)',
          transition: {
            duration: showTabSearch === 1 ? 0.45 : 0.7,
            ease: [0.16, 1, 0.3, 1]
          }
        }}
      >
        <div use:motion>
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
          {:else if $searchValue.length === 0}
            <!-- <div
              class="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-transform focus:scale-95 focus-visible:shadow-focus-ring-button active:scale-75 rotate-6"
            >
              <Icon name="face" size="28" />
            </div> -->
            <button
              class="absolute right-4 transform {showTabSearch === 2 && $selectedSpaceId !== null
                ? 'bottom-7'
                : 'bottom-3'} z-10 flex items-center justify-center space-x-2 transition-all cursor-pointer hover:bg-pink-300/50 p-2 rounded-lg duration-200 focus-visible:shadow-focus-ring-button active:scale-95"
              on:click={() => {
                showTabSearch = showTabSearch === 1 ? 2 : 1
              }}
              aria-label="Switch tabs"
            >
              <span>Go to {showTabSearch === 1 ? 'Oasis' : 'Search'}</span>
              <Command.Shortcut class="flex-shrink-0 bg-neutral-100 rounded-lg p-1"
                >Tab</Command.Shortcut
              >
            </button>
          {/if}
          <Command.Root
            class="[&_[data-cmdk-group-heading]]:text-neutral-500 {showTabSearch === 2 &&
            $selectedSpaceId === null
              ? 'pt-2'
              : ''} !relative w-full transition-transform will-change-transform flex flex-col items-center justify-end  [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group]:not([hidden])_~[data-cmdk-group]]:pt-0 [&_[data-cmdk-group]]:px-2 [&_[data-cmdk-input-wrapper]_svg]:h-5 [&_[data-cmdk-input-wrapper]_svg]:w-5 [&_[data-cmdk-input]]:h-12 [&_[data-cmdk-item]]:px-4 [&_[data-cmdk-item]]:py-4 [&_[data-cmdk-item]_svg]:h-5 [&_[data-cmdk-item]_svg]:w-5"
            loop
            shouldFilter={false}
            bind:selectFirstCommandItem
          >
            <AnimatePresence show={true} mode="popLayout">
              <Motion
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.5,
                  ease: [0.26, 0.08, 0.25, 1]
                }}
                let:motion
              >
                <div use:motion class="{showTabSearch === 1 ? 'w-full' : 'w-[70vw]'} h-full">
                  {#if showTabSearch === 1 && $searchValue.length}
                    <Command.List>
                      {#each $commandFilterResult as item (item.id)}
                        <TabSearchItem {item} on:select={handleSelect} />
                      {/each}
                      <!-- {#if !page}
                        {#each navigate as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}

                        <!-- {#if tabs.length > 0}
                          <Command.Group heading="Active Tabs">
                            {#each tabs as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          </Command.Group>
                        {/if}

                        {#if history.length > 0}
                          <!-- <Command.Group heading="History">
                            {#each history as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          <!-- </Command.Group>
                        {/if}

                        {#if suggestions.length > 0}
                          <!-- <Command.Group heading="Suggestions">
                            {#each suggestions as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          <!-- </Command.Group>
                        {/if}

                        {#if spacesItems.length > 0}
                          <!-- <Command.Group heading="Spaces">
                            {#each spacesItems as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          <!-- </Command.Group>
                        {/if}

                        <!-- {#if resources.length > 0}
                          <Command.Group heading="Oasis">
                            {#each resources as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          </Command.Group>
                        {/if}

                        {#if commands.length > 0}
                          <!-- <Command.Group heading="Actions">
                            {#each commands as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          <!-- </Command.Group>
                        {/if}

                        {#each other as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}
                      {:else if page === 'tabs'}
                        {#each tabs as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}
                      {:else if page === 'oasis'}
                        {#each resources as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}
                      {:else if page === 'history'}
                        {#each history as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}
                      {:else if page === 'spaces'}
                        {#each spacesItems as item}
                          <TabSearchItem {item} on:select={handleSelect} />
                        {/each}
                      {/if} -->
                    </Command.List>
                  {:else if showTabSearch === 2}
                    {#if $showCreationModal}
                      <div
                        data-vaul-no-drag
                        class="create-wrapper absolute inset-0 z-50 flex items-center justify-center bg-opacity-50 bg-red-50"
                      >
                        <div
                          class="shadow-lg rounded-lg w-full h-full max-w-screen-lg max-h-screen-lg overflow-auto flex items-center justify-center"
                        >
                          <CreateNewSpace
                            on:close-modal={() => showCreationModal.set(false)}
                            on:submit={handleCreateSpace}
                          />
                        </div>
                      </div>
                    {/if}

                    {#if $selectedSpaceId !== null}
                      <OasisSpace
                        spaceId={$selectedSpaceId}
                        active
                        showBackBtn
                        hideResourcePreview
                        handleEventsOutside
                        {historyEntriesManager}
                        on:open={handleOpen}
                        on:go-back={() => selectedSpaceId.set(null)}
                        insideDrawer={true}
                      />
                    {:else}
                      <DropWrapper
                        {spaceId}
                        on:Drop={(e) => handleDrop(e.detail)}
                        on:DragEnter={(e) => handleDragEnter(e.detail)}
                        zonePrefix="drawer-"
                      >
                        <div class="w-full h-[calc(100%-216px)] will-change-transform">
                          <div class="relative will-change-transform">
                            <SpacesView
                              bind:this={createSpaceRef}
                              {spaces}
                              {resourceManager}
                              showPreview={true}
                              type="horizontal"
                              interactive={false}
                              on:space-selected={(e) => selectedSpaceId.set(e.detail.id)}
                              on:createTab={(e) => dispatch('create-tab-from-space', e.detail)}
                              on:open-creation-modal={() => showCreationModal.set(true)}
                              on:open-resource={handleOpen}
                            />
                          </div>

                          {#if $resourcesToShow.length > 0}
                            <OasisResourcesViewSearchResult
                              resources={resourcesToShow}
                              selected={$selectedItem}
                              showResourceSource={!!$searchValue}
                              isEverythingSpace={true}
                              newTabOnClick
                              on:click={handleItemClick}
                              on:open={handleOpen}
                              on:open-space-as-tab
                              on:remove={handleResourceRemove}
                              on:new-tab
                            />

                            {#if $loadingContents}
                              <div class="floating-loading">
                                <Icon name="spinner" size="20px" />
                              </div>
                            {/if}
                          {:else if $loadingContents}
                            <div class="content-wrapper">
                              <div class="content">
                                <Icon name="spinner" size="22px" />
                                <p>Loading…</p>
                              </div>
                            </div>
                          {:else}
                            <div class="content-wrapper">
                              <div class="content">
                                <Icon name="leave" size="22px" />
                                <p>Oops! It seems like this Space is feeling a bit empty.</p>
                              </div>
                            </div>
                          {/if}
                        </div>
                      </DropWrapper>
                    {/if}
                  {/if}
                </div>
              </Motion>
            </AnimatePresence>

            {#if $selectedSpaceId === null || showTabSearch === 1}
              <div
                class={showTabSearch === 2
                  ? 'w-full flex items-center justify-center bg-white z-10 p-2 border-t-[1px] border-neutral-100'
                  : 'w-full flex items-center justify-center p-2'}
              >
                <div class={'flex items-center relative'}>
                  <Command.Input
                    id="search-field"
                    {placeholder}
                    {breadcrumb}
                    loading={$isLoadingCommandItems}
                    bind:value={$searchValue}
                    class={showTabSearch === 2
                      ? 'w-[30rem] bg-neutral-100 rounded-lg p-2'
                      : 'w-[30rem] py-4 pl-2'}
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
      </Motion>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>

<style lang="scss">
  [data-vaul-drawer]::after {
    content: '';
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
  }
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

  .tabs {
    display: flex;
    gap: 1rem;
  }

  .search-input-wrapper {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 3.3rem;
    max-width: 32rem;
    view-transition-name: search-transition;
    &.active {
      height: auto;
      width: 100%;
    }
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

    /* .drawer-chat-search {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 16px;
      padding: 1rem 1rem 1rem 1rem;
      transition: all 240ms ease-out;
    } */
  }

  .search-debug {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    padding-bottom: 1.5rem;
    padding-top: 0.25rem;
    background: rgba(255, 255, 255, 0.33);

    input {
      background: none;
      padding: 0.5rem;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0.02rem;
      width: 75px;
      text-align: center;
    }
  }

  .chat-wrapper {
    position: absolute;
    top: 1rem;
    left: 50%;
    right: 50%;
    z-index: 100000;
    width: 100%;
    height: 100%;
    max-width: 50vw;
    max-height: 70vh;
    overflow-y: scroll;
    border-radius: 16px;
    transform: translateX(-50%);
    background: white;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.2),
      0px 16.479px 41.197px 0px rgba(0, 0, 0, 0.46);

    .close-button {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
      z-index: 10000;
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }

  .content-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7d7448;

    .content {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      opacity: 0.75;

      p {
        font-size: 1.2rem;
      }
    }
  }

  .settings-wrapper {
    position: relative;

    .settings-toggle {
      display: flex;
      justify-content: center;
      align-items: center;
      color: #7d7448;
      opacity: 0.7;
      &:hover {
        opacity: 1;
        background: transparent;
      }
    }
  }

  .live-mode {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    background: #ff4eed;
    border: none;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02rem;

    &:hover {
      background: #fb3ee9;
    }
  }

  .floating-loading {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    opacity: 0.75;
  }

  .create-wrapper {
    z-index: 1000000;
    background: rgba(0, 0, 0, 0.65);
  }

  .browser-background {
    margin: auto;
    margin-bottom: 4rem;
    width: 40rem;
    height: 40rem;
    object-fit: cover;
  }

  /* Hides the Drawer when dragging but not targeting it */
  :global(
      body[data-dragcula-dragging='true']:not([data-dragcula-istargeting^='drawer-oasis-space-'])
        .drawer-content
    ) {
    transform: translateY(calc(100vh - 240px)) !important;
  }

  :global([data-dialog-portal] .drawer-overlay) {
    background: rgba(0, 0, 0, 0.35);
    opacity: 1;
  }
  :global(
      body[data-dragcula-dragging='true']:not([data-dragcula-istargeting^='drawer-oasis-space-'])
        [data-dialog-portal]
        .drawer-overlay
    ) {
    opacity: 0 !important;
  }
</style>
