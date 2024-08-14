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

  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { Icon } from '@horizon/icons'
  import Chat from '../Browser/Chat.svelte'
  import SearchInput from '../Oasis/SearchInput.svelte'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import {
    Resource,
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
    extractAndCreateWebResource,
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
  import { checkIfYoutubeUrl } from '../../utils/url'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { isModKeyAndKeyPressed } from '../../utils/keyboard'
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
  export let activeTabs: Tab[] = []
  export let showTabSearch = false

  const dispatch = createEventDispatcher<OverlayEvents>()
  const config = useConfig()
  const userConfigSettings = config.settings

  let createSpaceRef: any
  let loading = false
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
    threshold: 0.4,
    includeScore: true
  }
  let fuse: Fuse<any>
  $: if ($searchValue.startsWith('@tabs ')) {
    page = 'tabs'
    setTimeout(() => {
      $searchValue = ''
    }, 1)
  } else if ($searchValue.startsWith('@oasis ')) {
    page = 'oasis'
    setTimeout(() => {
      $searchValue = ''
    }, 1)
  } else if ($searchValue.startsWith('@history ')) {
    page = 'history'
    setTimeout(() => {
      $searchValue = ''
    }, 1)
  } else if ($searchValue.startsWith('@spaces ')) {
    page = 'spaces'
    setTimeout(() => {
      $searchValue = ''
    }, 1)
  }
  $: {
    if (page === null) {
      const items: CMDMenuItem[] = [
        ...activeTabs.map((tab) => tabToItem(tab, { weight: 1.5 })),
        ...historyEntries.map((entry) => historyEntryToItem(entry, { weight: 1 })),
        ...$spaces.map((space) => spaceToItem(space, { weight: 1 })),
        // ...oasisResources.map((resource) => resourceToItem(resource, { weight: 1 })),
        ...browserCommands
      ]
      fuse = new Fuse(items, fuseOptions)
      updateFilteredItems()
    } else if (page === 'tabs') {
      const items: CMDMenuItem[] = activeTabs.map((tab) => tabToItem(tab, { weight: 1.5 }))
      fuse = new Fuse(items, fuseOptions)
      updateFilteredItems()
    } else if (page === 'history') {
      const items: CMDMenuItem[] = historyEntries.map((entry) =>
        historyEntryToItem(entry, { weight: 1 })
      )
      fuse = new Fuse(items, fuseOptions)
      updateFilteredItems()
    } else if (page === 'oasis') {
      updateFilteredItems()
    }
  }
  $: if (showTabSearch || $currentPanel === 1) {
    updateFilteredItems()
  }
  $: commands = filteredItems.filter((item) => item.type === 'command')
  $: tabs = filteredItems.filter((item) => item.type === 'tab')
  $: history = filteredItems.filter((item) => item.type === 'history').slice(0, 5)
  $: resources = filteredItems.filter((item) => item.type === 'resource')
  $: spacesItems = filteredItems.filter((item) => item.type === 'space' && item.id !== 'all')
  $: suggestions = filteredItems.filter(
    (item) => item.type === 'suggestion' || item.type === 'google-search'
  )
  $: navigate = filteredItems.filter((item) => item.type === 'navigate')
  $: other = filteredItems.filter(
    (item) =>
      item.type !== 'command' &&
      item.type !== 'tab' &&
      item.type !== 'suggestion' &&
      item.type !== 'google-search' &&
      item.type !== 'history' &&
      item.type !== 'resource' &&
      item.type !== 'space' &&
      item.type !== 'navigate'
  )
  $: placeholder =
    $currentPanel === 2
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
    const data = (resource as any).parsedData
    log.debug('data', data)
    return {
      id: resource.id,
      label: data?.title || resource.metadata?.name || `${resource.id} - ${resource.type}`,
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
  async function updateFilteredItems() {
    if ($currentPanel === 1) {
      let results = []
      if (page === 'oasis') {
        results = oasisResources.map((resource) => resourceToItem(resource, { score: 0.4 }))
      } else if ($searchValue) {
        const fuseResults = fuse.search($searchValue)
        results = fuseResults.map((result) => ({ ...result.item, score: result.score }))
        // Add Google search option as the first item if it's not an exact match
        if (!results.some((item) => item.title === $searchValue || item.url === $searchValue)) {
          results.unshift({
            id: `google-search-${$searchValue}`,
            type: 'google-search',
            label: `Search Google for ${$searchValue}`,
            value: $searchValue,
            icon: 'search',
            score: 0
          })
        }
        results.push(
          ...googleSuggestions.map((suggestion) => ({
            type: 'suggestion',
            label: suggestion,
            value: suggestion,
            icon: 'search',
            score: 0.5
          }))
        )
        const url = parseStringIntoUrl($searchValue)
        if (url) {
          results.push({
            id: `open-search-url`,
            type: 'navigate',
            label: `Navigate to ${truncateURL(url.href)}`,
            icon: 'world',
            value: url.href,
            score: 1
          })
        }
        results = [
          ...results,
          ...oasisResources.map((resource) => resourceToItem(resource, { score: 0.4 }))
        ]
      } else if (page === 'spaces') {
        results = $spaces.map((space) => spaceToItem(space, { score: 0.1 }))
      } else if (page === 'tabs') {
        results = activeTabs.map((tab) => tabToItem(tab, { score: 0 }))
      } else if (page === 'history') {
        results = historyEntries.map((entry) => historyEntryToItem(entry, { score: 0.1 }))
      } else {
        results = [
          ...activeTabs.map((tab) => tabToItem(tab, { score: 0 })),
          ...historyEntries.map((entry) => historyEntryToItem(entry, { score: 0.1 })),
          ...$spaces.map((space) => spaceToItem(space, { score: 0.1 })),
          ...oasisResources.map((resource) => resourceToItem(resource, { score: 0.1 })),
          ...browserCommands.map((cmd) => ({ ...cmd, score: 0.2 }))
        ]
      }
      results.sort((a, b) => (a.score || 0) - (b.score || 0))
      // while (results.length < 5) {
      //   results.push({
      //     type: 'placeholder',
      //     title: `Suggestion ${results.length + 1}`,
      //     score: 1
      //   })
      // }
      filteredItems = results.slice(0, 15)
    }
  }
  const updateHistory = debounce(async ($searchValue: string) => {
    if (!historyCache || Date.now() - historyCache.timestamp > CACHE_EXPIRY) {
      log.debug('Fetching history entries...')
      const entries = await historyEntriesManager.searchEntries($searchValue)
      log.debug('History entries:', entries)
      const sortedEntries = entries.sort(
        (a, b) => new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
      )
      const uniqueSites = Object.values(
        sortedEntries.reduce(
          (acc, entry) => {
            if (
              !acc[entry.site] ||
              new Date(entry.entry.createdAt) > new Date(acc[entry.site].createdAt)
            ) {
              acc[entry.site] = entry.entry
            }
            return acc
          },
          {} as Record<string, HistoryEntry>
        )
      )
      historyCache = { data: uniqueSites, timestamp: Date.now() }
    }
    historyEntries = historyCache.data
    updateFilteredItems()
  }, 30)
  // const fetchOasisResults = debounce(async (query: string) => {
  //   try {
  //     loading = true
  //     if (query.length > 2) {
  //       // const data = await resourceManager.listResourcesByTags([
  //       const data = await resourceManager.searchResources(
  //         query,
  //         [
  //           ResourceManager.SearchTagDeleted(false),
  //           ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
  //           ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne')
  //           // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
  //           // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
  //         ],
  //         { includeAnnotations: false }
  //       )
  //       log.debug('Oasis search results:', data)
  //       oasisResources = data.map((x) => x.resource).slice(0, 5)
  //       await Promise.all(
  //         oasisResources.map((resource) => {
  //           if (typeof (resource as any).getParsedData === 'function') {
  //             return (resource as ResourceJSON<any>).getParsedData()
  //           }
  //         })
  //       )
  //     } else {
  //       oasisResources = []
  //     }
  //     updateFilteredItems()
  //   } catch (error) {
  //     log.error('Error fetching Oasis search results:', error)
  //     oasisResources = []
  //   } finally {
  //     loading = false
  //   }
  // }, 500)
  const fetchGoogleSuggestions = debounce(async (query: string) => {
    try {
      if (query.length > 2) {
        // @ts-ignore
        const data = await window.api.fetchJSON(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
        )
        log.debug('Google suggestions:', data)
        googleSuggestions = data[1].slice(0, 5)
      } else {
        googleSuggestions = []
      }
      updateFilteredItems()
    } catch (error) {
      log.error('Error fetching Google suggestions:', error)
      googleSuggestions = []
    }
  }, 100)
  $: {
    fetchGoogleSuggestions($searchValue)
    updateHistory($searchValue)
    // fetchOasisResults($searchValue)
  }
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
    } else if (item.type === 'resource') {
      dispatch('open-resource', item.id!)
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
    showTabSearch = false
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
  export let active: boolean = false
  export let historyEntriesManager: HistoryEntriesManager

  $: isEverythingSpace = spaceId === 'all'

  const log = useLogScope('NEWTABOVERLAY')
  const oasis = useOasis()

  const toasts = useToasts()

  const resourceManager = oasis.resourceManager
  const spaces = oasis.spaces

  const searchValue = writable('')
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

  const currentPanel = writable(1)

  $: contents = $everythingContents

  const resourcesToShow = derived(
    [searchValue, searchResults, everythingContents, currentPanel],
    ([searchValue, searchResults, everythingContents, currentPanel]) => {
      if (searchValue && currentPanel === 2) {
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

  $: if (active) {
    loadEverything()
  }

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

      // searchValue.set('')
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

  const handleCloseChat = () => {
    showChat.set(false)
    searchValue.set('')
    chatPrompt.set('')
    resourceIds.set([])
  }

  const handleOpenNewResourceModal = () => {
    showNewResourceModal.set(true)
  }

  const handleCloseNewResourceModal = () => {
    showNewResourceModal.set(false)
  }

  const handleOpenSettingsModal = () => {
    showSettingsModal.set(true)
  }

  const handleCloseSettingsModal = () => {
    showSettingsModal.set(false)
  }

  const handleSearch = async (searchValueInput: string) => {
    let value = searchValueInput

    if (!value) {
      searchResults.set([])
      return
    }

    const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
    const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

    // if all words are hashtags, clear the search
    if (hashtags.length === value.split(' ').length) {
      value = ''
    }

    const result = await resourceManager.searchResources(
      value,
      [
        ResourceManager.SearchTagDeleted(false),
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

    log.debug('Resource removed:', resourceId)
    toasts.success('Resource deleted!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!active) {
      return
    }

    log.debug('Key down:', e.key)
    if (e.key === 'Escape') {
      if ($showResourceDetails === true) {
        closeResourceDetailsModal()
      } else {
        showTabSearch = false
      }
    } else if (
      e.key === ' ' &&
      $selectedItem &&
      !$isResourceDetailsModalOpen &&
      !$showSettingsModal
    ) {
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

  const handleDrop = async (e: CustomEvent<DragculaDragEvent>) => {
    const drag = e.detail

    if (!(drag instanceof DragculaDragEvent)) {
      log.warn('Detected non-dragcula drag event!', e)
      return
    }

    const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    e.preventDefault()

    let resourceIds: string[] = []
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

      newResources.forEach((r) => resourceIds.push(r.id))
    } else {
      log.debug('Dropped dragcula', drag.data)

      const existingResources: string[] = []

      const dragData = drag.data as { 'farc/tab': Tab; 'horizon/resource/id': string }
      if (dragData['farc/tab'] !== undefined) {
        if (dragData['horizon/resource/id'] !== undefined) {
          const resourceId = dragData['horizon/resource/id']
          resourceIds.push(resourceId)
          existingResources.push(resourceId)
        } else if (dragData['farc/tab'].type === 'page') {
          const tab = dragData['farc/tab'] as TabPage

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
            newResources.forEach((r) => resourceIds.push(r.id))
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
            }
          })
        )
      }
    }

    await loadEverything()

    toast.success(
      `Resources ${drag.isNative ? 'added' : drag.effect === 'move' ? 'moved' : 'copied'}!`
    )
  }

  const handleDragEnter = (e: CustomEvent<DragculaDragEvent>) => {
    const drag = e.detail

    const dragData = drag.data as { 'farc/tab': Tab }
    if (
      (active && e.detail.isNative) ||
      (active && dragData['farc/tab'] !== undefined && dragData['farc/tab'].type !== 'space')
    ) {
      e.preventDefault() // Allow the drag
    }
  }

  const openResourceDetailsModal = (resourceId: string) => {
    resourceDetailsModalSelected.set(resourceId)
    showResourceDetails.set(true)
  }

  const closeResourceDetailsModal = () => {
    showResourceDetails.set(false)
    resourceDetailsModalSelected.set(null)
  }

  const handleOpen = (e: CustomEvent<string>) => {
    openResourceDetailsModal(e.detail)
  }

  const handleCreateSpace = async (e: CustomEvent<{ name: string; aiEnabled: boolean }>) => {
    console.log('CREATING SPACE', e.detail.name, e.detail.aiEnabled)
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace(e, e.detail.name, e.detail.aiEnabled)

    console.log('AI Voodoo', spaceID)
    await tick()
    await createSpaceRef.createSpaceWithAI(spaceID, e.detail.name)
  }

  let containerRef: HTMLDivElement

  const focusInput = () => {
    const input = document.querySelector('input')
    if (input) {
      input.focus()
    }
  }

  onMount(() => {
    focusInput()

    return currentPanel.subscribe(() => {
      focusInput()
    })
  })

  let panelOneRef: HTMLDivElement
  let panelTwoRef: HTMLDivElement
  let masonryRef: HTMLDivElement

  let blockScroll = false

  const scrollTop = writable(0)
  const yPosition = writable('10%')

  $: {
    yPosition.set($currentPanel === 1 ? '10%' : '24px')
  }

  const debouncedSearch = useDebounce((value: string) => {
    handleSearch(value)
  }, 200)

  const deboundedEverything = useDebounce(() => {
    loadEverything()
  }, 200)

  $: if ($currentPanel === 2 && !!$searchValue) {
    log.debug('case 1')
    debouncedSearch($searchValue)
  }

  $: if ($currentPanel === 2 && !$searchValue) {
    log.debug('case 2')
    $searchResults = []
    // deboundedEverything()
  }

  $: if ($currentPanel === 1 && $searchResults.length > 0) {
    log.debug('case 3')
    deboundedEverything()
  }

  function scrollToSmoothly(elem: Element, pos: number, time: number) {
    let currentPos = elem.scrollTop
    let start: null | number = null

    if (time == null) time = 500
    ;(pos = +pos), (time = +time)
    window.requestAnimationFrame(function step(currentTime) {
      start = !start ? currentTime : start
      let progress = currentTime - start
      if (currentPos < pos) {
        const y = ((pos - currentPos) * progress) / time + currentPos
        elem.scrollTo(0, y)
      } else {
        const y = currentPos - ((currentPos - pos) * progress) / time
        elem.scrollTo(0, y)
      }
      if (progress < time) {
        window.requestAnimationFrame(step)
      } else {
        elem.scrollTo(0, pos)
      }
    })
  }

  const SCROLL_DURATION = 400
  const SCROLL_THRESHOLD = 50

  $: log.debug('blockScroll', blockScroll)

  function scrollToPanel(index: number) {
    log.debug('scrollToPanel', index)

    if (blockScroll) {
      return
    }

    blockScroll = true

    if (index === 1) {
      panelOneRef.style.removeProperty('height')

      let start: null | number = null

      window.requestAnimationFrame(function step(currentTime) {
        start = !start ? currentTime : start
        let progress = currentTime - start

        containerRef.scrollTop = 0

        if (progress < SCROLL_DURATION) {
          window.requestAnimationFrame(step)
        } else {
          containerRef.scrollTop = 0
        }
      })
      // containerRef.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      panelOneRef.style.height = '0px'

      let start: null | number = null

      // containerRef.scrollTo({ top: 0, behavior: 'smooth' })

      window.requestAnimationFrame(function step(currentTime) {
        start = !start ? currentTime : start
        let progress = currentTime - start

        containerRef.scrollTop = 0

        if (progress < SCROLL_DURATION) {
          window.requestAnimationFrame(step)
        } else {
          containerRef.scrollTop = 0
        }
      })
    }

    setTimeout(() => {
      blockScroll = false
    }, 250)

    $currentPanel = index
  }

  function handleMasonryWheel(e: CustomEvent<{ event: WheelEvent; scrollTop: number }>) {
    const { event, scrollTop } = e.detail

    log.debug('handleMasonryWheel', scrollTop, event.deltaY)

    if (scrollTop === 0 && event.deltaY < 0) {
      scrollToPanel(1)
    } else {
      masonryRef.scrollTop += event.deltaY
    }
  }

  let blockContainerScroll = false

  function handleScroll(e: Event) {
    const currentScrollTop = containerRef.scrollTop

    log.debug('handleScroll', currentScrollTop)

    scrollTop.set(currentScrollTop)

    if (currentScrollTop > SCROLL_THRESHOLD && !blockContainerScroll) {
      blockContainerScroll = true
      scrollToPanel(2)
    }
    if (currentScrollTop < SCROLL_THRESHOLD && $currentPanel !== 1) {
      scrollToPanel(1)
    }

    if (currentScrollTop < SCROLL_THRESHOLD) {
      blockContainerScroll = false
    }
  }

  const handlePaneWheel = (e: WheelEvent) => {
    log.debug('handlePaneWheel', $scrollTop, e.deltaY)
    if ($currentPanel === 2 && e.deltaY < 0) {
      scrollToPanel(1)
    }
  }

  const handleScrollButton = () => {
    if ($currentPanel === 1) {
      scrollToPanel(2)
    } else {
      scrollToPanel(1)
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if $isResourceDetailsModalOpen && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    {active}
    on:close={() => closeResourceDetailsModal()}
    on:new-tab
  />
{/if}

<div class="absolute w-full h-full z-[5001] page-background rounded-lg overflow-hidden">
  <div
    class="h-full {$currentPanel === 1 ? 'overflow-y-scroll' : 'overflow-y-hidden'}"
    bind:this={containerRef}
    on:scroll={handleScroll}
  >
    {#if $selectedSpaceId !== null}
      <OasisSpace
        spaceId={$selectedSpaceId}
        active
        showBackBtn
        {historyEntriesManager}
        on:go-back={() => selectedSpaceId.set(null)}
        on:new-tab
      />
    {:else}
      <div
        data-pane={1}
        class="h-screen w-screen transition-all duration-400 ease-in-out"
        bind:this={panelOneRef}
      >
        <div
          class="absolute left-1/2 -translate-x-1/2 z-[10001] transition-all duration-400 ease-in-out transform"
          style="top: {$yPosition}; transform: translateX(-50%);"
        >
          {#if $currentPanel === 1}
            <img class="browser-background" src={browserBackground} alt="background" />
          {/if}

          <Command.Root
            class="[&_[data-cmdk-group-heading]]:text-neutral-500 w-[672px]   [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group]:not([hidden])_~[data-cmdk-group]]:pt-0 [&_[data-cmdk-group]]:px-2 [&_[data-cmdk-input-wrapper]_svg]:h-5 [&_[data-cmdk-input-wrapper]_svg]:w-5 [&_[data-cmdk-input]]:h-12 [&_[data-cmdk-item]]:px-4 [&_[data-cmdk-item]]:py-4 [&_[data-cmdk-item]_svg]:h-5 [&_[data-cmdk-item]_svg]:w-5"
            loop
            shouldFilter={false}
            onKeydown={handleKeyDown}
          >
            <Command.Input
              id="search-field"
              {placeholder}
              {breadcrumb}
              {loading}
              bind:value={$searchValue}
            />

            {#if $currentPanel === 1 && $searchValue.length}
              <Command.List>
                {#if !page}
                  {#each navigate as item}
                    <TabSearchItem {item} on:select={handleSelect} />
                  {/each}

                  <!-- {#if tabs.length > 0}
                          <Command.Group heading="Active Tabs">
                            {#each tabs as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          </Command.Group>
                        {/if} -->

                  {#if history.length > 0}
                    <Command.Group heading="History">
                      {#each history as item}
                        <TabSearchItem {item} on:select={handleSelect} />
                      {/each}
                    </Command.Group>
                  {/if}

                  {#if spacesItems.length > 0}
                    <Command.Group heading="Spaces">
                      {#each spacesItems as item}
                        <TabSearchItem {item} on:select={handleSelect} />
                      {/each}
                    </Command.Group>
                  {/if}

                  <!-- {#if resources.length > 0}
                          <Command.Group heading="Oasis">
                            {#each resources as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          </Command.Group>
                        {/if} -->

                  <!-- {#if commands.length > 0}
                          <Command.Group heading="Actions">
                            {#each commands as item}
                              <TabSearchItem {item} on:select={handleSelect} />
                            {/each}
                          </Command.Group>
                        {/if} -->

                  {#if suggestions.length > 0}
                    <Command.Group heading="Suggestions">
                      {#each suggestions as item}
                        <TabSearchItem {item} on:select={handleSelect} />
                      {/each}
                    </Command.Group>
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
                {/if}
              </Command.List>
            {/if}
          </Command.Root>

          <div
            class="flex items-center justify-center transition-all duration-400 ease-in-out transform {$currentPanel ===
            1
              ? 'mt-9'
              : 'mt-2 opacity-50 hover:opacity-100'}"
          >
            <button
              on:click={handleScrollButton}
              tabindex="-1"
              class="text-neutral-700 flex select-none items-center gap-2 px-3 pl-4 py-2 rounded-xl transition-all ease-in-out hover:bg-[#f73b96e6] hover:text-white group"
            >
              <Icon
                name="arrow.right"
                style="transform: rotate({$currentPanel === 1 ? '90deg' : '-90deg'});"
              />
              {$currentPanel === 1 ? 'View Oasis' : 'Go Back'}
              <Icon
                name="arrow.right"
                style="transform: rotate({$currentPanel === 1 ? '90deg' : '-90deg'});"
              />
              <!-- <span class="bg-neutral-300/80 text-neutral-700 group-hover:bg-[#ffb5d9e6] py-0.5 px-1 rounded-lg">Tab</span> -->
            </button>
          </div>
        </div>

        <button
          on:click={() => resetSearch()}
          class="absolute top-3 left-3 z-[1000000] text-neutral-700 hover:text-neutral-500 px-3 py-2 rounded-xl opacity-50 hover:opacity-100 hover:bg-neutral-300/80 group"
        >
          Close <span class="bg-neutral-200 group-hover:bg-neutral-100 py-0.5 px-1 rounded-lg"
            >ESC</span
          >
        </button>
      </div>

      <div
        data-pane={2}
        class="h-full full snap-start flex items-center justify-center"
        bind:this={panelTwoRef}
      >
        {#if $showCreationModal}
          <div
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

        <DropWrapper {spaceId} on:Drop={handleDrop} on:DragEnter={handleDragEnter}>
          <div class="w-full h-full">
            <div
              class="relative transition-all duration-400 ease-in-out transform {$currentPanel === 1
                ? 'opacity-50 hover:opacity-100'
                : ''}"
              style:margin-top={$currentPanel === 1 ? '-221px' : '9rem'}
              on:wheel={handlePaneWheel}
              bind:this={masonryRef}
            >
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
                on:click={handleItemClick}
                on:open={handleOpen}
                on:open-space-as-tab
                on:remove={handleResourceRemove}
                on:new-tab
                on:wheel={handleMasonryWheel}
                bind:scrollTop={$scrollTop}
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
      </div>
    {/if}
  </div>
</div>

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
</style>
