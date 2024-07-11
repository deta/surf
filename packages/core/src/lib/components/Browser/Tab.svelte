<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { Tab } from './types'
  import type { Writable } from 'svelte/store'
  import SpaceIcon from '../Drawer/SpaceIcon.svelte'
  import { useResourceManager } from '../../service/resources'
  import type { Space } from '../../types'

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let deleteTab: (tabId: string) => void
  export let pinned: boolean
  export let isAlreadyOpen: boolean = false

  export let unarchiveTab: (tabId: string) => void
  export let showButtons: boolean = true

  const dispatch = createEventDispatcher()
  const resourceManager = useResourceManager()

  let space: Space | null = null

  $: acceptDrop = tab.type === 'space'
  let dragOver = false

  const handleClick = () => {
    if (isAlreadyOpen) { return}
    dispatch('select', tab.id)
  }

  const handleRemoveSpaceFromSidebar = (_e: MouseEvent) => {
    dispatch('remove-from-sidebar', tab.id)
  }

  const handleArchive = () => {
    deleteTab(tab.id)
    //tab.archived ? deleteTab(tab.id) : archiveTab(tab.id)
  }

  const handleUnarchive = () => {
    unarchiveTab(tab.id)
  }

  const fetchSpace = async (id: string) => {
    try {
      space = await resourceManager.getSpace(id)
    } catch (error) {
      console.error('Failed to fetch space:', error)
    }
  }

  $: if (tab.type === 'space') {
    fetchSpace(tab.spaceId)
  }

  $: sanitizedTitle =
    tab.type !== 'space'
      ? tab.title
          .replace(/\[.*?\]|\(.*?\)|\{.*?\}|\<.*?\>/g, '')
          .replace(/[\/\\]/g, '–')
          .replace(/^\w/, (c) => c.toUpperCase())
      : tab.title
</script>

<div
  class="tab"
  class:active={tab.id === $activeTabId}
  on:click={handleClick}
  aria-hidden="true"
  class:pinned
  use:tooltip={pinned
    ? {
        content: sanitizedTitle,
        action: 'hover',
        position: 'top',
        animation: 'fade',
        delay: 500
      }
    : {}}
>
  {#if tab.icon}
    <div class="icon-wrapper">
      <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
    </div>
  {:else if tab.type === 'horizon'}
    <div class="icon-wrapper">
      <Icon name="grid" size="20px" />
    </div>
  {:else if tab.type === 'importer'}
    <div class="icon-wrapper">
      <Icon name="code" size="20px" />
    </div>
  {:else if tab.type === 'space' && space}
    <div class="icon-wrapper">
      <SpaceIcon folder={space} />
    </div>
  {:else}
    <div class="icon-wrapper">
      <Icon name="world" size="20px" />
    </div>
  {/if}

  {#if !tab.pinned || !pinned}
    <div class="title">
      {#if tab.type === 'space'}
        {tab.title}
      {:else}
        {sanitizedTitle}
      {/if}
    </div>
    <!-- {tab.index} -->

    {#if showButtons}
      {#if tab.archived}
        <button
          on:click|stopPropagation={handleUnarchive}
          class="close"
          use:tooltip={{
            content: 'Move back to active tabs',
            action: 'hover',
            position: 'left',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="arrowbackup" size="20px" />
        </button>
      {/if}

      {#if tab.type == 'space'}
        <button
          on:click|stopPropagation={handleRemoveSpaceFromSidebar}
          class="close"
          use:tooltip={{
            content: 'Remove from Sidebar (⌘ + W)',
            action: 'hover',
            position: 'left',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="close" size="20px" />
        </button>
      {:else}
        <button
          on:click|stopPropagation={handleArchive}
          class="close"
          use:tooltip={{
            //content: tab.archived ? 'Delete this tab (⌘ + W)' : 'Archive this tab (⌘ + W)',
            content: 'Delete this tab (⌘ + W)',
            action: 'hover',
            position: 'left',
            animation: 'fade',
            delay: 500
          }}
        >
          {#if tab.archived}
            <Icon name="trash" size="20px" />
          {:else}
            <Icon name="close" size="20px" />
          {/if}
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.75rem 1rem 1rem;
    border-radius: 12px;
    cursor: pointer;
    gap: 10px;
    position: relative;
    color: #484f7d;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: 0.2s ease-in-out;
    &:hover {
      background-color: rgb(213, 255, 255);
    }
    z-index: 100;

    & * {
      user-select: none;
    }

    &.pinned {
      padding: 0.75rem;
    }
  }

  .tab.active {
    color: #585130;
    background-color: rgb(213, 255, 255);
    outline: 0.25px solid rgba(0, 0, 0, 0.05);
    box-shadow:
      -0.5px -0.5px 5px 0px rgba(255, 255, 255, 0.1) inset,
      -0.5px 5px 5px 0px rgba(0, 0, 0, 0.02),
      0px 12px 12px 0px rgba(0, 0, 0, 0.03),
      0px 24px 20px 0px rgba(0, 0, 0, 0.04);
  }

  .icon-wrapper {
    width: 20px;
    height: 20px;
    display: block;
    user-select: none;
  }

  .title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.1rem;
  }

  .close {
    display: none;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: none;
    padding: 0;
    margin: 0;
    height: min-content;
    background: none;
    color: #a9a9a9;
    cursor: pointer;
  }

  .tab:hover .close {
    display: flex;
  }
</style>
