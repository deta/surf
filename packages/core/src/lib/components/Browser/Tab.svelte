<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'

  export let tab
  export let activeTabId
  export let archiveTab
  export let deleteTab
  export let unarchiveTab

  const dispatch = createEventDispatcher()

  const handleClick = () => {
    console.log('SET TAB ACTIVE: ', tab.id)
    dispatch('select', tab.id)
  }

  const handleArchive = () => {
    tab.archived ? deleteTab(tab.id) : archiveTab(tab.id)
  }

  const handleUnarchive = () => {
    unarchiveTab(tab.id)
  }
</script>

<div class="tab" class:active={tab.id === $activeTabId} on:click={handleClick} aria-hidden="true">
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
  {:else}
    <div class="icon-wrapper">
      <Icon name="world" size="20px" />
    </div>
  {/if}

  <div class="title">
    {tab.title}
  </div>

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

  <button
    on:click|stopPropagation={handleArchive}
    class="close"
    use:tooltip={{
      content: tab.archived ? 'Delete this tab (⌘ + W)' : 'Archive this tab (⌘ + W)',
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
</div>

<style>
  .tab {
    display: flex;
    align-items: center;
    padding: 1rem 0.75rem 1rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    gap: 10px;
    position: relative;
    color: #7d7448;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    &:hover {
      background-color: #e0e0d1;
    }
  }

  .tab.active {
    color: #585130;
    background-color: #fff;
  }

  .icon-wrapper {
    width: 20px;
    height: 20px;
    display: block;
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
