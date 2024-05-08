<script lang="ts" context="module">
  export type ActionEvent = { type: 'navigation' | 'chat'; value: string }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import {
    optimisticCheckIfUrl,
    parseStringIntoBrowserLocation,
    parseStringIntoUrl
  } from '@horizon/core/src/lib/utils/url'
  import { createEventDispatcher } from 'svelte'

  import type { HistoryEntry, Optional } from '@horizon/core/src/lib/types'

  import ToolbarItem from './ToolbarItem.svelte'
  import ToolbarGroupHeader from './ToolbarGroupHeader.svelte'
  import Horizon from '../../../../Horizon/Horizon.svelte'
  import type { HistoryEntriesManager } from '../../../../../service/horizon'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../searchEngines'
  import { isModKeyPressed } from '../../../../../utils/keyboard'

  export let inputValue: string
  export let historyEntriesManager: HistoryEntriesManager
  export let cardHistory: any

  let toolbar: HTMLElement

  let initialValue: string = ''

  const dispatch = createEventDispatcher<{ action: ActionEvent }>()

  let cardHistoryItems: any[] = cardHistory
    .map((item: any) => ({
      type: item.type,
      name: item.title,
      group: 'History',
      url: item.url
    }))
    .splice(1, 5)

  let origin = cardHistory[0]

  let originalItems = [
    { type: 'group', name: 'History', group: 'History' },
    ...cardHistoryItems,

    { type: 'group', name: 'Search', group: 'Search' },
    { type: 'search', name: 'Use Perplexity', group: 'Search', searchEngine: 'perplexity' },
    { type: 'search', name: 'Search with Google', group: 'Search', searchEngine: 'google' }
  ]

  let filteredItems: any[] = []
  let selectedIndex = 0

  let itemElements: HTMLElement[] = []

  // Add additional search results for sites that have no root results
  const addAddtionalSearchResults = (
    searchResults: ReturnType<typeof historyEntriesManager.searchEntries>,
    query: string
  ) => {
    const sites = Array.from(
      new Set(searchResults.map((item) => historyEntriesManager.extractSite(item.entry.url ?? '')))
    ).filter((site) => site !== '')
    const rootResults = searchResults.filter(
      (item) => historyEntriesManager.extractPathname(item.entry.url ?? '') === '/'
    )

    const scoreHostname = (hostname: string, query: string) => {
      if (hostname === query) {
        return 2
      } else if (hostname.startsWith(query)) {
        return 1.5
      } else if (hostname.includes(query)) {
        return 1
      } else {
        return 0
      }
    }

    const missingRootResultsForSites = sites
      .filter(
        (site) =>
          !rootResults.some(
            (item) => historyEntriesManager.extractSite(item.entry.url ?? '') === site
          )
      )
      .map((site) => {
        const entry = searchResults.find(
          (item) => historyEntriesManager.extractSite(item.entry.url ?? '') === site
        )
        const hostname = historyEntriesManager.extractHostname(entry?.entry.url ?? '')
        const url = `https://${hostname ?? ''}`

        return {
          entry: {
            id: `root:${url}`,
            updatedAt: new Date().toISOString(),
            type: 'navigation',
            title: historyEntriesManager.extractTitle(url),
            url: url,
            searchQuery: ''
          } as HistoryEntry,
          score: query.split(' ').reduce((acc, word) => acc + scoreHostname(hostname, word), 0)
        }
      })

    console.log('missingRootResultsForSites', missingRootResultsForSites)

    return missingRootResultsForSites
  }

  // Reactive statement to selectively filter items and control visibility of the Search group
  $: {
    if (inputValue) {
      let isInitial = inputValue === initialValue
      const lowerInputValue = inputValue.toLowerCase().trim()

      const searchResults = historyEntriesManager.searchEntries(lowerInputValue)
      const additionalSearchResults = addAddtionalSearchResults(searchResults, lowerInputValue)

      let defaultSearchEngine = SEARCH_ENGINES.find(
        (engine) => engine.key === DEFAULT_SEARCH_ENGINE
      )
      if (!defaultSearchEngine) {
        defaultSearchEngine = SEARCH_ENGINES[0]
      }

      const defaultSearchEngineItem = {
        entry: {
          id: `search:${defaultSearchEngine.key}`,
          updatedAt: new Date().toISOString(),
          type: 'search',
          title: defaultSearchEngine.title,
          searchQuery: inputValue
        } as HistoryEntry,
        searchEngine: defaultSearchEngine.key,
        group: 'Search',
        score: 0.77
      }

      const oasisAISearch = {
        entry: {
          id: `ask:oasis`,
          updatedAt: new Date().toISOString(),
          type: 'chat',
          title: 'Ask Oasis AI',
          searchQuery: inputValue
        } as HistoryEntry,
        searchEngine: 'oasis',
        group: 'Search',
        score: Infinity
      }

      const combined = [
        ...searchResults,
        ...additionalSearchResults,
        defaultSearchEngineItem,
        oasisAISearch
      ] as Optional<typeof defaultSearchEngineItem, 'searchEngine'>[]

      const highestScore = combined.reduce((acc, item) => (item.score > acc ? item.score : acc), 0)

      const queryParts = lowerInputValue.split(' ')

      let matchedPart = null
      const matchingSearchEngine = SEARCH_ENGINES.find((engine) =>
        queryParts.some((part) =>
          engine.shortcuts.some((s) => {
            if (part.length > 2) {
              const match = s.includes(part)
              if (match) {
                matchedPart = part
              }
              return match
            } else {
              const match = s === part
              if (match) {
                matchedPart = part
              }
            }
          })
        )
      )

      if (matchingSearchEngine && matchingSearchEngine.key !== 'google') {
        let searchQuery = lowerInputValue

        if (matchedPart) {
          searchQuery = searchQuery.replace(matchedPart, '').trim()
        }

        const exactPartMatch = queryParts.some((part) =>
          matchingSearchEngine.shortcuts.includes(part)
        )

        combined.push({
          entry: {
            id: `search:${matchingSearchEngine.key}`,
            updatedAt: new Date().toISOString(),
            type: 'search',
            title: matchingSearchEngine.title,
            searchQuery: searchQuery
          } as HistoryEntry,
          searchEngine: matchingSearchEngine.key,
          group: 'Search',
          score: exactPartMatch ? highestScore + 1 : 1
        })
      }

      const browserLocation = parseStringIntoBrowserLocation(inputValue)
      if (browserLocation !== null) {
        combined.push({
          entry: {
            id: 'search:direct',
            updatedAt: new Date().toISOString(),
            type: 'navigation',
            title: inputValue,
            url: browserLocation,
            searchQuery: inputValue
          } as HistoryEntry,
          group: 'Direct',
          score: highestScore + 2
        })
      }

      const results = combined
        .sort((a, b) => b.score - a.score)
        .map((item) => ({
          type: item.entry.type,
          name: item.entry.title,
          group: item.group ?? 'History',
          searchQuery: item.entry.searchQuery,
          ...(item.searchEngine ? { searchEngine: item.searchEngine } : {}),
          url: item.entry.url
        }))
        .splice(0, 6)

      const resultHasDefaultSearchEngine = results.find(
        (item) => item.searchEngine === DEFAULT_SEARCH_ENGINE
      )
      if (!resultHasDefaultSearchEngine) {
        results.push({
          type: defaultSearchEngineItem.entry.type,
          name: defaultSearchEngineItem.entry.title,
          group: defaultSearchEngineItem.group,
          searchQuery: defaultSearchEngineItem.entry.searchQuery,
          searchEngine: defaultSearchEngineItem.searchEngine,
          url: defaultSearchEngineItem.entry.url
        })
      }

      results.reverse()

      let historyItemsFiltered = isInitial ? cardHistoryItems : results

      // let historyGroupHeader =
      //   historyItemsFiltered.length > 0
      //     ? [originalItems.find((item) => item.group === 'History' && item.type === 'group')]
      //     : []

      // let searchItemsVisibility = optimisticCheckIfUrl(inputValue)
      //   ? []
      //   : originalItems.filter((item) => item.group === 'Search')

      if (isInitial) {
        filteredItems = [
          // ...historyGroupHeader,
          ...historyItemsFiltered
          // ...searchItemsVisibility
        ]
      } else {
        filteredItems = [
          // ...searchItemsVisibility,
          // ...historyGroupHeader,
          ...historyItemsFiltered
        ]
      }
    }

    // Update selectedIndex to point to the last item by default when filteredItems changes
    selectedIndex = filteredItems.length - 1
  }

  function handleKeydown(event: KeyboardEvent) {
    // Handle selection of items in the list, including looping
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      let nextIndex = selectedIndex
      do {
        nextIndex = (nextIndex + 1) % filteredItems.length
      } while (filteredItems[nextIndex].type === 'group')
      selectedIndex = nextIndex
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      let prevIndex = selectedIndex
      do {
        prevIndex = (prevIndex - 1 + filteredItems.length) % filteredItems.length
      } while (filteredItems[prevIndex].type === 'group')
      selectedIndex = prevIndex
    }

    if (event.key === 'Enter') {
      // Used to start a new AI chat from the new tab page
      if (isModKeyPressed(event)) {
        dispatch('action', { type: 'chat', value: inputValue })
        return
      }

      let currentElement = filteredItems[selectedIndex]
      performAction(currentElement)
    }

    setTimeout(() => {
      scrollItemIntoView(selectedIndex)
    }, 20)
  }

  function scrollItemIntoView(index: number) {
    const targetElement = itemElements[index]
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
    }
  }

  const performAction = (currentElement: any) => {
    // Send the user to the URL from the History
    if (currentElement.type == 'navigation') {
      inputValue = currentElement.url

      // Perform actions for search engines
    } else if (currentElement.type == 'search') {
      const matchingSearchEngine = SEARCH_ENGINES.find(
        (engine) => engine.key === currentElement.searchEngine
      )
      if (matchingSearchEngine) {
        let searchQuery = currentElement.searchQuery

        // remove shortcuts from input value
        if (matchingSearchEngine.key !== 'google') {
          matchingSearchEngine.shortcuts.forEach((shortcut) => {
            searchQuery = searchQuery.replace(shortcut, '').trim()
          })
        }

        const historyEntry = {
          type: 'search',
          searchQuery: searchQuery
        } as HistoryEntry
        historyEntriesManager.addEntry(historyEntry)

        inputValue = new URL(matchingSearchEngine.getUrl(searchQuery)).href
      }
    } else if (currentElement.type == 'chat') {
      dispatch('action', { type: 'chat', value: currentElement.searchQuery })
      return
    }

    dispatch('action', { type: 'navigation', value: inputValue })
  }

  function handleClick(event: MouseEvent): void {
    console.log('click')
    const target = event.target as HTMLElement
    // Find the closest .toolbar-item ancestor, in case the click was on a child element
    const toolbarItem = target.closest('.toolbar-item')
    if (toolbarItem) {
      event.preventDefault()
      const dataIndex = toolbarItem.getAttribute('data-index')

      let currentElement = filteredItems[dataIndex]
      performAction(currentElement)
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
    if (toolbar) {
      toolbar.addEventListener('click', handleClick)
    }

    setTimeout(() => {
      scrollItemIntoView(selectedIndex)
    }, 20)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
    if (toolbar) {
      toolbar.removeEventListener('click', handleClick)
    }
  })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div class="toolbar" bind:this={toolbar} on:click|preventDefault={handleClick}>
  <ul class="toolbar-list" style="list-style: none;">
    {#each filteredItems as item, index}
      <li bind:this={itemElements[index]} class={item.type}>
        {#if item.type === 'group'}
          <ToolbarGroupHeader title={item.name} />
        {:else}
          <ToolbarItem
            active={index === selectedIndex}
            name={item.name}
            type={item.type}
            url={item.url}
            group={item.group}
            searchQuery={item.searchQuery}
            {inputValue}
            {index}
          />
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style lang="scss">
  .toolbar {
    padding: 0.25rem;
    position: relative;
    bottom: 0;
    overflow-y: scroll;
    max-height: 100%;
    .toolbar-list {
      position: relative;
      bottom: 0;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      gap: 2px;
    }

    .return,
    .adblock {
      width: auto;
    }

    .history,
    .group,
    .search,
    .action,
    .navigation {
      grid-column: 1 / span 2 !important;
    }
  }

  @container (max-height: 660px) {
    .toolbar {
      max-height: 30rem;
    }
  }

  @container (max-height: 600px) {
    .toolbar {
      max-height: 25rem;
    }
  }

  @container (max-height: 500px) {
    .toolbar {
      max-height: 20rem;
    }
  }

  @container (max-height: 400px) {
    .toolbar {
      max-height: 15rem;
    }
  }

  @container (max-height: 300px) {
    .toolbar {
      max-height: 10rem;
    }
  }
</style>
