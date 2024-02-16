<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { optimisticCheckIfUrl } from '@horizon/core/src/lib/utils/url'

  import ToolbarItem from './ToolbarItem.svelte'
  import ToolbarGroupHeader from './ToolbarGroupHeader.svelte'
  import Horizon from '../../../../Horizon/Horizon.svelte'

  export let inputValue: string
  export let adblockerState: boolean
  export let horizon: Horizon

  let initialValue: string

  let originalItems = [
    {
      type: 'adblock',
      name: adblockerState ? 'Disable Adblock' : 'Enable Adblock',
      group: 'Actions'
    },
    { type: 'group', name: 'History (fake)', group: 'History' },
    {
      type: 'item',
      name: 'Hackernews – Origin',
      group: 'History',
      url: 'https://news.ycombinator.com/'
    },
    {
      type: 'item',
      name: 'Horizon Drop',
      group: 'History',
      url: 'https://www.notion.so/deta/Horizon-Drop-08-02-124615435fda40aeb05a9488722a60fb'
    },
    { type: 'item', name: 'Wikipedia', group: 'History', url: 'https://wikipedia.org' },
    { type: 'group', name: 'Search', group: 'Search' },
    { type: 'search', name: 'Use Perplexity', group: 'Search', searchEngine: 'perplexity' },
    { type: 'search', name: 'Search with Google', group: 'Search', searchEngine: 'google' }
  ]

  let filteredItems: any[] = []
  let selectedIndex = 0

  // Reactive statement to selectively filter items and control visibility of the Search group
  $: {
    if (inputValue && inputValue != initialValue) {
      const lowerInputValue = inputValue.toLowerCase()
      let historyItemsFiltered = originalItems.filter(
        (item) => item.group === 'History' && item.name.toLowerCase().includes(lowerInputValue)
      )

      let historyGroupHeader =
        historyItemsFiltered.length > 0
          ? [originalItems.find((item) => item.group === 'History' && item.type === 'group')]
          : []

      let searchItemsVisibility = optimisticCheckIfUrl(inputValue)
        ? []
        : originalItems.filter((item) => item.group === 'Search')

      let goToURLItem = optimisticCheckIfUrl(inputValue)
        ? [{ type: 'item', name: 'Go to URL', group: 'Action' }]
        : []
      filteredItems = [
        ...historyGroupHeader,
        ...historyItemsFiltered,
        ...searchItemsVisibility,
        ...goToURLItem
      ]
    } else {
      let goToURLItem = optimisticCheckIfUrl(inputValue)
        ? [
            { type: 'group', name: 'Actions', group: 'Actions' },
            { type: 'item', name: 'Refresh Page', group: 'Actions' }
          ]
        : []

      let withoutSearch = originalItems.filter((item) => item.group !== 'Search')

      filteredItems = [...withoutSearch, ...goToURLItem]
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

      // Send the user to the URL from the History
      if (currentElement.group == 'History') {
        inputValue = currentElement.url
      }

      // Perform actions for search engines
      if (currentElement.group == 'Search') {
        if (currentElement.searchEngine == 'perplexity') {
          const replacedSpaces = inputValue.replace(/ /g, '+')
          inputValue = `https://www.perplexity.ai/?q=${replacedSpaces}`
        }

        if (currentElement.searchEngine == 'google') {
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
    }
  }

  const handleToggleAdblock = async () => {
    //@ts-ignore
    horizon?.adblockerState.set(await window.api.toggleAdblocker('persist:horizon'))
  }

  onMount(() => {
    initialValue = inputValue
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

<div class="toolbar">
  <ul style="list-style: none;">
    {#each filteredItems as item, index}
      <li>
        {#if item.type === 'group'}
          <ToolbarGroupHeader title={item.name} />
        {:else}
          <ToolbarItem
            active={index === selectedIndex}
            name={item.name}
            type={item.type}
            {adblockerState}
            {inputValue}
          />
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style lang="scss">
  .toolbar {
    padding: 0.25rem;
  }
</style>
