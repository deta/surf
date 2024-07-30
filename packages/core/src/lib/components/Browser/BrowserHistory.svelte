<script lang="ts">
  import { onMount, tick, afterUpdate } from 'svelte'
  import type { ResourceHistoryEntryWithLinkedResource, TabHistory } from './types'
  import { useLogScope } from '../../utils/log'
  import { useResourceManager, type ResourceSearchResultItem } from '../../service/resources'
  import { derived, writable } from 'svelte/store'
  import BrowserHistoryEntry from './BrowserHistoryEntry.svelte'
  import { ResourceTagsBuiltInKeys } from '@horizon/types'
  import OasisResourceModalWrapper from '../Oasis/OasisResourceModalWrapper.svelte'
  import { Icon } from '@horizon/icons'
  import { useToasts } from '../../service/toast'

  export let tab: TabHistory
  export let active: boolean = false

  const log = useLogScope('BrowserHistory')
  const resourceManager = useResourceManager()
  const toasts = useToasts()

  const loading = writable(false)
  const historyEntries = writable<ResourceHistoryEntryWithLinkedResource[]>([])
  const showResourceDetails = writable(false)
  const resourceDetailsModalSelected = writable<string | null>(null)

  // New search-related state
  const searchTerm = writable('')

  // Derived store for filtered entries
  const filteredEntries = derived(
    [historyEntries, searchTerm],
    ([$historyEntries, $searchTerm]) => {
      if (!$searchTerm) return $historyEntries


      console.log('searching for:', $searchTerm)
      console.log('entries:', $historyEntries)

      const lowercaseSearch = $searchTerm.toLowerCase()
      return $historyEntries.filter((entry) => {
        const { entryResource, linkedResource } = entry
        const { title, raw_url, app_id } = entryResource.parsedData || {}

        return (
          title?.toLowerCase().includes(lowercaseSearch) ||
          raw_url?.toLowerCase().includes(lowercaseSearch)
        )
      })
    }
  )

  let containerHeight = 0
  let scrollTop = 0
  let itemHeight = 89.5
  let itemMargin = 10
  let overscan = 5
  let containerElement: HTMLElement

  $: visibleItemCount = Math.ceil(containerHeight / (itemHeight + itemMargin)) + overscan * 2
  $: startIndex = Math.max(0, Math.floor(scrollTop / (itemHeight + itemMargin)) - overscan)
  $: endIndex = Math.min(startIndex + visibleItemCount, $filteredEntries.length)
  $: visibleItems = $filteredEntries.slice(startIndex, endIndex)
  $: totalHeight = $filteredEntries.length * (itemHeight + itemMargin) - itemMargin

  $: if (active) {
    fetchHistory()
  }

  const fetchHistory = async () => {
    try {
      loading.set(true)

      log.debug('fetching history...')
      const entries = await resourceManager.getHistoryEntries()
      const sorted = entries.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      const parsed = await Promise.all(
        sorted.map(async (entry) => {
          const linkedResourceTag = (entry.tags ?? []).find(
            (tag) => tag.name === ResourceTagsBuiltInKeys.ANNOTATES
          )?.value
          const linkedResource = linkedResourceTag
            ? await resourceManager.getResource(linkedResourceTag)
            : null

          return {
            id: entry.id,
            entryResource: entry,
            linkedResource: linkedResource
          } as ResourceHistoryEntryWithLinkedResource
        })
      )

      log.debug('history entries:', parsed)
      historyEntries.set(parsed)
    } catch (error) {
      log.error('Failed to fetch history:', error)
    } finally {
      loading.set(false)
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

  const handleClearHistory = async () => {
    try {
      const confirmed = window.confirm('Are you sure you want to clear your history?')
      if (!confirmed) {
        return
      }

      const toast = toasts.loading('Clearing history...')

      log.debug('Clearing history...')
      await Promise.all($historyEntries.map((entry) => resourceManager.deleteResource(entry.id)))

      historyEntries.set([])
      toast.success('History cleared!')
    } catch (error) {
      log.error('Failed to clear history:', error)
    }
  }

  const deleteEntry = async (entryId: string) => {
    try {
      const updated = $historyEntries.filter((entry) => entry.id !== entryId)
      historyEntries.set(updated)

      log.debug('Deleting history entry:', entryId)
      await resourceManager.deleteResource(entryId)
    } catch (error) {
      log.error('Failed to delete history entry:', error)
    }
  }

  const handleScroll = () => {
    if (containerElement) {
      scrollTop = containerElement.scrollTop
    }
  }

  const updateContainerHeight = () => {
    if (containerElement) {
      containerHeight = containerElement.clientHeight
    }
  }

  onMount(() => {
    fetchHistory()
    updateContainerHeight()
    window.addEventListener('resize', updateContainerHeight)
    return () => window.removeEventListener('resize', updateContainerHeight)
  })

  afterUpdate(() => {
    updateContainerHeight()
  })

  // Reset scroll position when search term changes
  $: if ($searchTerm) {
    scrollTop = 0
    if (containerElement) {
      containerElement.scrollTop = 0
    }
  }
</script>

{#if $showResourceDetails && $resourceDetailsModalSelected}
  <OasisResourceModalWrapper
    resourceId={$resourceDetailsModalSelected}
    {active}
    on:close={() => closeResourceDetailsModal()}
    on:new-tab
  />
{/if}
<div class="wrapper">
  <div class="content">
    <div class="header">
      <div class="title">
        {#if $loading}
          <Icon name="spinner" size="28px" />
        {:else}
          <Icon name="history" size="28px" stroke-width="2.5px" />
        {/if}

        <h1>History</h1>
      </div>

      <!-- <input
        type="text"
        placeholder="Search history..."
        bind:value={$searchTerm}
        class="search-input"
      /> -->

      <button on:click={handleClearHistory}>Clear</button>
    </div>

    <div class="overflow-y-scroll p-4" bind:this={containerElement} on:scroll={handleScroll}>
      {#if $filteredEntries.length > 0}
        <div style="height: {totalHeight}px; position: relative">
          {#each visibleItems as item (item.id)}
            <div
              style="position: absolute; top: {(startIndex + visibleItems.indexOf(item)) *
                (itemHeight + itemMargin)}px; left: 0; right: 0; margin-bottom: {itemMargin}px;"
            >
              <BrowserHistoryEntry
                entry={item}
                on:open={() => openResourceDetailsModal(item.id)}
                on:delete={() => deleteEntry(item.id)}
                on:new-tab
              />
            </div>
          {/each}
        </div>
      {:else if $loading}
        <div class="loading flex flex-col">
          {#each new Array(10) as _, i}
            <div
              class="animate-pulse"
              style="width: 100%; height: {itemHeight}px; background-color: #ecebe5c6; border-radius: 12px;"
            />
          {/each}
        </div>
      {:else}
        <div class="empty">No history entries found</div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .items > div > div {
    margin-bottom: 10px; /* Adds space between items */
  }
  .wrapper {
    width: 100%;
    height: 100%;
    padding-top: 5rem;
    display: flex;
    justify-content: center;
    background-color: #f8f7f2;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 100%;
    max-width: 800px;
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;

    button {
      background-color: transparent;
      border: none;
      font-size: 1.2rem;
      font-weight: 500;
      color: #7d7448;
      cursor: pointer;
    }
  }

  .title {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1rem;
    font-weight: 500;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.25rem;
    color: #7d7448;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    color: #7d7448;
    padding: 6rem 0;
  }
</style>
