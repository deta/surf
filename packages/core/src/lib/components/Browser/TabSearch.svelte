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
    keys: ['title', 'url', 'label'],
    threshold: 0.4,
    includeScore: true
  }

  let fuse: Fuse<any>

  $: {
    fuse = new Fuse([...activeTabs, ...historyEntries, ...browserCommands], fuseOptions)
    updateFilteredItems()
  }

  async function updateFilteredItems() {
    let results = []
    if (searchQuery) {
      const fuseResults = fuse.search(searchQuery)
      results = fuseResults.map((result) => ({ ...result.item, score: result.score }))
    } else {
      results = [...activeTabs, ...historyEntries, ...browserCommands]
    }

    // Mix results and limit to top 15
    filteredItems = results.sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 15)
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
  }, 300)

  const fetchGoogleSuggestions = debounce(async (searchGuery) => {
    if (searchQuery.length > 2) {
      try {
        const response = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(searchQuery)}`
        )
        console.error('response', response)
        const data = await response.json()
        googleSuggestions = data[1].slice(0, 5)
        updateFilteredItems()
      } catch (error) {
        console.error('Error fetching Google suggestions:', error)
      }
    } else {
      googleSuggestions = []
    }
  }, 300)

  $: {
    updateSites()
  }

  $: {
    fetchGoogleSuggestions(searchQuery)
  }

  function handleSelect(item: any) {
    if (item.type === 'page') {
      dispatch('activateTab', item.id)
    } else if (item.type === 'history') {
      dispatch('openUrl', { url: item.url })
    } else if (item.type === 'command') {
      dispatch(item.id)
    } else if (item.type === 'suggestion') {
      dispatch('open-url', {
        url: `https://www.google.com/search?q=${encodeURIComponent(item.value)}`
      })
    }
    showTabSearch = false
  }

  const browserCommands = [
    { id: 'close-active-tab', label: 'Close Tab', shortcut: '⌘W', type: 'command' },
    { id: 'bookmark', label: 'Toggle Bookmark', shortcut: '⌘D', type: 'command' },
    { id: 'toggle-sidebar', label: 'Toggle Tabs', shortcut: '⌘B', type: 'command' },
    { id: 'reload-window', label: 'Reload', shortcut: '⌘R', type: 'command' },
    { id: 'create-history-tab', label: 'Show History', shortcut: '⌘Y', type: 'command' },
    { id: 'zoom', label: 'Zoom In', shortcut: '⌘+', type: 'command' },
    { id: 'zoom-out', label: 'Zoom Out', shortcut: '⌘-', type: 'command' },
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: '⌘0', type: 'command' }
  ]
</script>

<Command.Dialog bind:open={showTabSearch} loop>
  <Command.Input placeholder="Type a command or search..." bind:value={searchQuery} />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>

    {#each filteredItems as item}
      <Command.Item
        value={item.title || item.label || item.url}
        onSelect={() => handleSelect(item)}
      >
        <div class="flex items-center justify-between">
          <span class="truncate max-w-prose"
            >{item.title || item.label || item.site || item.url}</span
          >
          {#if item.shortcut}
            <Command.Shortcut>{item.shortcut}</Command.Shortcut>
          {/if}
        </div>
      </Command.Item>
    {/each}

    {#if googleSuggestions.length > 0}
      <Command.Group heading="Search Suggestions">
        {#each googleSuggestions as suggestion}
          <Command.Item
            value={suggestion}
            onSelect={() => handleSelect({ type: 'suggestion', value: suggestion })}
          >
            <div class="flex items-center">
              <span>{suggestion}</span>
            </div>
          </Command.Item>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>
</Command.Dialog>
