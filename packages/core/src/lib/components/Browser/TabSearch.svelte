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

  const dispatch = createEventDispatcher()
  const log = useLogScope('CMDTMenu')

  let searchQuery = ''
  let filteredItems: any[] = []
  let historyEntries: any[] = []

  const fuseOptions = {
    keys: ['title', 'url'],
    threshold: 0.4
  }

  let fuse: Fuse<any>

  $: {
    fuse = new Fuse([...activeTabs, ...historyEntries, ...browserCommands], fuseOptions)
    updateFilteredItems()
  }

  function updateFilteredItems() {
    if (searchQuery) {
      filteredItems = fuse.search(searchQuery).map((result) => result.item)
    } else {
      filteredItems = [...activeTabs, ...historyEntries, ...browserCommands]
    }
  }

  const updateSites = debounce(async () => {
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
    historyEntries = uniqueSites
    updateFilteredItems()
  }, 300)

  $: {
    updateSites()
  }

  function handleSearch(event: CustomEvent) {
    searchQuery = event.detail
    updateFilteredItems()
    dispatch('search', { query: searchQuery })
  }

  function handleSelect(item: any) {
    if (item.type === 'page') {
      dispatch('activateTab', item.id)
    } else if (item.type === 'history') {
      dispatch('openUrl', { url: item.url })
    } else if (item.type === 'command') {
      dispatch(item.id)
    }
    showTabSearch = false
  }

  const browserCommands = [
    { id: 'close-active-tab', label: 'Close Tab', shortcut: '⌘W', type: 'command' },
    { id: 'bookmark', label: 'Toggle Bookmark', shortcut: '⌘D', type: 'command' },
    { id: 'toggle-sidebar', label: 'Toggle Tabs', shortcut: '⌘B', type: 'command' },
    { id: 'reload-window', label: 'Reload', shortcut: '⌘R', type: 'command' },
    // { id: 'focusAddressBar', label: 'Focus Address Bar', shortcut: '⌘L', type: 'command' },
    { id: 'create-history-tab', label: 'Show History', shortcut: '⌘Y', type: 'command' },
    { id: 'zoom', label: 'Zoom In', shortcut: '⌘+', type: 'command' },
    { id: 'zoom-out', label: 'Zoom Out', shortcut: '⌘-', type: 'command' },
    { id: 'reset-zoom', label: 'Reset Zoom', shortcut: '⌘0', type: 'command' }
  ]
</script>

<Command.Dialog bind:open={showTabSearch} loop>
  <Command.Input placeholder="Type a command or search..." on:input={handleSearch} />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>

    <Command.Group>
      {#each activeTabs as tab}
        <Command.Item value={tab.id} onSelect={() => handleSelect(tab)}>
          <div class="flex items-center justify-between">
            <span class="truncate max-w-prose">{tab.title}</span>
          </div>
        </Command.Item>
      {/each}
    </Command.Group>

    <Command.Group>
      {#each browserCommands as item}
        <Command.Item value={item.id} onSelect={() => handleSelect(item)}>
          <div class="flex items-center justify-between">
            <span>{item.label}</span>
            <span class="text-sm text-gray-500"></span>
            <Command.Shortcut>{item.shortcut}</Command.Shortcut>
          </div>
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
</Command.Dialog>
