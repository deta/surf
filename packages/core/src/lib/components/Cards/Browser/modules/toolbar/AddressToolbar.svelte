<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  import { optimisticCheckIfUrl } from '@horizon/core/src/lib/utils/url'
  import { createEventDispatcher } from 'svelte'

  import type { HistoryEntry } from '@horizon/core/src/lib/types'

  import ToolbarItem from './ToolbarItem.svelte'
  import ToolbarGroupHeader from './ToolbarGroupHeader.svelte'
  import Horizon from '../../../../Horizon/Horizon.svelte'
  import type { HistoryEntriesManager } from '../../../../../service/horizon'

  export let inputValue: string
  export let adblockerState: boolean
  export let horizon: Horizon
  export let cardHistory: any

  let toolbar: HTMLElement

  let initialValue: string
  const historyEntriesManager = horizon.historyEntriesManager

  const dispatch = createEventDispatcher()

  let cardHistoryItems: any[] = cardHistory
    .map((item: any) => ({
      type: item.type,
      name: item.title,
      group: 'History',
      url: item.url
    }))
    .splice(1, 5)

  let origin = cardHistoryItems[0]

  let cardActions = [
    {
      type: 'return',
      name: 'Return to origin',
      group: 'History',
      url: origin?.url
    },
    {
      type: 'adblock',
      name: adblockerState ? 'Disable Adblock' : 'Enable Adblock',
      group: 'Actions'
    }
  ]

  let originalItems = [
    ...cardActions,

    { type: 'group', name: 'History', group: 'History' },
    ...cardHistoryItems,

    { type: 'group', name: 'Search', group: 'Search' },
    { type: 'search', name: 'Use Perplexity', group: 'Search', searchEngine: 'perplexity' },
    { type: 'search', name: 'Search with Google', group: 'Search', searchEngine: 'google' }
  ]

  let filteredItems: any[] = []
  let selectedIndex = 0

  let itemElements: HTMLElement[] = []

  // Reactive statement to selectively filter items and control visibility of the Search group
  $: {
    if (inputValue) {
      let isInitial = inputValue === initialValue
      const lowerInputValue = inputValue.toLowerCase()

      let searchResults = horizon?.historyEntriesManager.searchEntries(lowerInputValue)

      searchResults = searchResults
        .filter((item: any) => item.type !== 'search') // we need to filter out the search entries bc. we also need to store the search engine
        .map((item: any) => ({
          type: item.type,
          name: item.title,
          group: 'History',
          url: item.url
        }))
        .splice(0, 6)
        .reverse()

      let historyItemsFiltered = isInitial ? cardHistoryItems : searchResults

      let historyGroupHeader =
        historyItemsFiltered.length > 0
          ? [originalItems.find((item) => item.group === 'History' && item.type === 'group')]
          : []

      let searchItemsVisibility = optimisticCheckIfUrl(inputValue)
        ? []
        : originalItems.filter((item) => item.group === 'Search')

      let urlAction: any[] = []
      let isURL = optimisticCheckIfUrl(inputValue)
      if (isURL) {
        if (isInitial) {
          urlAction = [
            { type: 'group', name: 'Actions', group: 'Actions' },
            { type: 'action', name: 'Refresh', group: 'Action' }
          ]
        } else {
          urlAction = [
            { type: 'group', name: 'Actions', group: 'Actions' },
            { type: 'action', name: 'Go to URL', group: 'Action' }
          ]
        }
      }

      if (isInitial) {
        filteredItems = [
          ...cardActions,
          ...historyGroupHeader,
          ...historyItemsFiltered,
          ...searchItemsVisibility,
          ...urlAction
        ]
      } else {
        filteredItems = [
          ...cardActions,
          ...searchItemsVisibility,
          ...historyGroupHeader,
          ...historyItemsFiltered,
          ...urlAction
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
    if (currentElement.group == 'History') {
      inputValue = currentElement.url
    }

    // Perform actions for search engines
    if (currentElement.group == 'Search') {
      if (currentElement.searchEngine == 'perplexity') {
        const historyEntry = {
          type: 'search',
          searchQuery: inputValue
        } as HistoryEntry
        historyEntriesManager.addEntry(historyEntry)

        const replacedSpaces = inputValue.replace(/ /g, '+')
        inputValue = `https://www.perplexity.ai/?q=${replacedSpaces}`
      }

      if (currentElement.searchEngine == 'google') {
        const historyEntry = {
          type: 'search',
          searchQuery: inputValue
        } as HistoryEntry
        historyEntriesManager.addEntry(historyEntry)

        if (optimisticCheckIfUrl(inputValue)) {
          return
        } else {
          const replacedSpaces = inputValue.replace(/ /g, '+')
          inputValue = `https://google.com/search?q=${replacedSpaces}`
        }
      }
    }

    if (currentElement.type === 'adblock') {
      handleToggleAdblock()
      return
    }

    dispatch('call-url-from-toolbar')
  }

  const handleToggleAdblock = async () => {
    //@ts-ignore
    dispatch('call-adblock-toggle-from-toolbar')
  }

  function handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement
    // Find the closest .toolbar-item ancestor, in case the click was on a child element
    const toolbarItem = target.closest('.toolbar-item')
    if (toolbarItem) {
      const dataIndex = toolbarItem.getAttribute('data-index')

      let currentElement = filteredItems[dataIndex]
      performAction(currentElement)
    }
  }

  onMount(() => {
    initialValue = inputValue
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

<div class="toolbar" bind:this={toolbar}>
  <ul style="list-style: none;">
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
            {adblockerState}
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
    ul {
      position: relative;
      bottom: 0;
      max-height: 40%;
      overflow-y: scroll;
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      gap: 8px;
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
</style>
