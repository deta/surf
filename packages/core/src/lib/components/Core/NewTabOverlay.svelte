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
    useLocalStorageStore
  } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher, tick } from 'svelte'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type HistoryEntry,
    type Space
  } from '../../types'
  import DropWrapper from '../Oasis/DropWrapper.svelte'

  import {
    MEDIA_TYPES,
    createResourcesFromMediaItems,
    processDrop
  } from '../../service/mediaImporter'

  import { useToasts } from '../../service/toast'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'
  import { DragculaDragEvent } from '@horizon/dragcula'
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
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  import { useTabsManager } from '../../service/tabs'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../constants/searchEngines'
  import { CONTEXT_MENU_OPEN } from './ContextMenu.svelte'

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

  let selectFirstCommandItem: () => void
  let hasLoadedEverything = false
  const searchValue = writable('')
  const oasisSearchResults = writable<Resource[]>([])
  const searchEngineSuggestionResults = writable<string[]>([])
  const historyEntriesResults = writable<HistoryEntry[]>([])
  const filteredCommandItems = writable<CMDMenuItem[]>([])
  const isFetchingOasisSearchResults = writable(false)
  const isFetchingSearchEngineSuggestionResults = writable(false)
  const isFetchingHistoryEntriesResults = writable(false)
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
      isFilteringCommandItems
    ],
    ([
      isFetchingOasisSearchResults,
      isFetchingSearchEngineSuggestionResults,
      isFetchingHistoryEntriesResults,
      isFilteringCommandItems
    ]) => {
      return (
        isFetchingOasisSearchResults ||
        isFetchingSearchEngineSuggestionResults ||
        isFetchingHistoryEntriesResults ||
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

      if (!$isFetchingOasisSearchResults) {
        fetchOasisResults(searchValue)
      }

      if (!$isFetchingOasisSearchResults) {
        fetchSearchEngineSuggestions(searchValue)
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
    [
      searchValue,
      commandFilter,
      filteredCommandItems,
      oasisSearchResults,
      searchEngineSuggestionResults
    ],
    ([
      searchValue,
      commandFilter,
      filteredCommandItems,
      oasisSearchResults,
      searchEngineSuggestionResults
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
        ...filteredCommandItems,
        // ...historyEntriesResults.map((entry) => historyEntryToItem(entry, { score: 0.1 })),
        ...searchEngineSuggestionResults.map((suggestion) =>
          searchEngineSuggestionToItem(suggestion)
        )
        // NOTE: Disabled until it works better with the new stuff seach work
        //...oasisSearchResults.map((resource) => resourceToItem(resource, { score: 0.4 }))
      ]

      if (!items.some((item) => item.label === searchValue || item.value === searchValue)) {
        items.unshift({
          id: `general-search-${searchValue}`,
          type: 'general-search',
          label: `${searchValue}`,
          value: searchValue,
          icon: 'search',
          score: 1
        } as CMDMenuItem)
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
          $searchEngineSuggestionResults = suggestions[1] // TODO: -> Make this generalized for other engines
            .slice(0, 4)
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
    } else if (item.type === 'history') {
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
  const spaces = derived(oasis.spaces, ($spaces) => $spaces)
  const selectedItem = writable<string | null>(null)
  const showSettingsModal = writable(false)
  const loadingContents = writable(false)
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)
  const showCreationModal = writable(false)
  const selectedSpaceId = writable<string | null>(null)
  const searchResults = writable<ResourceSearchResultItem[]>([])
  const everythingContents = writable<ResourceSearchResultItem[]>([])

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

  const loadEverything = async () => {
    try {
      if ($loadingContents) {
        log.debug('Already loading everything')
        return
      }

      // resets the selected space
      oasis.resetSelectedSpace()

      loadingContents.set(true)

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

    await handleSearch($searchValue)

    await telemetry.trackDeleteResource(resource.type, !isEverythingSpace)

    log.debug('Resource removed:', resourceId)
    toasts.success('Resource deleted!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
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
    if (drag.isNative) {
      drag.continue()
      return
    }
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

  const handleOpen = async (e: CustomEvent<string>) => {
    openResourceDetailsModal(e.detail)
    // openResourceAsTab(e.detail)
  }

  const handleCreateEmptySpace = async () => {
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace({
      detail: {
        name: 'New Space',
        aiEnabled: false,
        colors: ['#000000', '#ffffff'],
        userPrompt: ''
      }
    })

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
    await oasisSpace.handleDeleteSpace(new CustomEvent('delete', { detail: false }))
  }

  const handleSpaceDeleted = async (e: CustomEvent) => {
    selectedSpaceId.set('all')
  }

  let isSearching = false
  let searchTimeout: NodeJS.Timeout | null = null

  const debouncedSearch = useDebounce((value: string) => {
    if (showTabSearch !== 2) return

    if (value.length === 0) {
      searchResults.set([])
      hasSearched = false
      if (!hasLoadedEverything) {
        hasLoadedEverything = true
        loadEverything()
      }
    } else if (value.length > 3) {
      handleSearch(value).then(() => {
        isSearching = false
      })
    } else {
      $searchResults = []
    }

    hasLoadedEverything = value.length === 0
  }, 300)

  const debouncedTrackOpenOasis = useDebounce(() => {
    telemetry.trackOpenOasis()
  }, 500)

  let previousSearchValue = ''

  $: if (showTabSearch === 2) {
    debouncedTrackOpenOasis()
    loadEverything()

    if ($searchValue !== previousSearchValue) {
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
  }

  $: if (showTabSearch !== 2) {
    closeResourceDetailsModal()
  }

  const handleOasisFilterChange = (e: CustomEvent<string>) => {
    log.debug('Filter change:', e.detail)
    debouncedSearch($searchValue)
  }
</script>

<svelte:window
  on:DragStart={(drag) => {
    showTabSearch = 2
  }}
  on:DragEnd={(drag) => {
    showTabSearch = 0
  }}
/>

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
        {:else if $searchValue.length < 20}
          <button
            class="absolute right-4 transform {showTabSearch === 2 && $selectedSpaceId !== null
              ? 'bottom-3'
              : 'bottom-3'} z-10 flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-pink-300/50 p-2 rounded-lg duration-200 focus-visible:shadow-focus-ring-button active:scale-95"
            on:click={() => {
              showTabSearch = showTabSearch === 1 ? 2 : 1
            }}
            aria-label="Switch tabs"
          >
            <span
              >{showTabSearch === 1
                ? $searchValue.length > 0
                  ? 'Search My Stuff'
                  : 'Open My Stuff'
                : 'Search the Web'}</span
            >
            <Command.Shortcut class="flex-shrink-0 bg-neutral-100 rounded-lg p-1">
              {#if showTabSearch === 1}
                {#if navigator.platform.startsWith('Mac')}
                  ⌘O
                {:else}
                  Ctrl+O
                {/if}
              {:else if navigator.platform.startsWith('Mac')}
                ⌘T
              {:else}
                Ctrl+T
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
            class={showTabSearch === 1
              ? `w-[514px] overflow-y-scroll !no-scrollbar ${$searchValue.length > 0 ? 'h-[314px]' : 'h-[58px]'}`
              : 'w-[90vw] h-[calc(100vh-120px)]'}
          >
            {#if showTabSearch === 1 && $searchValue.length}
              <Command.List class="m-2 no-scrollbar">
                {#each $commandFilterResult as item (item.id)}
                  <CommandMenuItem {item} on:select={handleSelect} />
                {/each}
              </Command.List>
            {:else if showTabSearch === 2}
              <div class="flex h-full">
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
                      on:open-resource={handleOpen}
                      on:delete-space={handleDeleteSpace}
                      on:Drop
                    />
                  {/key}
                </div>
                <div class="stuff-wrap h-full w-full">
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
                        on:go-back={() => selectedSpaceId.set(null)}
                        on:deleted={handleSpaceDeleted}
                        insideDrawer={true}
                        bind:this={oasisSpace}
                        {searchValue}
                      />
                    {/key}
                  {:else}
                    <DropWrapper
                      acceptDrop={true}
                      {spaceId}
                      on:Drop={(e) => handleDrop(e.detail)}
                      on:DragEnter={(e) => handleDragEnter(e.detail)}
                      zonePrefix="drawerrr-"
                    >
                      <div class="w-full h-full">
                        {#if $resourcesToShow.length > 0}
                          {#key $selectedSpaceId}
                            <OasisResourcesViewSearchResult
                              resources={resourcesToShow}
                              selected={$selectedItem}
                              showResourceSource={!!$searchValue}
                              isEverythingSpace={true}
                              newTabOnClick
                              isInSpace={false}
                              scrollTop={0}
                              on:click={handleItemClick}
                              on:open={handleOpen}
                              on:open-space-as-tab
                              on:remove={handleResourceRemove}
                              on:new-tab
                              {searchValue}
                            />
                          {/key}

                          {#if $loadingContents}
                            <div class="floating-loading">
                              <Icon name="spinner" size="20px" />
                            </div>
                          {/if}
                        {:else if isSearching && $searchValue.length > 3}
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
                              {#if $searchValue.length <= 3}
                                <p class="text-lg font-medium text-gray-700">
                                  Please type at least 3 characters to search.
                                </p>
                              {:else}
                                <p class="text-lg font-medium text-gray-700">
                                  No stuff found for "{$searchValue}". Try a different search term.
                                </p>
                              {/if}
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
                ? 'w-[calc(100%-18rem)] absolute bottom-0 right-0 flex items-center justify-center bg-white z-10 p-2 border-t-[1px] border-neutral-100'
                : 'w-full absolute bottom-0 flex items-center justify-center p-2  border-t-[1px] border-neutral-100 bg-white'}
            >
              <div class={'flex items-center relative'}>
                <Command.Input
                  id="search-field"
                  {placeholder}
                  {breadcrumb}
                  loading={$isLoadingCommandItems}
                  bind:value={$searchValue}
                  class={showTabSearch === 2
                    ? 'w-[32rem] bg-neutral-100 rounded-lg p-2'
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
