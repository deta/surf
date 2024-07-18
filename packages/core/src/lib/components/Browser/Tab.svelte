<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { Tab, TabPage } from './types'
  import type { Writable } from 'svelte/store'
  import SpaceIcon from '../Drawer/SpaceIcon.svelte'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTagsBuiltInKeys, type Space } from '../../types'
  import { popover } from '../Atoms/Popover/popover'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let pinned: boolean
  export let isAlreadyOpen: boolean = false
  export let showButtons: boolean = true
  export let showExcludeOthersButton: boolean = false
  export let bookmarkingInProgress: boolean
  export let bookmarkingSuccess: boolean
  export let addressInputElem: HTMLInputElement
  export let enableEditing = false
  export let spaces

  const dispatch = createEventDispatcher<{
    select: (id: string) => void
    'remove-from-sidebar': (id: string) => void
    'delete-tab': (id: string) => void
    'unarchive-tab': (id: string) => void
    'input-enter': (url: string) => void
    bookmark: () => void
    'save-resource-in-space': (spaceId: string) => void
    'create-live-space': () => void
    'exclude-other-tabs': (id: string) => void
  }>()
  const resourceManager = useResourceManager()

  let space: Space | null = null
  let isEditing = false
  let inputUrl = ''
  let hovered = false

  // $: acceptDrop = tab.type === 'space'
  $: isActive = tab.id === $activeTabId
  $: isBookmarkedByUser = tab.type === 'page' && tab.resourceBookmarkedManually

  $: if (tab.type === 'page' && !isEditing) {
    if (tab.currentDetectedApp?.canonicalUrl) {
      const url = new URL(tab.currentDetectedApp?.canonicalUrl)
      inputUrl = url.hostname
    }
  }

  const handleClick = () => {
    if (isAlreadyOpen) return
    dispatch('select', tab.id)
  }

  const handleRemoveSpaceFromSidebar = (_e: MouseEvent) => {
    dispatch('remove-from-sidebar', tab.id)
  }

  const handleArchive = () => {
    dispatch('delete-tab', tab.id)
  }

  const handleUnarchive = () => {
    dispatch('unarchive-tab', tab.id)
  }

  const handleInputFocus = () => {
    isEditing = true

    if ((tab as TabPage).currentDetectedApp?.canonicalUrl) {
      const url = new URL(tab.currentDetectedApp?.canonicalUrl)
      inputUrl = isEditing ? tab.currentDetectedApp?.canonicalUrl : url.hostname
    }

    // scroll to the end
    setTimeout(() => {
      addressInputElem.scrollLeft = addressInputElem.scrollWidth
    }, 0)

    addressInputElem.select()
  }

  const handleInputBlur = () => {
    isEditing = false
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      dispatch('input-enter', inputUrl)
    } else if (event.key === 'Escape') {
      addressInputElem.blur()
    }
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

  const handleBookmark = () => {
    dispatch('bookmark')
  }

  const handleCreateLiveSpace = () => {
    dispatch('create-live-space')
  }

  const handleSaveResourceInSpace = (event: CustomEvent<string>) => {
    dispatch('save-resource-in-space', event.detail)
  }

  const handleExcludeOthers = () => {
    dispatch('exclude-other-tabs', tab.id)
  }
</script>

