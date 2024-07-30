<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { Tab, TabPage } from './types'
  import { writable, type Writable } from 'svelte/store'
  import SpaceIcon from '../Drawer/SpaceIcon.svelte'
  import { HTMLDragZone, HTMLDragItem } from '@horizon/dragcula'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTagsBuiltInKeys, type Space } from '../../types'
  import { popover } from '../Atoms/Popover/popover'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import { tooltip as tooltip2 } from '../../utils/directives'

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let pinned: boolean
  export let isAlreadyOpen: boolean = false
  export let showButtons: boolean = true
  export let showExcludeOthersButton: boolean = false
  export let bookmarkingInProgress: boolean
  export let bookmarkingSuccess: boolean
  export let enableEditing = false
  export let showClose = false
  export let spaces
  export const inputUrl = writable<string>('')
  export let tabSize: number

  export const editAddress = async () => {
    isEditing = true

    await tick()

    addressInputElem.focus()
  }

  export const blur = () => {
    addressInputElem.blur()
  }

  const dispatch = createEventDispatcher<{
    select: string
    'remove-from-sidebar': string
    'delete-tab': string
    'unarchive-tab': string
    'input-enter': string
    bookmark: void
    'save-resource-in-space': string
    'create-live-space': void
    'exclude-other-tabs': string
  }>()
  const resourceManager = useResourceManager()

  let addressInputElem: HTMLInputElement
  let space: Space | null = null
  let isEditing = false
  let hovered = false
  let popoverVisible = false

  // $: acceptDrop = tab.type === 'space'
  $: isActive = tab.id === $activeTabId
  $: isBookmarkedByUser = tab.type === 'page' && tab.resourceBookmarkedManually
  $: url =
    (tab.type === 'page' && (tab.currentLocation || tab.currentDetectedApp?.canonicalUrl)) || null

  $: if (tab.type === 'page' && !isEditing) {
    if (url) {
      $inputUrl = new URL(url).hostname
    } else {
      $inputUrl = tab.title
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

  const handleInputFocus = async () => {
    isEditing = true

    if (url) {
      $inputUrl = isEditing ? url : new URL(url).hostname
    }

    // scroll to the end
    setTimeout(() => {
      addressInputElem.scrollLeft = addressInputElem.scrollWidth
    }, 0)

    await tick()

    addressInputElem.select()
  }

  const handleInputBlur = () => {
    isEditing = false
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      dispatch('input-enter', $inputUrl)
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

  $: sanitizedTitle = tab.title
    ? tab.type !== 'space'
      ? tab.title
          .replace(/\[.*?\]|\(.*?\)|\{.*?\}|\<.*?\>/g, '')
          .replace(/[\/\\]/g, '–')
          .replace(/^\w/, (c) => c.toUpperCase())
      : tab.title
    : ''

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

  const handlePopoverEnter = () => {
    popoverVisible = true
  }

  const handlePopoverLeave = () => {
    popoverVisible = false
  }

  let isDragging = false
</script>

<!-- style:view-transition-name="tab-{tab.id}" -->
<div
  class="tab {isActive ? 'text-sky-950 bg-sky-200 shadow-inner ring-[0.5px] ring-sky-500' : ''}
  flex items-center {pinned
    ? 'p-2 rounded-lg'
    : 'px-4 py-3 rounded-2xl'} group transform active:scale-95 transition duration-100 group cursor-pointer gap-3 relative text-sky-900 font-medium text-md hover:bg-sky-100 z-50 select-none"
  style="width: {tabSize}px; min-width: {tabSize}px; max-width: {tabSize}px;"
  on:click={handleClick}
  on:mouseenter={() => (hovered = true)}
  on:mouseleave={() => {
    if (!popoverVisible) hovered = false
  }}
  aria-hidden="true"
  class:pinned
  draggable={true}
  style:view-transition-name="tab-{tab.id}"
  use:HTMLDragItem.action={{
    id: tab.id,
    data: { 'farc/tab': tab }
  }}
  on:DragStart={(e) => {
    isDragging = true
    e.item.data = {
      'farc/tab': {
        ...tab,
        pinned
      },
      'custom/test': 'hello'
    }
  }}
  on:DragEnd={(e) => {
    isDragging = false
    dispatch('DragEnd', e)
  }}
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
  <div
    class="icon-wrapper {showClose && !pinned && hovered ? 'group-hover:hidden' : ''}"
    style:view-transition-name="tab-icon-{tab.id}"
  >
    {#if tab.icon}
      <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
    {:else if tab.type === 'horizon'}
      <Icon name="grid" size="18px" />
    {:else if tab.type === 'importer'}
      <Icon name="code" size="18px" />
    {:else if tab.type === 'history'}
      <Icon name="history" size="18px" />
    {:else if tab.type === 'space' && space}
      <SpaceIcon folder={space} />
    {:else}
      <Icon name="world" size="18px" />
    {/if}
  </div>

  {#if showClose && hovered}
    {#if tab.type == 'space'}
      <button
        on:click|stopPropagation={handleRemoveSpaceFromSidebar}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-0 m-0 h-min-content bg-none text-sky-900 cursor-pointer"
        use:tooltip2={{
          text: 'Remove from Sidebar (⌘ + W)',
          position: 'right'
        }}
      >
        <Icon name="close" size="18px" />
      </button>
    {:else}
      <button
        on:click|stopPropagation={handleArchive}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-0 m-0 h-min-content bg-none text-sky-900 cursor-pointer"
        use:tooltip2={{
          text: 'Delete this tab (⌘ + W)',
          position: 'right'
        }}
      >
        {#if tab.archived}
          <Icon name="trash" size="18px" />
        {:else}
          <Icon name="close" size="18px" />
        {/if}
      </button>
    {/if}
  {/if}

  {#if !tab.pinned || !pinned}
    <div class=" relative flex-grow truncate mr-1">
      {#if (tab.type === 'page' || tab.type === 'empty') && isActive && enableEditing && (hovered || isEditing)}
        <input
          type="text"
          bind:value={$inputUrl}
          on:focus={handleInputFocus}
          on:blur={handleInputBlur}
          on:keydown={handleInputKeydown}
          bind:this={addressInputElem}
          class="w-full h-full bg-transparent focus:outline-none group-active:select-none
          {!isEditing
            ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 bg-[length:250%_100%]'
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

        {#if tab.type === 'page' && isActive}
          {#key isBookmarkedByUser}
            <button
              on:mouseenter={handlePopoverEnter}
              on:click={handleBookmark}
              use:tooltip={{
                content: isBookmarkedByUser ? 'Saved to Oasis' : 'Save to Oasis (⌘ + D)',
                action: 'hover',
                position: 'left',
                animation: 'fade',
                delay: 500
              }}
              on:save-resource-in-space={handleSaveResourceInSpace}
              on:popover-close={handlePopoverLeave}
              use:popover={{
                content: {
                  component: ShortcutSaveItem,
                  props: { resourceManager, spaces }
                },
                action: 'hover',
                position: 'right-top',
                style: {
                  backgroundColor: '#f5f5f5'
                },
                animation: 'fade',
                delay: 950
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
          <Icon name="arrow.autofit.up" size="18px" />
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .tab {
    transition:
      0.2s ease-in-out,
      transform 0s;
  }
  :global(.tab[data-dragcula-dragging-item]) {
    background: rgba(255, 255, 255, 0.6);
    opacity: 80%;
  }
  .icon-wrapper {
    width: 18px;
    height: 18px;
    display: block;
    user-select: none;
    flex-shrink: 0;
  }
</style>
