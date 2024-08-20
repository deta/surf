<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { ResourceHistoryEntry } from '../../service/resources'
  import { useLogScope, isModKeyPressed } from '@horizon/utils'
  import type { ResourcePreviewEvents } from '../Resources/events'
  import { CreateTabEventTrigger, type ResourceDataHistoryEntry } from '@horizon/types'
  import { Icon } from '@horizon/icons'
  import type { ResourceHistoryEntryWithLinkedResource } from '../../types/browser.types'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'

  export let entry: ResourceHistoryEntryWithLinkedResource

  const log = useLogScope('LinkPreview')
  const dispatch = createEventDispatcher<{
    data: ResourceDataHistoryEntry
    load: void
    open: void
    delete: void
    'new-tab': BrowserTabNewTabEvent
  }>()

  let data: ResourceDataHistoryEntry | null = null
  let title = ''
  let subtitle = ''
  let image = ''
  let error = ''
  let loading = true
  let hovering = false

  const handleLoad = () => {
    dispatch('load')
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()

    if (isModKeyPressed(e)) {
      dispatch('new-tab', {
        url: data?.raw_url ?? '',
        active: e.shiftKey,
        trigger: CreateTabEventTrigger.History
      })
    } else {
      dispatch('open')
    }
  }

  const handleMouseEnter = () => {
    hovering = true
  }

  const handleMouseLeave = () => {
    hovering = false
  }

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    dispatch('delete')
  }

  onMount(async () => {
    try {
      loading = true
      data = await entry.entryResource.getParsedData()
      dispatch('data', data)

      const url = new URL(data.raw_url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title =
        data.title ??
        entry.entryResource?.metadata?.name ??
        hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`

      dispatch('load')
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    entry.entryResource.releaseData()
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="entry max-h-[90px]"
  on:click={handleClick}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <div class="details">
    {#if error}
      <div class="title">
        {error}
      </div>
    {:else if data}
      <div class="title truncate">
        {title}
      </div>

      <div class="subtitle">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${data.raw_url}&sz=48`}
          alt="favicon"
        />

        <div class="subtitle">
          {subtitle}
        </div>
      </div>
    {/if}
  </div>

  {#if hovering}
    <div on:click={handleDelete} class="close">
      <Icon name="close" />
    </div>
  {/if}
</div>

<style lang="scss">
  .entry {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 12px;
    background-color: rgba(255, 255, 255, 0.75);
    transition: background-color 0.2s;
    cursor: pointer;
    position: relative;
    overflow: visible;

    &:hover {
      background-color: #ecebe5c6;
    }
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: hidden;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 500;
  }

  .subtitle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .favicon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
  }

  .close {
    position: absolute;
    top: -1rem;
    right: -1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.75);
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    cursor: pointer;

    &:hover {
      background: #ecebe5c6;
    }
  }
</style>
