<script lang="ts" context="module">
  export type TabSearchEvents = {
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
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import * as Command from '../command'
  import Fuse from 'fuse.js'
  import { useLogScope } from '../../utils/log'
  import { debounce, result } from 'lodash'
  import type { Tab } from './types'
  import TabSearchItem, { type CMDMenuItem } from './TabSearchItem.svelte'
  import { parseStringIntoUrl, truncateURL } from '../../utils/url'
  import type { HistoryEntriesManager, SearchHistoryEntry } from '../../service/history'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type HistoryEntry,
    type ResourceData,
    type Space
  } from '../../types'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    useResourceManager
  } from '../../service/resources'
  import { getFileType } from '../../utils/files'
  import { useOasis } from '../../service/oasis'

  export let activeTabs: Tab[] = []
  export let historyEntriesManager: HistoryEntriesManager
  export let showTabSearch = false

  const resourceManager = useResourceManager()
  const oasis = useOasis()
  const dispatch = createEventDispatcher<TabSearchEvents>()
  const log = useLogScope('TabSearch')

  const spaces = oasis.spaces

  let searchQuery = ''
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

  $: if (searchQuery.startsWith('@tabs ')) {
    page = 'tabs'

    setTimeout(() => {
      searchQuery = ''
    }, 1)
  } else if (searchQuery.startsWith('@oasis ')) {
    page = 'oasis'

    setTimeout(() => {
      searchQuery = ''
    }, 1)
  } else if (searchQuery.startsWith('@history ')) {
    page = 'history'

    setTimeout(() => {
      searchQuery = ''
    }, 1)
  } else if (searchQuery.startsWith('@spaces ')) {
    page = 'spaces'

    setTimeout(() => {
      searchQuery = ''
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

  $: if (showTabSearch) {
    updateFilteredItems()
  }

  $: commands = filteredItems.filter((item) => item.type === 'command')
  $: tabs = filteredItems.filter((item) => item.type === 'tab')
  $: history = filteredItems.filter((item) => item.type === 'history')
  $: resources = filteredItems.filter((item) => item.type === 'resource')
  $: spacesItems = filteredItems.filter((item) => item.type === 'space')
  $: suggestions = filteredItems.filter(
    (item) => item.type === 'suggestion' || item.type === 'google-search'
  )
  $: other = filteredItems.filter(
    (item) =>
      item.type !== 'command' &&
      item.type !== 'tab' &&
      item.type !== 'suggestion' &&
      item.type !== 'google-search' &&
      item.type !== 'history' &&
      item.type !== 'resource' &&
      item.type !== 'space'
  )

  $: placeholder =
    page === 'tabs'
      ? 'Search for a tab...'
      : page === 'oasis'
        ? 'Search for a resource...'
        : page === 'history'
          ? 'Search for a page...'
          : page === 'spaces'
            ? 'Search for a space...'
            : 'Search your tabs, oasis or the web...'
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

  function handleKeyDown(e: KeyboardEvent) {
    log.debug('handleKeyDown', e.key, searchQuery)
    if (e.key === 'Backspace' && page && searchQuery === '') {
      page = null
    }
  }

  function tabToItem(tab: Tab, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    return {
      id: tab.id,
      label: tab.title,
      value: tab.type === 'page' ? tab.currentLocation ?? tab.initialLocation : '',
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
    let results = []

    if (page === 'oasis') {
      results = oasisResources.map((resource) => resourceToItem(resource, { score: 0.4 }))
    } else if (searchQuery) {
      const fuseResults = fuse.search(searchQuery)
      results = fuseResults.map((result) => ({ ...result.item, score: result.score }))

      // Add Google search option as the first item if it's not an exact match
      if (!results.some((item) => item.title === searchQuery || item.url === searchQuery)) {
        results.unshift({
          id: `google-search-${searchQuery}`,
          type: 'google-search',
          label: `Search Google for ${searchQuery}`,
          value: searchQuery,
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

      const url = parseStringIntoUrl(searchQuery)
      if (url) {
        results.push({
          id: `open-search-url`,
          type: 'command',
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

  const updateHistory = debounce(async (searchQuery: string) => {
    if (!historyCache || Date.now() - historyCache.timestamp > CACHE_EXPIRY) {
      log.debug('Fetching history entries...')
      const entries = await historyEntriesManager.searchEntries(searchQuery)
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

  const fetchOasisResults = debounce(async (query: string) => {
    try {
      loading = true
      if (query.length > 2) {
        // const data = await resourceManager.listResourcesByTags([
        const data = await resourceManager.searchResources(
          query,
          [
            ResourceManager.SearchTagDeleted(false),
            ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
            ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne')
            // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
            // ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
          ],
          { includeAnnotations: false }
        )

        log.debug('Oasis search results:', data)

        oasisResources = data.map((x) => x.resource).slice(0, 5)

        await Promise.all(
          oasisResources.map((resource) => {
            if (typeof (resource as any).getParsedData === 'function') {
              return (resource as ResourceJSON<any>).getParsedData()
            }
          })
        )
      } else {
        oasisResources = []
      }

      updateFilteredItems()
    } catch (error) {
      log.error('Error fetching Oasis search results:', error)
      oasisResources = []
    } finally {
      loading = false
    }
  }, 500)

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
    fetchGoogleSuggestions(searchQuery)
    updateHistory(searchQuery)
    fetchOasisResults(searchQuery)
  }

  function handleSelect(e: CustomEvent<CMDMenuItem>) {
    const item = e.detail
    log.debug('handleSelect', item)

    if (item.type === 'tab') {
      dispatch('activate-tab', item.id)
    } else if (item.type === 'history') {
      dispatch('open-url', item.value!)
    } else if (item.type === 'command') {
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
    searchQuery = ''
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
</script>

<Command.Dialog
  bind:open={showTabSearch}
  loop
  shouldFilter={false}
  onOpenChange={(open) => !open && resetSearch()}
  onKeydown={handleKeyDown}
>
  <Command.Input {placeholder} {breadcrumb} {loading} bind:value={searchQuery} />

  <Command.List>
    {#if !page}
      {#if tabs.length > 0}
        <Command.Group heading="Active Tabs">
          {#each tabs as item}
            <TabSearchItem {item} on:select={handleSelect} />
          {/each}
        </Command.Group>
      {/if}

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

      {#if resources.length > 0}
        <Command.Group heading="Oasis">
          {#each resources as item}
            <TabSearchItem {item} on:select={handleSelect} />
          {/each}
        </Command.Group>
      {/if}

      {#if commands.length > 0}
        <Command.Group heading="Actions">
          {#each commands as item}
            <TabSearchItem {item} on:select={handleSelect} />
          {/each}
        </Command.Group>
      {/if}

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
</Command.Dialog>
