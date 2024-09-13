<script lang="ts">
  import { useLogScope, tooltip as tooltip2 } from '@horizon/utils'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import Image from '../Atoms/Image.svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import type { Tab, TabPage, TabSpace } from '../../types/browser.types'
  import { writable, type Writable } from 'svelte/store'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { HTMLDragZone, HTMLDragItem, DragculaDragEvent } from '@horizon/dragcula'
  import { Resource, useResourceManager } from '../../service/resources'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type Space,
    type DragTypes,
    DragTypeNames
  } from '../../types'
  import { popover } from '../Atoms/Popover/popover'
  import ShortcutSaveItem from '../Shortcut/ShortcutSaveItem.svelte'
  import CustomPopover from '../Atoms/CustomPopover.svelte'

  const log = useLogScope('Browser Tab')

  export let tab: Tab
  export let activeTabId: Writable<string>
  export let pinned: boolean
  export let showButtons: boolean = true
  export let showExcludeOthersButton: boolean = false
  export let showIncludeButton: boolean = false
  export let bookmarkingInProgress: boolean = false
  export let isUserSelected: boolean
  export let bookmarkingSuccess: boolean = false
  export let enableEditing = false
  export let showClose = false
  export let spaces
  export const inputUrl = writable<string>('')
  export let hibernated = false
  export let tabSize: number | undefined = undefined
  export let horizontalTabs = true
  export let removeHighlight = false
  export let isSelected = false
  export let isMagicActive = false

  export const editAddress = async () => {
    isEditing = true
    await tick()
    if (addressInputElem) {
      addressInputElem.focus()
      // Set cursor to end of input
      addressInputElem.setSelectionRange(
        addressInputElem.value.length,
        addressInputElem.value.length
      )
    } else {
      log.error('addressInputElem is not defined')
    }
  }

  export const blur = () => {
    addressInputElem?.blur()
  }

  const dispatch = createEventDispatcher<{
    select: string
    'multi-select': string
    'passive-select': string
    'remove-from-sidebar': string
    'delete-tab': string
    'unarchive-tab': string
    'input-enter': string
    bookmark: void
    'save-resource-in-space': Space
    'create-live-space': void
    'add-source-to-space': Space
    'exclude-other-tabs': string
    'exclude-tab': string
    'include-tab': string
    Drop: { drag: DragculaDragEvent; spaceId: string }
    DragEnd: DragculaDragEvent
    edit: void
    mouseenter: string
    mouseleave: string
  }>()
  const resourceManager = useResourceManager()

  const liveSpacePopoverOpened = writable(false)
  const saveToSpacePopoverOpened = writable(false)

  let addressInputElem: HTMLInputElement
  let space: Space | null = null
  let isDragging = false
  let isEditing = false
  let hovered = false
  let popoverVisible = false
  let popoverLiveSpaceVisible = false

  // $: acceptDrop = tab.type === 'space'
  $: isActive = tab.id === $activeTabId && !removeHighlight
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

  $: showLiveSpaceButton = checkIfLiveSpacePossible(tab)

  // $: if (tab.type === 'space') {
  //   fetchSpace(tab.spaceId)
  // }

  // NOTE: commented out 'sanitizations' are not useful
  $: sanitizedTitle = tab.title
  // ? tab.type !== 'space'
  //   ? tab.title
  //       .replace(/\[.*?\]|\(.*?\)|\{.*?\}|\<.*?\>/g, '')
  //       .replace(/[\/\\]/g, '–')
  //       .replace(/^\w/, (c) => c.toUpperCase())
  //   : tab.title
  // : ''

  const checkIfLiveSpacePossible = (tab: Tab) => {
    if (tab.type !== 'page') return false

    if (tab.currentDetectedApp?.rssFeedUrl) return true

    if (tab.currentDetectedApp?.appId === 'youtube') {
      return true
    }

    return false
  }

  const handleClick = (e: MouseEvent) => {
    const clickedElement = e.target as HTMLElement

    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      blur()

      dispatch('multi-select', tab.id)
      return
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      blur()

      dispatch('passive-select', tab.id)
      return
    } else if (clickedElement !== addressInputElem) {
      e.preventDefault()
      e.stopPropagation()

      dispatch('select', tab.id)
    }

    if (clickedElement === addressInputElem) {
      // && (e.shiftKey || e.metaKey || e.ctrlKey)
      e.preventDefault()
      //e.stopImmediatePropagation()
      e.stopPropagation()
      return
      //blur()
    }
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
    if (url) {
      $inputUrl = url
    }

    // Use setTimeout to ensure this runs after the input value has been updated
    setTimeout(() => {
      addressInputElem.setSelectionRange(0, addressInputElem.value.length)
      addressInputElem.scrollLeft = addressInputElem.scrollWidth
    }, 0)
  }

  const handleInputBlur = () => {
    isEditing = false
  }

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      dispatch('input-enter', $inputUrl)
    } else if (event.key === 'Escape') {
      if (addressInputElem) {
        addressInputElem.blur()
      } else {
        log.error('addressInputElem is not defined')
      }
    }
  }

  const fetchSpace = async (id: string) => {
    try {
      space = await resourceManager.getSpace(id)
    } catch (error) {
      log.error('Failed to fetch space:', error)
    }
  }

  const handleBookmark = () => {
    saveToSpacePopoverOpened.set(false)
    dispatch('bookmark')
  }

  const handleCreateLiveSpace = () => {
    liveSpacePopoverOpened.set(false)
    dispatch('create-live-space')
  }

  const handleAddSourceToSpace = (event: CustomEvent<Space>) => {
    liveSpacePopoverOpened.set(false)
    dispatch('add-source-to-space', event.detail)
  }

  const handleSaveResourceInSpace = (event: CustomEvent<Space>) => {
    saveToSpacePopoverOpened.set(false)
    dispatch('save-resource-in-space', event.detail)
  }

  const handleExcludeOthers = () => {
    dispatch('exclude-other-tabs', tab.id)
  }

  const handleExcludeTab = () => {
    dispatch('exclude-tab', tab.id)
  }

  const handleIncludeTab = () => {
    dispatch('include-tab', tab.id)
  }

  const handleDragStart = async (drag: DragculaDragEvent<DragTypes>) => {
    isDragging = true

    drag.item!.data.setData<DragTypes>(DragTypeNames.SURF_TAB, { ...tab, pinned }) // FIX: pinned is not included but needed for reordering to work

    if (tab.resourceBookmark !== undefined && tab.resourceBookmark !== null) {
      drag.item!.data.setData(DragTypeNames.ASYNC_SURF_RESOURCE, () =>
        resourceManager.getResource(tab.resourceBookmark)
      )
    }
    drag.continue()
  }

  const handleDragEnd = (drag: DragculaDragEvent) => {
    isDragging = false
    dispatch('DragEnd', drag)
  }

  const handleDragEnter = (drag: DragculaDragEvent) => {
    drag.continue()
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    dispatch('Drop', { drag, spaceId: (tab as TabSpace).spaceId })
  }

  onMount(() => {
    if (tab.type === 'space') {
      fetchSpace(tab.spaceId)
    }
  })
