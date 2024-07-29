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
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import * as Command from '../command'
  import Fuse from 'fuse.js'
  import { useLogScope } from '../../utils/log'
  import { debounce } from 'lodash'
  import type { Tab } from './types'
  import { Icon } from '@horizon/icons'

  export let activeTabs: Tab[] = []
  export let historyEntriesManager: any
  export let showTabSearch = false

  const dispatch = createEventDispatcher<TabSearchEvents>()
  const log = useLogScope('CMDTMenu')

  let searchQuery = ''
  let filteredItems: any[] = []
  let historyEntries: any[] = []
  let googleSuggestions: string[] = []

  const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes
  let historyCache: { data: any[]; timestamp: number } | null = null

  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'url', weight: 0.3 },
      { name: 'label', weight: 0.3 },
      { name: 'value', weight: 0.3 },
      { name: 'site', weight: 0.4 },
      { name: 'hostname', weight: 0.2 }
    ],
    threshold: 0.4,
    includeScore: true
  }

  let fuse: Fuse<any>

  $: {
    const items = [
      ...activeTabs.map((tab) => ({ ...tab, type: 'page', weight: 1.5 })),
      ...historyEntries,
      ...browserCommands
    ]
    fuse = new Fuse(items, fuseOptions)
    updateFilteredItems()
  }

  async function updateFilteredItems() {
    let results = []
    if (searchQuery) {
      const fuseResults = fuse.search(searchQuery)
      results = fuseResults.map((result) => ({ ...result.item, score: result.score }))

      // Add Google search option as the first item if it's not an exact match
      if (!results.some((item) => item.title === searchQuery || item.url === searchQuery)) {
        results.unshift({
          type: 'google-search',
          title: `Search Google for ${searchQuery}`,
          value: searchQuery,
          score: 0
        })
      }

      results.push(
        ...googleSuggestions.map((suggestion) => ({
          type: 'suggestion',
          title: suggestion,
          value: suggestion,
          score: 0.5
        }))
      )
    } else {
      results = [
        ...activeTabs.map((tab) => ({ ...tab, type: 'page', score: 0 })),
        ...historyEntries.map((entry) => ({ ...entry, score: 0.1 })),
        ...browserCommands.map((cmd) => ({ ...cmd, score: 0.2 }))
      ]
    }

    results.sort((a, b) => (a.score || 0) - (b.score || 0))

    while (results.length < 5) {
      results.push({
        type: 'placeholder',
        title: `Suggestion ${results.length + 1}`,
        score: 1
      })
    }

    filteredItems = results.slice(0, 15)
  }

  const updateSites = debounce(async () => {
    if (!historyCache || Date.now() - historyCache.timestamp > CACHE_EXPIRY) {
      const entries = await historyEntriesManager.searchEntries(searchQuery)
      const sortedEntries = entries.sort(
        (a, b) => new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime()
      )
      const uniqueSites = Object.values(
        sortedEntries.reduce((acc, entry) => {
          if (
            !acc[entry.site] ||
            new Date(entry.entry.createdAt) > new Date(acc[entry.site].entry.createdAt)
          ) {
            acc[entry.site] = { ...entry, type: 'history' }
          }
          return acc
        }, {})
      )
      historyCache = { data: uniqueSites, timestamp: Date.now() }
    }
    historyEntries = historyCache.data
    updateFilteredItems()
  }, 30)

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

  function handleSelect(item: any) {
    if (item.type === 'page') {
      dispatch('activateTab', item.id)
    } else if (item.type === 'history') {
      dispatch('open-url', item.url)
    } else if (item.type === 'command') {
      dispatch(item.id)
    } else if (item.type === 'suggestion' || item.type === 'google-search') {
      dispatch('open-url', `https://www.google.com/search?q=${encodeURIComponent(item.value)}`)
    }
    resetSearch()
  }

  function resetSearch() {
    searchQuery = ''
    filteredItems = []
    googleSuggestions = []
    showTabSearch = false
  }

  function getItemIcon(item: any) {
    if (item.type === 'page' || item.type === 'history') {
      return (
        item.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.url)}`
      )
    } else if (item.type === 'command') {
      return item.icon || 'command' // Default icon for commands
    } else if (item.type === 'google-search' || item.type === 'suggestion') {
      return 'search' // Icon for Google search and suggestions
    }
    return 'placeholder' // Default icon for other types
  }

  const browserCommands = [
    { id: 'close-active-tab', label: 'Close Tab', shortcut: '⌘W', type: 'command', icon: 'x' },
    { id: 'bookmark', label: 'Toggle Bookmark', shortcut: '⌘D', type: 'command', icon: 'bookmark' },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Tabs',
      shortcut: '⌘B',
      type: 'command',
      icon: 'sidebar'
    },
    { id: 'reload-window', label: 'Reload', shortcut: '⌘R', type: 'command', icon: 'refresh-cw' },
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
  ]
</script>

<Command.Dialog
  bind:open={showTabSearch}
  loop
  shouldFilter={false}
  onOpenChange={(open) => !open && resetSearch()}
>
  <Command.Input placeholder="Type a command or search..." bind:value={searchQuery} />
  <Command.List>
    {#each filteredItems as item}
      <Command.Item
        value={item.title || item.label || item.url || item.value}
        onSelect={() => handleSelect(item)}
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            {#if item.type === 'page' || item.type === 'history'}
              <img src={getItemIcon(item)} alt="favicon" class="w-4 h-4 mr-2" />
            {:else}
              <Icon name={getItemIcon(item)} class="w-4 h-4 mr-2" />
            {/if}
            <span class="truncate max-w-prose">
              {item.title || item.label || item.site || item.url || item.value}
            </span>
          </div>
          {#if item.shortcut}
            <Command.Shortcut>{item.shortcut}</Command.Shortcut>
          {/if}
        </div>
      </Command.Item>
    {/each}
  </Command.List>
</Command.Dialog>
