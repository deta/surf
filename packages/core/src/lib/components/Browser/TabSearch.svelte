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
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import * as Command from '../command'
  import Fuse from 'fuse.js'
  import { useLogScope } from '../../utils/log'
  import { debounce } from 'lodash'
  import type { Tab } from './types'
  import TabSearchItem, { type CMDMenuItem } from './TabSearchItem.svelte'
  import { parseStringIntoUrl, truncateURL } from '../../utils/url'

  export let activeTabs: Tab[] = []
  export let historyEntriesManager: any
  export let showTabSearch = false

  const dispatch = createEventDispatcher<TabSearchEvents>()
  const log = useLogScope('CMDTMenu')

  let searchQuery = ''
  let filteredItems: CMDMenuItem[] = []
  let historyEntries: any[] = []
  let googleSuggestions: string[] = []

  const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes
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

  $: {
    const items: CMDMenuItem[] = [
      ...activeTabs.map((tab) => tabToItem(tab, { weight: 1.5 })),
      // ...historyEntries,
      ...browserCommands
    ]
    fuse = new Fuse(items, fuseOptions)
    updateFilteredItems()
  }

  $: if (showTabSearch) {
    updateFilteredItems()
  }

  $: commands = filteredItems.filter((item) => item.type === 'command')
  $: tabs = filteredItems.filter((item) => item.type === 'tab')
  $: suggestions = filteredItems.filter(
    (item) => item.type === 'suggestion' || item.type === 'google-search'
  )
  $: other = filteredItems.filter(
    (item) =>
      item.type !== 'command' &&
      item.type !== 'tab' &&
      item.type !== 'suggestion' &&
      item.type !== 'google-search'
  )

  function tabToItem(tab: Tab, params: Partial<CMDMenuItem> = {}): CMDMenuItem {
    return {
      id: tab.id,
      label: tab.title,
      value: tab.type === 'page' ? tab.currentLocation ?? tab.initialLocation : '',
      icon: tab.icon,
      type: 'tab',
      ...params
    } as CMDMenuItem
  }

  async function updateFilteredItems() {
    let results = []
    if (searchQuery) {
      const fuseResults = fuse.search(searchQuery)
      results = fuseResults.map((result) => ({ ...result.item, score: result.score }))

      // Add Google search option as the first item if it's not an exact match
      if (!results.some((item) => item.title === searchQuery || item.url === searchQuery)) {
        results.unshift({
          id: `google-search-${searchQuery}`,
          type: 'google-search',
          label: `Search Google for ${searchQuery}`,
          value: searchQuery,
          score: 0
        })
      }

      results.push(
        ...googleSuggestions.map((suggestion) => ({
          type: 'suggestion',
          label: suggestion,
          value: suggestion,
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
    } else {
      results = [
        ...activeTabs.map((tab) => tabToItem(tab, { score: 0 })),
        // ...historyEntries.map((entry) => ({ ...entry, score: 0.1 })),
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

  // const updateSites = debounce(async () => {
  //   if (!historyCache || Date.now() - historyCache.timestamp > CACHE_EXPIRY) {
  //     const entries = await historyEntriesManager.searchEntries(searchQuery)
  //     const sortedEntries = entries.sort(
  //       (a, b) => new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
  //     )
  //     const uniqueSites = Object.values(
  //       sortedEntries.reduce((acc, entry) => {
  //         if (
  //           !acc[entry.site] ||
  //           new Date(entry.entry.createdAt) > new Date(acc[entry.site].entry.createdAt)
  //         ) {
  //           acc[entry.site] = { ...entry, type: 'history' }
  //         }
  //         return acc
  //       }, {})
  //     )
  //     historyCache = { data: uniqueSites, timestamp: Date.now() }
  //   }
  //   historyEntries = historyCache.data
  //   updateFilteredItems()
  // }, 30)

  const fetchGoogleSuggestions = debounce(async (query: string) => {
    if (query.length > 2) {
      try {
        const response = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        googleSuggestions = data[1].slice(0, 5)
        updateFilteredItems()
      } catch (error) {
        console.error('Error fetching Google suggestions:', error)
        googleSuggestions = []
      }
    } else {
      googleSuggestions = []
    }
    updateFilteredItems()
  }, 100)

  $: {
    fetchGoogleSuggestions(searchQuery)
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
>
  <Command.Input placeholder="Search for a tab or the web..." bind:value={searchQuery} />
  <Command.List>
    {#if tabs.length > 0}
      <Command.Group heading="Active Tabs">
        {#each tabs as item}
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
  </Command.List>
</Command.Dialog>