<div
  class="{isActive ? 'text-sky-950 bg-sky-200 shadow-inner ring-[0.5px] ring-sky-500' : ''}
  flex items-center {pinned
    ? 'p-2 rounded-lg'
    : 'px-4 py-3 rounded-2xl'} group transform active:scale-95 transition duration-100group cursor-pointer gap-3 relative text-sky-900 font-medium text-md hover:bg-sky-100 z-50 select-none"
  on:click={handleClick}
  on:mouseenter={() => (hovered = true)}
  on:mouseleave={() => (hovered = false)}
  aria-hidden="true"
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
      <Icon name="grid" size="18px" />
    </div>
  {:else if tab.type === 'importer'}
    <div class="icon-wrapper">
      <Icon name="code" size="18px" />
    </div>
  {:else if tab.type === 'history'}
    <div class="icon-wrapper">
      <Icon name="history" size="18px" />
    </div>
  {:else if tab.type === 'space' && space}
    <div class="icon-wrapper">
      <SpaceIcon folder={space} />
    </div>
  {:else}
    <div class="icon-wrapper">
      <Icon name="world" size="18px" />
    </div>
  {/if}

  {#if !tab.pinned || !pinned}
    <div class=" relative flex-grow truncate mr-1">
      {#if tab.type === 'page' && isActive && enableEditing}
        <input
          type="text"
          bind:value={inputUrl}
          on:focus={handleInputFocus}
          on:blur={handleInputBlur}
          on:keydown={handleInputKeydown}
          bind:this={addressInputElem}
          class="w-full bg-transparent focus:outline-none group-active:select-none
          {!isEditing
            ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-600 bg-[length:250%_100%]'
            : ''}
          "
        />
      {:else}
        <div class=" whitespace-nowrap overflow-hidden truncate max-w-full">
          {#if tab.type === 'space'}
            {tab.title}
          {:else}
            {sanitizedTitle}
          {/if}
        </div>
      {/if}
    </div>

    {#if showButtons && !isEditing && hovered}
      <div class="items-center flex justify-end flex-row space-x-2 right-0">
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
            <Icon name="arrowbackup" size="18px" />
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
            <Icon name="close" size="18px" />
          </button>
        {:else}
          {#if tab.type === 'page' && isActive}
            {#key isBookmarkedByUser}
              <button
                on:click={handleBookmark}
                use:tooltip={{
                  content: isBookmarkedByUser ? 'Saved to Oasis' : 'Save to Oasis (⌘ + D)',
                  action: 'hover',
                  position: 'left',
                  animation: 'fade',
                  delay: 500
                }}
                on:save-resource-in-space={handleSaveResourceInSpace}
                use:popover={{
                  content: {
                    component: ShortcutSaveItem,
                    props: { resourceManager, spaces }
                  },
                  action: 'hover',
                  position: 'right-top',
                  style: {
                    backgroundColor: '#F8F7F1'
                  },
                  animation: 'fade',
                  delay: 1200
                }}
              >
                {#if bookmarkingInProgress}
                  <Icon name="spinner" />
                {:else if bookmarkingSuccess}
                  <Icon name="check" />
                {:else if isBookmarkedByUser}
                  <Icon name="bookmarkFilled" />
                {:else}
                  <Icon name="leave" />
                {/if}
              </button>
            {/key}
          {/if}

          {#if tab.type === 'page' && tab.currentDetectedApp?.rssFeedUrl && isActive}
            <button
              on:click={handleCreateLiveSpace}
              class="flex items-center justify-center appearance-none border-none p-0 m-0 h-min-content bg-none text-sky-900 cursor-pointer"
              use:tooltip={{
                content: `Create ${tab.currentDetectedApp.appName} live Space`,
                action: 'hover',
                position: 'left',
                animation: 'fade',
                delay: 500
              }}
            >
              <Icon name="news" />
            </button>
          {/if}

          <button
            on:click|stopPropagation={handleArchive}
            class="flex items-center justify-center appearance-none border-none p-0 m-0 h-min-content bg-none text-sky-900 cursor-pointer"
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
              <Icon name="trash" size="18px" />
            {:else}
              <Icon name="close" size="18px" />
            {/if}
          </button>
        {/if}
      </div>
    {:else if showExcludeOthersButton && hovered}
      <div class="items-center flex justify-end flex-row space-x-2 right-0">
        <button
          on:click|stopPropagation={handleExcludeOthers}
          class="flex items-center justify-center appearance-none border-none p-0 m-0 h-min-content bg-none text-sky-900 cursor-pointer"
          use:tooltip={{
            content: 'Only use this tab',
            action: 'hover',
            position: 'left',
            animation: 'fade',
            delay: 500
          }}
        >
          <Icon name="filter" size="18px" />
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .icon-wrapper {
    width: 18px;
    height: 18px;
    display: block;
    user-select: none;
    flex-shrink: 0;
  }
</style>