</script>

<div
  draggable={true}
  id="tab-{tab.id}"
  class={`tab no-drag 
${isActive ? 'active' : ''} 
${
  tab.magic
    ? isActive
      ? 'bg-pink-500/80 text-pink-950 shadow-inner ring-[0] ring-pink-600'
      : 'bg-pink-400/60 text-pink-950'
    : isActive
      ? 'text-sky-950 bg-sky-200 sticky shadow-inner ring-[0.5px] ring-sky-500'
      : isSelected
        ? 'bg-white outline outline-2 outline-sky-500'
        : ''
} 
flex items-center 
${
  pinned
    ? 'p-0.5 rounded-lg'
    : horizontalTabs
      ? 'py-1.5 px-3 rounded-xl'
      : 'px-4 py-2.5 rounded-2xl'
} 
group transform active:scale-[98%] group cursor-pointer gap-3 justify-center relative text-sky-900 font-medium text-md hover:bg-sky-100 z-50 select-none`}
  class:bg-green-200={isActive && $inputUrl === 'surf.featurebase.app' && !tab.magic}
  class:bg-sky-200={isActive && $inputUrl !== 'surf.featurebase.app' && !tab.magic}
  class:pinned
  class:hovered
  class:selected={isSelected}
  class:combine-border={(isMagicActive && tab.magic) ||
    (!isMagicActive && (isSelected || isActive))}
  class:magic={tab.magic}
  style={tabSize
    ? `width: ${tabSize}px; min-width: ${isActive && !pinned ? 260 : tabSize}px; max-width: ${tabSize}px;`
    : ''}
  style:position="relative"
  aria-hidden="true"
  style:view-transition-name="tab-{tab.id}"
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
  on:DragEnd={handleDragEnd}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (tab.type !== 'space' || tab.spaceId === 'all') return false
      if (
        drag.isNative ||
        drag.item.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        return true
      }
      return false
    }
  }}
  on:Drop={handleDrop}
  on:click={handleClick}
  on:mouseenter={() => {
    hovered = true
    dispatch('mouseenter', tab.id)
  }}
  on:mouseleave={() => {
    if (!popoverVisible) hovered = false
    dispatch('mouseleave', tab.id)
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
  <!-- Temporary DragZone overlay to allow dropping onto space tabs -->
  <!--{#if tab.type === 'space' && tab.spaceId !== 'all'}
    <div
      id="tabZone-{tab.id}"
      class="tmp-tab-drop-zone"
      style="position: absolute; inset-inline: 10%; inset-block: 20%;"
      on:DragEnter={(drag) => {
        /*const dragData = drag.data
        if (
          drag.isNative ||
          (dragData['surf/tab'] !== undefined && dragData['surf/tab'].type !== 'space') ||
          dragData['oasis/resource'] !== undefined
        ) {
          drag.continue() // Allow the drag
          return
        }
        drag.abort()*/
        // TODO: FIX
        drag.continue()
      }}
      on:Drop={handleDrop}
    ></div>
  {/if}-->

  <div
    class:icon-wrapper={true}
    class:flex-shrink-0={true}
    class:group-hover:hidden={(!isActive &&
      showClose &&
      ((tabSize && tabSize > 64 && horizontalTabs) || !horizontalTabs) &&
      !pinned &&
      hovered) ||
      (isActive && showClose && !pinned && hovered)}
  >
    <!--     style:view-transition-name="tab-icon-{tab.id}" -->
    {#if tab.icon}
      <Image src={tab.icon} alt={tab.title} fallbackIcon="world" />
    {:else if tab.type === 'horizon'}
      <Icon name="grid" size="16px" />
    {:else if tab.type === 'importer'}
      <Icon name="code" size="16px" />
    {:else if tab.type === 'history'}
      <Icon name="history" size="16px" />
    {:else if tab.type === 'space' && space}
      <SpaceIcon folder={space} />
    {:else}
      <Icon name="world" size="16px" />
    {/if}
  </div>

  {#if showClose && ((tabSize && tabSize > 64 && horizontalTabs) || !horizontalTabs || isActive) && hovered}
    {#if tab.type == 'space'}
      <button
        on:click|stopPropagation={handleRemoveSpaceFromSidebar}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
        use:tooltip2={{
          text: 'Remove from Sidebar (⌘ + W)',
          position: 'right'
        }}
      >
        <Icon name="close" size="16px" />
      </button>
    {:else}
      <button
        on:click|stopPropagation={handleArchive}
        class="items-center hidden group-hover:flex justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
      >
        {#if tab.archived}
          <Icon name="trash" size="16px" />
        {:else}
          <Icon name="close" size="16px" />
        {/if}
      </button>
    {/if}
  {/if}
  {#if (!tab.pinned || !pinned) && ((horizontalTabs && isActive) || !(horizontalTabs && tabSize && tabSize < 48))}
    <div class=" relative flex-grow truncate mr-1">
      {#if (tab.type === 'page' || tab.type === 'empty') && isActive && enableEditing && (hovered || isEditing)}
        <input
          type="text"
          bind:value={$inputUrl}
          on:focus={handleInputFocus}
          on:blur={handleInputBlur}
          placeholder="Enter URL or search query"
          on:keydown={handleInputKeydown}
          bind:this={addressInputElem}
          class={`w-full h-full bg-transparent focus:outline-none group-active:select-none
          ${
            !isEditing && !isMagicActive
              ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-sky-900 to-sky-900 via-sky-500 bg-[length:250%_100%] z-[60]'
              : ''
          }`}
        />
      {:else}
        <div
          aria-hidden="true"
          class={`whitespace-nowrap overflow-hidden truncate max-w-full ${isMagicActive && tab.magic ? 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%]' : ''}`}
        >
          {#if tab.type === 'space'}
            {tab.title}
          {:else}
            {sanitizedTitle}
          {/if}
        </div>
      {/if}
    </div>

    {#if showButtons && !isEditing && (hovered || $liveSpacePopoverOpened || $saveToSpacePopoverOpened) && ((tabSize && tabSize > 64) || isActive) && !showExcludeOthersButton}
      <div class="items-center flex justify-end flex-row gap-3 right-0">
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
            <Icon name="arrowbackup" size="16px" />
          </button>
        {/if}

        {#if tab.type === 'page' && isActive && showLiveSpaceButton}
          <CustomPopover position="right" popoverOpened={liveSpacePopoverOpened}>
            <button
              slot="trigger"
              class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
              on:click={handleCreateLiveSpace}
            >
              <Icon name="news" />
            </button>

            <div slot="content" class="no-drag p-1">
              <ShortcutSaveItem
                on:save-resource-in-space={handleAddSourceToSpace}
                {spaces}
                infoText="Add page as a source to Space:"
              />
            </div>
          </CustomPopover>
        {/if}

        {#if tab.type === 'page' && isActive}
          {#key isBookmarkedByUser}
            <CustomPopover position="right" popoverOpened={saveToSpacePopoverOpened}>
              <button
                slot="trigger"
                class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
                on:click={handleBookmark}
              >
                {#if bookmarkingInProgress}
                  <Icon name="spinner" size="16px" />
                {:else if bookmarkingSuccess}
                  <Icon name="check" size="16px" />
                {:else if isBookmarkedByUser}
                  <Icon name="bookmarkFilled" size="16px" />
                {:else}
                  <Icon name="leave" size="16px" />
                {/if}
              </button>

              <div slot="content" class="no-drag p-1">
                <ShortcutSaveItem
                  on:save-resource-in-space={handleSaveResourceInSpace}
                  {spaces}
                  infoText="Save page to Space:"
                />
              </div>
            </CustomPopover>
          {/key}
        {/if}

        <!-- {#if tab.magic}
          <button
            on:click|stopPropagation={handleExcludeTab}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none transition-colors text-sky-800 hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
            use:tooltip={{
              content: 'Add Tab to Context',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            <Icon name="minus" size="16px" />
          </button>
        {/if} -->
      </div>
    {:else if (showExcludeOthersButton || showIncludeButton) && hovered}
      <div class="items-center flex justify-end flex-row space-x-2 right-0">
        {#if showExcludeOthersButton}
          <button
            on:click|stopPropagation={handleExcludeOthers}
            class="flex items-center justify-center appearance-none border-none p-1 -m-1 h-min-content bg-none text-sky-900 transition-colors hover:text-sky-950 hover:bg-sky-200/80 rounded-full cursor-pointer"
            use:tooltip={{
              content: 'Only use this tab',
              action: 'hover',
              position: 'left',
              animation: 'fade',
              delay: 500
            }}
          >
            <!-- <Icon name="arrow.autofit.up" size="16px" /> -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon icon-tabler icons-tabler-outline icon-tabler-focus-centered"
              ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"
              /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path
                d="M16 4h2a2 2 0 0 1 2 2v2"
              /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /></svg
            >
          </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style lang="scss">
  .tab {
    border: 1.5px solid transparent;
    transition:
      0s ease-in-out,
      transform 0s;
  }
  :global(.tab img) {
    user-select: none;
  }

  :global(.tab[data-dragging-item]) {
    background: #e0f2fe;
    opacity: 1;
  }
  :global(.tab[data-drag-preview]) {
    background: rgba(255, 255, 255, 1);
    opacity: 80%;
    border: 2px solid rgba(10, 12, 24, 0.1);
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
  :global(.tab[data-drag-preview][data-drag-target^='webview']) {
    /*border-width: 1.5px;
    border-color: rgba(5, 5, 25, 0.3);
    border-style: dashed;*/
    background: #fff;
    border: 1.5px dashed rgba(5, 5, 25, 0.3);
    opacity: 95%;
    // https://getcssscan.com/css-box-shadow-examples
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
  :global(body[data-dragging='true'] .tab:not([data-dragging-item])) {
    background: transparent !important;
  }
  :global(body[data-dragging='true'] .tab:not([data-dragging-item])) {
    box-shadow: none;
  }

  :global(.tab[data-drag-target='true']) {
    border: 1.5px dashed rgba(5, 5, 25, 0.3);
  }

  /*:global(.tab[data-dragcula-dragging-item='true'] .tmp-tab-drop-zone) {
    pointer-events: none;
  }
  :global(body:not([data-dragcula-dragging='true']) .tmp-tab-drop-zone) {
    display: none;
  }*/
  .icon-wrapper {
    width: 16px;
    height: 16px;
    display: block;
    user-select: none;
    flex-shrink: 0;
  }

  .tab.selected:not(.active) {
    opacity: 1;
    background: rgba(255, 255, 255, 0.55);
    outline: none;
  }
  /*.tab.magic:not(.active) {
    //background: rgba(255, 205, 205, 0.55);
    @apply bg-violet-600/25;
  }*/

  /* #FF729F */

  /*.tab.magic {
    background: #ff8cc6 !important;
    color: #560027;
    &:hover {
      background: #ff578f !important;
      color: #560027;
    }
  }

  .tab.magic.active {
    background: #ffccf1 !important;
    color: #760042;
  }*/

  .tab.active {
    background: #e0f2fe;
    outline: none;
  }

  :global(.vertical-tabs) {
    .tab.combine-border {
      border-radius: 1rem 1rem 0 0;
    }

    .tab.combine-border + .combine-border {
      border-radius: 0;
    }

    .tab.combine-border:has(+ :not(.combine-border)) {
      border-radius: 0 0 1rem 1rem;
    }

    .tab:not(.combine-border) + .combine-border:has(+ :not(.combine-border)) {
      border-radius: 1rem;
    }

    /* This fixes none borders for last element in list if selected. */
    .tab:last-child.combine-border {
      border-bottom-left-radius: 1rem;
      border-bottom-right-radius: 1rem;
    }
    /* This fixes none borders for first element in list if selected. */
    .tab:first-child.combine-border {
      border-top-left-radius: 1rem;
      border-top-right-radius: 1rem;
    }
  }

  :global(.horizontal-tabs) {
    .tab.combine-border {
      border-radius: 1rem 0 0 1rem;

      position: relative;
      &::after {
        content: '';
        position: absolute;
        right: -5px;
        top: -1.5px;
        bottom: -1.5px;
        width: 3.5px;
        background: inherit;
      }
    }

    .tab.combine-border + .combine-border {
      border-radius: 0;
    }

    .tab.combine-border:has(+ :not(.combine-border)) {
      border-radius: 0 1rem 1rem 0;

      &::after {
        content: unset;
      }
    }

    .tab:not(.combine-border) + .combine-border:has(+ :not(.combine-border)) {
      border-radius: 1rem;
    }

    /* This fixes none borders for last element in list if selected. */
    .tab:last-child.combine-border {
      border-top-right-radius: 1rem;
      border-bottom-right-radius: 1rem;

      &::after {
        content: unset;
      }
    }
    /* This fixes none borders for first element in list if selected. */
    .tab:first-child.combine-border {
      border-top-left-radius: 1rem;
      border-bottom-left-radius: 1rem;
    }
  }

  .tab.pinned.magic {
    position: relative;
    &::after {
      position: absolute;
      z-index: -1;
      filter: blur(4px);
      content: '';
      inset: 0px;
      border-radius: 15px;

      //@apply animate-text-shimmer;
      @apply bg-gradient-to-r from-indigo-600 to-blue-700 via-sky-400 bg-[length:250%_100%];
      animation: text-shimmer 2s infinite linear;
    }
  }
</style>
