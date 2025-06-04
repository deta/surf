<script lang="ts" context="module">
  export type CreateSpaceTabEvent = { tab: TabSpace; active: boolean }
  export type SpaceSelectedEvent = { id: string; canGoBack: boolean }
  export type DeleteSpaceEvent = { id: string }

  export type SpacesViewEvents = {
    createTab: CreateSpaceTabEvent
    'space-selected': SpaceSelectedEvent
    'create-empty-space': void
    'delete-space': DeleteSpaceEvent
    'handled-drop': void
    'close-oasis': void
    'open-space-and-chat': { spaceId: string }
  }
</script>

<script lang="ts">
  import { createEventDispatcher, tick, onMount } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { tooltip, useLocalStorageStore, useLogScope } from '@horizon/utils'
  import Folder, { type EditingStartEvent, type FolderEvents } from '..//Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { OasisSpace, pickRandomColorPair, useOasis } from '../../../service/oasis'

  import { useToasts } from '../../../service/toast'
  import {
    DragTypeNames,
    SpaceEntryOrigin,
    type DragTypes,
    type SpaceData,
    type TabSpace
  } from '../../../types'
  import type { Readable } from 'svelte/store'
  import { useTelemetry } from '../../../service/telemetry'
  import { ChangeContextEventTrigger, OpenSpaceEventTrigger } from '@horizon/types'
  import { type ResourceManager } from '../../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import BuiltInSpace from '../BuiltInSpace.svelte'
  import { DragculaDragEvent, HTMLAxisDragZone } from '@horizon/dragcula'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { BuiltInSpaces, BuiltInSpaceId } from '../../../constants/spaces'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const ai = useAI()
  const config = useConfig()
  const dispatch = createEventDispatcher<SpacesViewEvents>()

  let sidebarElement: HTMLElement
  let pinnedList: HTMLElement
  let unpinnedList: HTMLElement
  let scrollableContainer: HTMLElement

  // Scroll state for main container
  let showTopShadowMain = false
  let showBottomShadowMain = true

  // Scroll state for unpinned list
  let showTopShadowUnpinned = false
  let showBottomShadowUnpinned = true

  // Sidebar resize functionality
  let isResizing = false
  let startX = 0
  let startWidth = 0
  let sidebarEl: HTMLElement | null = null
  const MIN_WIDTH = 200
  const MAX_WIDTH = 400

  export const interactive = true
  export const type: 'grid' | 'horizontal' = 'grid'

  export let spaces: Readable<OasisSpace[]>
  export let resourceManager: ResourceManager
  export let showPreview = true

  const editingSpaceId = writable<string | null>(null)
  const didChangeOrder = writable(false)
  const showAllSpaces = useLocalStorageStore<boolean>('showAllSpacesInOasis', true, true)
  const sidebarWidth = useLocalStorageStore<number>('spacesSidebarWidth', 256, true) // Default width 16rem (256px)

  const userSettings = config.settings
  const selectedSpace = oasis.selectedSpace
  const sortedSpaces = oasis.sortedSpacesList

  const pinnedSpaces = derived(sortedSpaces, ($sortedSpaces) => {
    const spaceMap = new Map()
    $sortedSpaces.pinned.forEach((space) => {
      spaceMap.set(space.id, space)
    })
    return Array.from(spaceMap.values())
  })
  const missingSourceSpaces = derived(sortedSpaces, ($sortedSpaces) => $sortedSpaces.linked)

  const builtInSpaces = derived(userSettings, ($userSettings) => {
    return BuiltInSpaces.filter(
      (space) => space.id !== BuiltInSpaceId.Inbox || !$userSettings.save_to_active_context
    )
  })

  $: log.debug('sortedSpaces', $sortedSpaces)
  $: log.debug('pinnedSpaces', $pinnedSpaces)

  export const handleCreateSpace = async (
    name: string,
    colors?: [string, string],
    userPrompt?: string
  ) => {
    try {
      const newSpace = await oasis.createSpace({
        folderName: name ? name : '.tempspace',
        colors: pickRandomColorPair(),
        smartFilterQuery: userPrompt ? userPrompt : null,
        liveModeEnabled: !!userPrompt
      })

      log.debug('New Space:', newSpace)

      oasis.changeSelectedSpace(newSpace.id)

      await tick()

      if (colors) {
        await oasis.updateSpaceData(newSpace.id, {
          colors: colors
        })
      }

      const inputElement = document.getElementById(`space-input-${newSpace.id}`) as HTMLInputElement
      if (inputElement) {
        inputElement.select()
      }

      return newSpace.id
    } catch (error) {
      log.error('Failed to create space:', error)
      return null
    }
  }

  export const createSpaceWithAI = async (
    spaceId: string,
    userPrompt: string,
    colors?: [string, string]
  ) => {
    try {
      const toasty = toast.loading('Creating Space with AI...')
      log.debug('Creating space with AI', userPrompt)

      const response = await ai.getResourcesViaPrompt(userPrompt)

      log.debug(`Automatic Space Generation request`, response)

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results)

      log.debug('Automatic Space generated with', results)

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        return
      }

      if (colors) {
        await oasis.updateSpaceData(spaceId, {
          colors: colors,
          sql_query: response.sql_query,
          embedding_query: response.embedding_search_query ?? undefined
        })
      }

      // TODO(@felix): make sure resourceIds do not contain the blacklisted ones
      await oasis.addResourcesToSpace(spaceId, resourceIds, SpaceEntryOrigin.LlmQuery)

      await resourceManager.telemetry.trackRefreshSpaceContent(
        RefreshSpaceEventTrigger.RenameSpaceWithAI,
        {
          usedSmartQuery: true,
          addedResources: resourceIds.length > 0
        }
      )

      resourceIds.length === 0
        ? toasty.info('No resources found for your description.')
        : toasty.success('Space created with AI!')
    } catch (err) {
      log.error('Failed to create Space with AI', err)
    } finally {
      await tick()
    }
  }

  export const createdNewSpace = async (space: OasisSpace) => {
    didChangeOrder.set(false)
    showAllSpaces.set(true)
    const newIndex = $pinnedSpaces.length
    await oasis.moveSpaceToIndex(space.id, newIndex)
    didChangeOrder.set(true)
  }

  const addItemToTabs = async (id: string, active: boolean) => {
    try {
      log.debug('Adding Space to tabs:', id)
      const space = $spaces.find((space) => space.id === id)
      if (space) {
        space.dataValue.showInSidebar = true

        await oasis.updateSpaceData(id, {
          showInSidebar: true
        })

        dispatch('createTab', {
          tab: {
            title: space.dataValue.folderName,
            icon: '',
            spaceId: id,
            type: 'space',
            index: 0,
            pinned: false,
            archived: false
          } as TabSpace,
          active: active
        })

        await tick()

        await telemetry.trackOpenSpace(OpenSpaceEventTrigger.SidebarMenu, {
          isLiveSpace: space.dataValue.liveModeEnabled,
          hasSources: (space.dataValue.sources ?? []).length > 0,
          hasSmartQuery: !!space.dataValue.smartFilterQuery
        })
      }
    } catch (error) {
      log.error('Failed to delete Space:', error)
    }
  }

  const handleSpaceUpdate = async (id: string, updates: Partial<SpaceData>) => {
    try {
      log.debug('Updating space:', id, updates)
      if (id === 'everything') {
        log.debug('Cannot update the Everything Space')
        return
      }

      const space = $spaces.find((space) => space.id === id)
      if (!space) {
        log.error('Space not found:', id)
        return
      }

      await oasis.updateSpaceData(id, updates)

      await tabsManager.updateSpaceTabs(id, updates)
    } catch (error) {
      log.error('Failed to update Space:', error)
    }
  }

  const handleSpaceSelect = async (id: string) => {
    try {
      log.debug('Selecting space:', id)
      if (id === 'everything') {
        log.debug('Cannot select the Everything Space')
        return
      }
      oasis.resetNavigationHistory()
      oasis.selectedSpace.set(id)
      log.debug('Selected space changed, dispatching space-selected event')
      dispatch('space-selected', { id: id, canGoBack: true })
    } catch (error) {
      log.error('Failed to select Space:', error)
    }
  }

  const handleUseAsContext = (spaceId: string) => {
    tabsManager.changeScope(spaceId, ChangeContextEventTrigger.SpaceInOasis)
    dispatch('close-oasis')
  }

  const handleWheel = (event: WheelEvent) => {
    if (sidebarElement) {
      sidebarElement.scrollLeft += event.deltaY
    }
  }

  const handleEditingStart = (event: CustomEvent<EditingStartEvent>) => {
    const newEditingId = event.detail.id
    editingSpaceId.set(newEditingId)
  }

  const handleEditingEnd = () => {
    editingSpaceId.set(null)
  }

  const handleCreateEmptySpace = () => {
    const selectedSpaceObj = $spaces.find((space) => space.id === $selectedSpace)
    if (!selectedSpaceObj || selectedSpaceObj.dataValue.folderName !== '.tempspace') {
      dispatch('create-empty-space')
    }
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    log.debug('dropping onto sidebar', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

    if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item.data.getData(DragTypeNames.SURF_SPACE)
      if (!space) return

      const target = drag.to?.id

      dispatch('handled-drop')
      drag.continue()

      log.debug('dropped space', space, drag.index, target)

      if (target === 'overlay-spaces-list-pinned') {
        let newIndex = drag.index
        log.debug('moving space to new index', newIndex)
        if (newIndex == null) {
          newIndex = $pinnedSpaces.length
        }
        if (!space.dataValue.pinned) {
          await space.updateData({ pinned: true })
        }
        didChangeOrder.set(false)
        log.debug('moving space to index', newIndex)
        await oasis.moveSpaceToIndex(space.id, newIndex)
        didChangeOrder.set(true)
      }
    }
  }

  const handlePin = async (e: CustomEvent<FolderEvents['pin']>) => {
    try {
      const id = e.detail
      const space = $spaces.find((space) => space.id === id)
      if (space) {
        // Move the pinned space to the end of the pinned list
        didChangeOrder.set(false)
        const lastPinnedIndex = $pinnedSpaces.length
        await space.updateData({ pinned: true })
        await oasis.moveSpaceToIndex(id, lastPinnedIndex)
        didChangeOrder.set(true)
      }
    } catch (error) {
      log.error('Failed to pin Space:', error)
    }
  }

  const handleUnpin = async (e: CustomEvent<FolderEvents['unpin']>) => {
    try {
      const id = e.detail
      const space = $spaces.find((space) => space.id === id)
      if (space) {
        // Move the unpinned space to the start of the unpinned list
        didChangeOrder.set(false)
        const firstUnpinnedIndex = $pinnedSpaces.length - 1
        await space.updateData({ pinned: false })
        await oasis.moveSpaceToIndex(id, firstUnpinnedIndex)
        didChangeOrder.set(true)
      }
    } catch (error) {
      log.error('Failed to unpin Space:', error)
    }
  }

  const handleOpenSpaceAndChat = (e: CustomEvent<{ spaceId: string }>) => {
    dispatch('open-space-and-chat', e.detail)
    dispatch('close-oasis')
  }

  const checkMainListOverflow = () => {
    if (!scrollableContainer) return

    // Show top shadow if not at the top
    showTopShadowMain = scrollableContainer.scrollTop > 2

    // Show bottom shadow if not at the bottom
    showBottomShadowMain =
      scrollableContainer.scrollHeight > scrollableContainer.clientHeight &&
      scrollableContainer.scrollTop + scrollableContainer.clientHeight <
        scrollableContainer.scrollHeight - 2
  }

  const checkUnpinnedListOverflow = () => {
    if (!unpinnedList) return

    // Show top shadow if not at the top
    showTopShadowUnpinned = unpinnedList.scrollTop > 2

    // Show bottom shadow if not at the bottom
    showBottomShadowUnpinned =
      unpinnedList.scrollHeight > unpinnedList.clientHeight &&
      unpinnedList.scrollTop + unpinnedList.clientHeight < unpinnedList.scrollHeight - 2
  }

  const recalculateListOverflows = async (_didChangeOrder: boolean, _showAllSpaces: boolean) => {
    await tick()
    checkMainListOverflow()
    checkUnpinnedListOverflow()
  }

  const handleResize = () => {
    recalculateListOverflows($didChangeOrder, $showAllSpaces)
  }

  const startResize = (e: MouseEvent) => {
    if (!sidebarElement) return
    sidebarEl = sidebarElement

    // Remove transition during resize for smoother dragging
    sidebarEl.style.transition = 'none'

    isResizing = true
    startX = e.clientX
    startWidth = $sidebarWidth

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    // Add event listeners to document to handle mouse movement and release
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !sidebarEl) return

    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      const delta = e.clientX - startX
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta))

      // Directly update the DOM for immediate feedback
      sidebarEl!.style.width = `${newWidth}px`
      sidebarEl!.style.maxWidth = `${newWidth}px`

      // Update the store value (but less frequently)
      if (Math.abs($sidebarWidth - newWidth) > 5) {
        sidebarWidth.set(newWidth)
      }
    })
  }

  const stopResize = () => {
    isResizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Restore transition after resize is complete
    if (sidebarEl) {
      // Update the store with final width
      const currentWidth = parseInt(sidebarEl.style.width)
      sidebarWidth.set(currentWidth)

      // Restore transition
      setTimeout(() => {
        if (sidebarEl) sidebarEl.style.transition = ''
      }, 0)
    }

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', stopResize)
    sidebarEl = null
  }

  // Recalculate overflows when the list changes
  $: recalculateListOverflows($didChangeOrder, $showAllSpaces)

  onMount(() => {
    if ($selectedSpace) {
      const elem = document.getElementById(`space-${$selectedSpace}`)
      if (elem) {
        elem.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    }

    // Initialize scroll indicators
    checkMainListOverflow()
    checkUnpinnedListOverflow()
  })
</script>

<svelte:window on:resize={handleResize} />

<div
  id="spaces-view-wrapper"
  class="folders-sidebar p-2 pl-12 bg-white/95 dark:bg-gray-900/95"
  class:all-spaces-hidden={!$showAllSpaces}
  bind:this={sidebarElement}
  on:wheel|passive={handleWheel}
  style="width: {$sidebarWidth}px; max-width: {$sidebarWidth}px;"
>
  <!-- Resize handle -->
  <div class="resize-handle" on:mousedown={startResize}></div>
  <!-- Built-in spaces - always visible section -->
  <div class="built-in-section">
    <div class="built-in-list">
      {#each $builtInSpaces as builtInSpace (builtInSpace.id)}
        <div class="folder-wrapper">
          <BuiltInSpace
            id={builtInSpace.id}
            name={builtInSpace.name.folderName}
            icon={builtInSpace.name.icon}
            selected={$selectedSpace === builtInSpace.id}
            on:select={() => {
              console.log('Built-in space selected:', builtInSpace.id)
              handleSpaceSelect(builtInSpace.id)
            }}
            on:space-selected={() => {
              console.log('Built-in space-selected event:', builtInSpace.id)
              handleSpaceSelect(builtInSpace.id)
            }}
            on:Drop
          />
        </div>
      {/each}
    </div>
  </div>

  <!-- Scrollable middle section containing pinned and connected lists -->
  <div class="scrollable-lists-container" class:all-spaces={$showAllSpaces}>
    <!-- Top shadow indicator -->
    <div class="scroll-indicator top" class:visible={showTopShadowMain}></div>

    <div
      class="scroll-content"
      bind:this={scrollableContainer}
      on:scroll={() => checkMainListOverflow()}
    >
      <div
        bind:this={pinnedList}
        class="pinned-list"
        class:empty={$pinnedSpaces.length === 0}
        axis="vertical"
        id="overlay-spaces-list-pinned"
        use:HTMLAxisDragZone.action={{
          accepts: (drag) => {
            if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
              return true
            }
            return false
          }
        }}
        on:Drop={handleDrop}
      >
        <div class="separator">
          <!-- <div class="separator-line"></div> -->
          Pinned
        </div>
        {#if $pinnedSpaces.length === 0}
          <div class="pinned-list-drag-indicator-wrapper">
            <div class="pinned-list-drag-indicator-icon">
              <Icon name="info" size="16px" />
            </div>
            <div class="pinned-list-drag-indicator">
              <p>Drag contexts here to pin them</p>
            </div>
          </div>
        {:else}
          {#each $pinnedSpaces as folder (folder.id)}
            <Folder
              {folder}
              on:select={(e) => handleSpaceSelect(e.detail)}
              on:space-selected={(e) => handleSpaceSelect(e.detail.id)}
              on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
              on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
              on:use-as-context={(e) => handleUseAsContext(e.detail)}
              on:open-space-and-chat={handleOpenSpaceAndChat}
              on:Drop
              on:editing-start={handleEditingStart}
              on:editing-end={handleEditingEnd}
              on:pin={handlePin}
              on:unpin={handleUnpin}
              selected={$selectedSpace === folder.id}
              isEditing={$editingSpaceId === folder.id}
              allowPinning
              {showPreview}
            />
          {/each}
        {/if}
      </div>

      {#if $missingSourceSpaces.length > 0}
        <div class="connected-list">
          {#if $userSettings.experimental_context_linking}
            <div class="separator">
              Most Connected
              <!-- <div class="separator-line"></div> -->
            </div>

            {#each $missingSourceSpaces as folder (folder.id)}
              <div class="space-source-item">
                <Folder
                  {folder}
                  {editingSpaceId}
                  on:select={(e) => handleSpaceSelect(e.detail)}
                  on:space-selected={(e) => handleSpaceSelect(e.detail.id)}
                  on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
                  on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
                  on:use-as-context={(e) => handleUseAsContext(e.detail)}
                  on:open-space-and-chat={handleOpenSpaceAndChat}
                  on:Drop
                  on:editing-start={handleEditingStart}
                  on:editing-end={handleEditingEnd}
                  on:pin={handlePin}
                  on:unpin={handleUnpin}
                  selected={$selectedSpace === folder.id}
                  isEditing={$editingSpaceId === folder.id}
                  allowPinning
                  {showPreview}
                />
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Bottom shadow indicator -->
    <div class="scroll-indicator bottom" class:visible={showBottomShadowMain}></div>
  </div>
  <div class="create-new-space-wrapper">
    <button
      class="action-new-space"
      class:disabled={$selectedSpace &&
        $spaces.find((space) => space.id === $selectedSpace)?.dataValue.folderName === '.tempspace'}
      on:click|stopPropagation={handleCreateEmptySpace}
      data-tooltip-target="create-space"
      data-tooltip-action="action-new-space"
      use:tooltip={{ position: 'top', text: 'Create a new context' }}
    >
      <span>New Context</span>
      <Icon name="add" size="17px" stroke-width="2" />
    </button>
  </div>
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  .folders-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    padding: 1rem 0.75rem 1rem 0.75rem;
    gap: 0.75rem;
    height: 100%;
    backdrop-filter: blur(24px);
    transition: width 0.15s ease-out;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: ew-resize;
    z-index: 100;
    background: transparent;

    &:hover {
      background: rgba(59, 130, 246, 0.3);
    }

    &:active {
      background: rgba(59, 130, 246, 0.5);
    }
  }

  .built-in-section {
    width: 100%;
    flex-shrink: 0;
  }

  .create-new-space-wrapper {
    position: relative;
  }

  .scrollable-lists-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;

    /* Default state when all spaces is collapsed */
    flex: 1 1 auto;
    min-height: 0;
    max-height: 100%;

    /* Ensure content is visible by proper overflow handling */
    overflow: visible;

    /* Hide scrollbar but keep functionality */
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      width: 0px;
      background: transparent;
    }
  }

  .scroll-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding-bottom: 0.5rem;

    /* Allow content to scroll within this container */
    overflow-y: auto;
    overflow-x: hidden;

    /* Take full height and allow shrinking/growing as needed */
    flex: 1 1 auto;
    max-height: 100%;

    /* Hide scrollbar but keep functionality */
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      width: 0px;
      background: transparent;
    }
  }

  /* Scroll indicators styling */
  .scroll-indicator {
    position: absolute;
    left: 0;
    right: 0;
    height: 35px;
    pointer-events: none;
    z-index: 1000000;
    opacity: 0;
    transition: opacity 0.2s ease;

    &.visible {
      opacity: 1;
    }

    &.top {
      top: 0;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.95) 0%,
        rgba(255, 255, 255, 0.75) 50%,
        rgba(255, 255, 255, 0) 100%
      );

      :global(.dark) & {
        background: linear-gradient(
          to bottom,
          rgba(17, 27, 43, 0.95) 0%,
          rgba(17, 27, 43, 0.75) 50%,
          rgba(17, 27, 43, 0) 100%
        );
      }
    }

    &.bottom {
      bottom: 0;
      background: linear-gradient(
        to top,
        rgba(255, 255, 255, 0.95) 0%,
        rgba(255, 255, 255, 0.75) 50%,
        rgba(255, 255, 255, 0) 100%
      );

      :global(.dark) & {
        background: linear-gradient(
          to top,
          rgba(17, 27, 43, 0.95) 0%,
          rgba(17, 27, 43, 0.75) 50%,
          rgba(17, 27, 43, 0) 100%
        );
      }
    }
  }

  .scrollable-lists-container .scroll-indicator {
    &.top {
      top: 18px;
    }

    &.bottom {
      bottom: -5px;
    }
  }

  .folders-sidebar::-webkit-scrollbar {
    width: 6px;
    height: 0;
  }

  .folders-sidebar::-webkit-scrollbar-thumb {
    background-color: darkgrey;
    border-radius: 3px;
  }

  .folders-sidebar::-webkit-scrollbar-track {
    background: transparent;
  }

  .built-in-list,
  .pinned-list,
  .connected-list {
    gap: 0.25rem;
    width: 100%;
    /* Allow these lists to shrink to fit content */
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
  }

  .built-in-list {
    position: relative;
  }

  .pinned-list {
    border: 1px dashed transparent;
    position: relative;
    width: 100%;
    height: 100%;
    /*
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    gap: 0.5rem;
    */

    &.empty {
      min-height: 1.5rem;
      margin-top: 0rem !important;
      margin-bottom: -1rem;
    }
  }

  .separator {
    width: 100%;
    padding-left: 0.75rem;
    padding-right: 0.5rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85em;
    font-weight: 400;
    letter-spacing: 0.01em;
    opacity: 1;
    position: sticky;
    top: 0;
    z-index: 10000;
    background: #fff;
    margin-top: -1px;

    @apply text-[#324f86] dark:text-gray-300;

    :global(.dark) & {
      background: rgba(17, 24, 39, 0.95);
    }
  }

  :global(
      body[data-dragging='true']:has(.folder-wrapper[data-drag-preview])
        .all-spaces-hidden
        .folders-wrapper
    ) {
    outline: 1px dashed #3e475d;
    border-radius: 8px;
    height: min-content;
  }

  :global(
      body[data-dragging='true']:has(.folder-wrapper[data-drag-preview])
        [data-drag-zone='overlay-spaces-list-pinned'].empty
    ) {
    border-color: #3e475d;
    border-radius: 8px;
    margin-top: -1px;
  }

  .pinned-list-drag-indicator-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 20%;
  }

  .pinned-list-drag-indicator-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pinned-list-drag-indicator {
    display: flex;
    text-align: center;
    color: #3e475d;
    font-size: 0.875rem;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  :global(
      body[data-dragging='true']:has(.folder-wrapper[data-drag-preview])
        .pinned-list-drag-indicator-wrapper
    ) {
    display: flex;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: transparent;
    background: var(--Black, #fff);
    background: var(--Black, color(display-p3 1 1 1));
  }

  .folder-wrapper {
    min-width: 130px;
    flex: 0 0 auto;
  }

  .action-new-space {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 0.5px solid transparent;
    backdrop-filter: blur(10px);
    gap: 0.75rem;
    opacity: 1;
    background: transparent;
    color: rgb(52, 108, 181);
    transition: all 0.2s ease;
    border-radius: 10%;

    &:hover {
      background: rgb(224 242 254); // bg-sky-100
      color: rgba(0, 103, 185, 1);
    }

    :global(.dark) & {
      background: rgba(17, 24, 39, 0.6);
      border-color: rgba(75, 85, 99, 0.3);
      color: rgba(147, 197, 253, 0.8);
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.1),
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 2px 4px rgba(0, 0, 0, 0.04),
        0 3px 6px rgba(0, 0, 0, 0.02),
        0 4px 8px rgba(0, 0, 0, 0.01);

      &:hover {
        background: rgba(17, 24, 39, 0.8);
        color: rgba(191, 219, 254, 1);
      }
    }

    &.disabled {
      opacity: 0.9;
      pointer-events: none;
      filter: grayscale(100%);
    }
  }

  .connected-list {
    width: 100%;
  }
</style>
