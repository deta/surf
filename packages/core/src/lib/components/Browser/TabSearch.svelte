<script lang="ts">
  import { writable, get } from 'svelte/store'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { useLogScope } from '../../utils/log'
  import type { Tab } from './types'
  import TabItem from './Tab.svelte'
  import Fuse from 'fuse.js'

  export let onClose = () => {}
  export let activeTabs: Tab[] = []

  const dispatch = createEventDispatcher()
  const log = useLogScope('TabSearch')

  let searchInputRef: HTMLInputElement
  let filteredTabs: Tab[] = activeTabs
  let searchQuery = ''
  let activeTabId = writable<string>('')
  let itemElements: HTMLElement[] = []

  let fuseOptions = {
    keys: ['title'],
    threshold: 0.5
  }

  let fuse = new Fuse<Tab>(activeTabs, fuseOptions)

  $: {
    filteredTabs = activeTabs
    fuse = new Fuse<Tab>(activeTabs, fuseOptions)
  }

  const handleKeydown = (event: any) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredTabs.length > 0) {
        onClose()
        dispatch('activateTab', get(activeTabId))
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const currentIndex = filteredTabs.findIndex((tab) => tab.id === get(activeTabId))
      if (currentIndex < filteredTabs.length - 1) {
        activeTabId.set(filteredTabs[currentIndex + 1].id)
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = filteredTabs.findIndex((tab) => tab.id === get(activeTabId))
      if (currentIndex > 0) {
        activeTabId.set(filteredTabs[currentIndex - 1].id)
      }
    }
    setTimeout(() => {
      scrollItemIntoView(filteredTabs.findIndex((tab) => tab.id === get(activeTabId)))
    }, 20)
  }

  const scrollItemIntoView = (index: number) => {
    const targetElement = itemElements[index]
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
    }
  }

  const handleSearch = (event: any) => {
    searchQuery = event.target.value
    log.debug('searchQuery', searchQuery)
    if (searchQuery) {
      const result = fuse.search(searchQuery)
      filteredTabs = result.map((r) => r.item)
      activeTabId.set(filteredTabs[0].id)
    } else {
      filteredTabs = activeTabs
      activeTabId.set(activeTabs[0].id)
    }
  }

  // TODO: not have these empty props for tabItem
  const deleteTab = (tabId: string) => {
    return
  }
  const unarchiveTab = (tabId: string) => {
    return
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    if (searchInputRef) {
      searchInputRef.focus()
    }
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
</script>

<div
  class="fixed top-0 shadow-2xl left-0 h-full w-full flex justify-center items-center bg-sky-900/5 backdrop-blur-sm overlay"
>
  <div class="content">
    <input
      bind:this={searchInputRef}
      type="text"
      placeholder="Jump to tab..."
      on:input={handleSearch}
      bind:value={searchQuery}
    />
    {#if filteredTabs.length > 0}
      <div class="tabs-list">
        {#each filteredTabs as tab, index}
          <li bind:this={itemElements[index]}>
            <TabItem
              {tab}
              {activeTabId}
              {deleteTab}
              {unarchiveTab}
              showButtons={false}
              pinned={false}
            />
          </li>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .overlay {
    z-index: 50001;
  }

  .content {
    width: 60rem;
    padding: 1rem;
    background-color: paleturquoise;
    border-radius: 12px;
  }

  .content input[type='text'] {
    width: 100%;
    padding: 1rem;
    margin-right: 2rem;
    border: none;
    border-radius: 8px;
    border-bottom: 1px solid #e0e0e0;
    font-size: 16px;
    box-sizing: border-box;
    outline: none;
  }

  .tabs-list {
    list-style: none;
    margin-top: 1rem;
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
  }
</style>
