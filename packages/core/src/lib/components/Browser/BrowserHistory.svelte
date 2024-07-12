<script lang="ts">
  import { onMount } from 'svelte'
  import type { ResourceHistoryEntryWithLinkedResource, TabHistory } from './types'
  import { useLogScope } from '../../utils/log'
  import {
    Resource,
    ResourceHistoryEntry,
    useResourceManager,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import { derived, writable } from 'svelte/store'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'
  import LoadingBox from '../Atoms/LoadingBox.svelte'
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

      $historyEntries = []
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

  onMount(() => {
    fetchHistory()
  })
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

      <button on:click={handleClearHistory}>Clear</button>
    </div>

    <div class="items">
      {#if $historyEntries.length > 0}
        {#each $historyEntries as item (item.id)}
          <BrowserHistoryEntry
            entry={item}
            on:open={() => openResourceDetailsModal(item.id)}
            on:delete={() => deleteEntry(item.id)}
            on:new-tab
          />
        {/each}
      {:else if $loading}
        <div class="loading">Loading…</div>
      {:else}
        <div class="empty">No history entries</div>
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
      background-color: transparent;
      border: none;
      font-size: 1.2rem;
      font-weight: 500;
      color: #7d7448;
      cursor: pointer;
    }
  }

  .items {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 4rem;
    padding: 1rem;
    margin: -1rem;
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
