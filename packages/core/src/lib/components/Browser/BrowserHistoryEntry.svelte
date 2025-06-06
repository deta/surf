<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { isModKeyPressed, useLogScope } from '@horizon/utils'
  import { CreateTabEventTrigger } from '@horizon/types'
  import { Icon } from '@horizon/icons'
  import type { HistoryEntry } from '../../types'
  import { useTabsManager } from '../../service/tabs'

  export let entry: HistoryEntry

  const log = useLogScope('LinkPreview')
  const tabsManager = useTabsManager()
  const dispatch = createEventDispatcher<{
    delete: void
  }>()

  let title = ''
  let subtitle = ''
  let error = ''
  let hovering = false

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()

    if (!entry.url) return

    tabsManager.addPageTab(entry.url, {
      active: isModKeyPressed(e) ? e.shiftKey : true,
      trigger: CreateTabEventTrigger.History
    })
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
      if (!entry.url) {
        error = 'Invalid URL'
        return
      }

      const url = new URL(entry.url)

      const hostname = url.hostname.split('.').slice(-2, -1).join('')
      title = entry.title || hostname[0].toUpperCase() + hostname.slice(1)
      subtitle = `${url.hostname}${url.pathname}`

      log.debug('history entry:', entry)
    } catch (e) {
      log.error(e)
      error = 'Invalid URL'
    }
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="entry max-h-[90px] text-gray-900 dark:text-gray-100"
  on:click={handleClick}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <div class="details">
    {#if error}
      <div class="title">
        {error}
      </div>
    {:else}
      <div class="title truncate">
        {title}
      </div>

      <div class="subtitle">
        <img
          class="favicon"
          src={`https://www.google.com/s2/favicons?domain=${entry.url}&sz=64`}
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
    border: 1px solid #e5e2d5;
    border-radius: 12px;
    background-color: rgba(255, 255, 255, 0.75);
    transition: background-color 0.2s;

    position: relative;
    overflow: visible;

    &:hover {
      background-color: #ecebe5c6;
    }

    :global(.dark) & {
      background-color: rgba(255, 255, 255, 0.05);
      border-color: #3a3a3a;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        border-color: #4a4a4a;
      }
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

    &:hover {
      background: #ecebe5c6;
    }

    :global(.dark) & {
      background: rgba(255, 255, 255, 0.05);

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
</style>
