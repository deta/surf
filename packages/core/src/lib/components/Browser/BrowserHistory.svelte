<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'
  import type { HistoryEntry, TabHistory } from '../../types'
  import { tooltip, useLogScope } from '@horizon/utils'
  import { useResourceManager } from '../../service/resources'
  import { derived, writable } from 'svelte/store'
  import BrowserHistoryEntry from './BrowserHistoryEntry.svelte'
  import { Icon } from '@horizon/icons'
  import { useToasts } from '../../service/toast'

  export let tab: TabHistory
  export let active: boolean = false

  const log = useLogScope('BrowserHistory')
  const resourceManager = useResourceManager()
  const toasts = useToasts()

  const loading = writable(false)
  const historyEntries = writable<HistoryEntry[]>([])
  const searchTerm = writable('')

  // Derived store for filtered entries
  const filteredEntries = derived(
    [historyEntries, searchTerm],
    ([$historyEntries, $searchTerm]) => {
      if (!$searchTerm) return $historyEntries

      const lowercaseSearch = $searchTerm.toLowerCase()
      return $historyEntries.filter((entry) => {
        const { title, url } = entry || {}

        return (
          title?.toLowerCase().includes(lowercaseSearch) ||
          url?.toLowerCase().includes(lowercaseSearch)
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

      const filtered = entries.filter((entry) => entry.url && entry.type === 'navigation')
      const sorted = filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      log.debug('history entries:', sorted)
      historyEntries.set(sorted)
    } catch (error) {
      log.error('Failed to fetch history:', error)
    } finally {
      loading.set(false)
    }
  }

  const handleClearHistory = async () => {
    try {
      const confirmed = window.confirm(
        'Are you sure you want to clear your history? This cannot be undone.'
      )
      if (!confirmed) {
        return
      }

      const toast = toasts.loading('Clearing history...')

      log.debug('Clearing history...')
      await Promise.all(
        $historyEntries.map((entry) => resourceManager.deleteHistoryEntry(entry.id))
      )

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
      await resourceManager.deleteHistoryEntry(entryId)
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

      <div class="header-actions">
        <input
          type="text"
          placeholder="Search history..."
          bind:value={$searchTerm}
          class="search-input"
        />

        <button on:click={handleClearHistory} use:tooltip={{ text: 'Clear history' }}>
          <Icon name="trash" size="20px" />
        </button>
      </div>
    </div>

    <div class="overflow-y-scroll p-4 -m-4" bind:this={containerElement} on:scroll={handleScroll}>
      {#if $filteredEntries.length > 0}
        <div style="height: {totalHeight}px; position: relative">
          {#each visibleItems as item (item.id)}
            <div
              class="history-entry"
              style="position: absolute; top: {(startIndex + visibleItems.indexOf(item)) *
                (itemHeight + itemMargin)}px; left: 0; right: 0; margin-bottom: {itemMargin}px;"
            >
              <BrowserHistoryEntry entry={item} on:delete={() => deleteEntry(item.id)} />
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
      background-color: #e6e3d7;
      border-radius: 8px;
      border: 1px solid #e5e2d5;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      font-weight: 500;
      color: #7d7448;
      cursor: pointer;
      flex-shrink: 0;
    }

    input {
      border-radius: 8px;
      background-color: white;
      padding: 0.5rem 1rem;
      font-size: 1.2rem;
      font-weight: 500;
      color: #7d7448;
      outline: none;
      width: 300px;
      background: paint(squircle);
      --squircle-radius: 6px;
      --squircle-smooth: 0.2;
      --squircle-outline: 2px;
      --squircle-fill: #e5e2d5;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1rem;
    font-weight: 500;

    h1 {
      font-size: 1.5rem;
      font-weight: 500;
    }
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
