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
  import { Icon, type Icons } from '@horizon/icons'
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
  import type { ResourceManager } from '../../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import BuiltInSpace from '../BuiltInSpace.svelte'
  import { DragculaDragEvent, HTMLAxisDragZone } from '@horizon/dragcula'
  import { generalContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { useContextService } from '@horizon/core/src/lib/service/contexts'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const contextService = useContextService()
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

  export let spaces: Readable<OasisSpace[]>
  export let interactive = true
  export let type: 'grid' | 'horizontal' = 'grid'
  export let resourceManager: ResourceManager
  export let showPreview = true
  const selectedSpace = oasis.selectedSpace

  const editingFolderId = writable<string | null>(null)
  const didChangeOrder = writable(false)
  const showAllSpaces = useLocalStorageStore<boolean>('showAllSpacesInOasis', true, true)

  const userSettings = config.settings
  const sourceSpaces = contextService.useRankedSpaces(10)

  const filteredSpaces = derived([spaces, didChangeOrder], ([$spaces, didChangeOrder]) =>
    $spaces
      .filter(
        (space) =>
          space.dataValue.folderName !== '.tempspace' && space.id !== 'all' && space.id !== 'inbox'
      )
      .sort((a, b) => {
        return a.indexValue - b.indexValue
      })
  )

  const pinnedSpaces = derived(filteredSpaces, ($spaces) =>
    $spaces.filter((space) => space.dataValue.pinned)
  )
  const unpinnedSpaces = derived(
    [filteredSpaces, sourceSpaces, userSettings],
    ([$spaces, $sourceSpaces, $userSettings]) => {
      if ($userSettings.experimental_context_linking) {
        return $spaces.filter(
          (space) =>
            $sourceSpaces.findIndex((s) => s.id === space.id) === -1 && !space.dataValue.pinned
        )
      }

      return $spaces.filter((space) => !space.dataValue.pinned)
    }
  )

  const missingSourceSpaces = derived(
    [sourceSpaces, pinnedSpaces],
    ([$sourceSpaces, $pinnedSpaces]) =>
      $sourceSpaces.filter((space) => $pinnedSpaces.findIndex((s) => s.id === space.id) === -1)
  )

  const builtInSpaces = [
    {
      id: 'all',
      name: 'All Your Stuff',
      icon: 'save'
    },
    {
      id: 'inbox',
      name: generalContext.label,
      icon: generalContext.icon
    }
  ] as { id: string; name: string; icon: Icons }[]

  export let onBack = () => {}
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

      log.debug('New Folder:', newSpace)

      oasis.changeSelectedSpace(newSpace.id)

      await tick()

      if (colors) {
        await oasis.updateSpaceData(newSpace.id, {
          colors: colors
        })
      }

      const inputElement = document.getElementById(
        `folder-input-${newSpace.id}`
      ) as HTMLInputElement
      if (inputElement) {
        inputElement.select()
      }

      return newSpace.id
    } catch (error) {
      log.error('Failed to create folder:', error)
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
      log.debug('Creating folder with AI', userPrompt)

      const response = await ai.getResourcesViaPrompt(userPrompt)

      log.debug(`Automatic Folder Generation request`, response)

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results)

      log.debug('Automatic Folder generated with', results)

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
        : toasty.success('Folder created with AI!')
    } catch (err) {
      log.error('Failed to create folder with AI', err)
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
      log.debug('Adding folder to tabs:', id)
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
      log.error('Failed to delete folder:', error)
    }
  }

  const handleSpaceUpdate = async (id: string, updates: Partial<SpaceData>) => {
    try {
      log.debug('Updating space:', id, updates)
      if (id === 'everything') {
        log.debug('Cannot update the Everything folder')
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
      log.error('Failed to update folder:', error)
    }
  }

  const handleSpaceSelect = async (id: string) => {
    try {
      const space = $spaces.find((space) => space.id === $selectedSpace)

      if (space?.dataValue.folderName === '.tempspace' && id !== $selectedSpace) {
        dispatch('delete-space', { id: $selectedSpace })
        return
      }

      oasis.changeSelectedSpace(id)
      log.debug('Selected space:', id)
      dispatch('space-selected', { id: id, canGoBack: true })
    } catch (error) {
      log.error('Failed to select folder:', error)
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
    editingFolderId.set(newEditingId)
  }

  const handleEditingEnd = () => {
    editingFolderId.set(null)
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

      if (target === 'overlay-unpinned-list-wrapper') {
        didChangeOrder.set(false)
        const newIndex = $pinnedSpaces.length - 1
        await space.updateData({ pinned: false })
        await oasis.moveSpaceToIndex(space.id, newIndex)
        didChangeOrder.set(true)
        return
      }

      let newIndex = drag.index
      if (target === 'overlay-spaces-list-pinned') {
        log.debug('dropped onto pinned list')
        if (!space.dataValue.pinned) {
          await space.updateData({ pinned: true })
        }
      } else if (target === 'overlay-spaces-list') {
        log.debug('dropped onto unpinned list')
        newIndex = newIndex + $pinnedSpaces.length
        if (space.dataValue.pinned) {
          newIndex -= 1
          await space.updateData({ pinned: false })
        }
      }

      didChangeOrder.set(false)
      log.debug('moving space to index', newIndex)

      await oasis.moveSpaceToIndex(space.id, newIndex)
      didChangeOrder.set(true)
    }
  }

  const toggleShowSpaces = () => {
    showAllSpaces.update((show) => !show)
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
      log.error('Failed to pin folder:', error)
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
      log.error('Failed to unpin folder:', error)
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

  // Recalculate overflows when the list changes
  $: recalculateListOverflows($didChangeOrder, $showAllSpaces)

  onMount(() => {
    if ($selectedSpace) {
      const elem = document.getElementById(`folder-${$selectedSpace}`)
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
  class="folders-sidebar p-2 pl-12 w-[18rem] max-w-[18rem] bg-white/95 dark:bg-gray-900/95"
  class:all-spaces-hidden={!$showAllSpaces}
  bind:this={sidebarElement}
  on:wheel|passive={handleWheel}
>
  <!-- Built-in spaces - always visible section -->
  <div class="built-in-section">
    <div class="built-in-list">
      {#each builtInSpaces as builtInSpace (builtInSpace.id)}
        <div class="folder-wrapper">
          <BuiltInSpace
            id={builtInSpace.id}
            name={builtInSpace.name}
            icon={builtInSpace.icon}
            selected={$selectedSpace === builtInSpace.id}
            on:select={() => handleSpaceSelect(builtInSpace.id)}
            on:space-selected={() => handleSpaceSelect(builtInSpace.id)}
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
        {#if $pinnedSpaces.length === 0}
          <div class="pinned-list-drag-indicator-wrapper">
            <div class="pinned-list-drag-indicator">Drop Context here to Pin</div>
          </div>
        {:else}
          <div class="separator">
            Pinned
            <!-- <div class="separator-line"></div> -->
          </div>
          {#each $pinnedSpaces as folder, index (folder.id + index)}
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
              isEditing={$editingFolderId === folder.id}
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

            {#each $missingSourceSpaces as folder, index (folder.id + index)}
              <div class="space-source-item">
                <Folder
                  {folder}
                  {editingFolderId}
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
                  isEditing={$editingFolderId === folder.id}
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

  <!-- All spaces section - always visible header, expandable content -->
  <div
    id="overlay-unpinned-list-wrapper"
    class="folders-wrapper"
    class:expanded={$showAllSpaces}
    class:all-spaces={$showAllSpaces}
    axis="horizontal"
    data-tooltip-target="stuff-spaces-list"
    use:HTMLAxisDragZone.action={{
      accepts: (drag) => {
        if ($showAllSpaces) return false
        if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
          return true
        }
        return false
      }
    }}
    on:Drop={handleDrop}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="folders-header" on:click={toggleShowSpaces}>
      <div class="folders-header-left">
        <Icon
          name="chevron.down"
          className="{$showAllSpaces ? '' : '-rotate-90'} text-[#3b578a] dark:text-gray-300"
          size="16px"
        />
        <div class="folders-header-text">All Your Contexts</div>
      </div>

      <button
        class="action-new-space"
        class:disabled={$selectedSpace &&
          $spaces.find((space) => space.id === $selectedSpace)?.dataValue.folderName ===
            '.tempspace'}
        on:click|stopPropagation={handleCreateEmptySpace}
        data-tooltip-target="create-space"
        data-tooltip-action="action-new-space"
        use:tooltip={{ position: 'left', text: 'Create a new Context' }}
      >
        <Icon name="add" size="17px" stroke-width="2" />
      </button>
    </div>

    {#if $showAllSpaces}
      <div class="unpinned-container">
        <!-- Top shadow indicator for unpinned list -->
        <div class="scroll-indicator top" class:visible={showTopShadowUnpinned}></div>

        <div
          bind:this={unpinnedList}
          on:scroll={() => checkUnpinnedListOverflow()}
          class="folders-list"
          axis="vertical"
          id="overlay-spaces-list"
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
          {#each $unpinnedSpaces as folder, index (folder.id + index)}
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
              isEditing={$editingFolderId === folder.id}
              allowPinning
              {editingFolderId}
              {showPreview}
            />
          {/each}
        </div>

        <!-- Bottom shadow indicator for unpinned list -->
        <div class="scroll-indicator bottom" class:visible={showBottomShadowUnpinned}></div>
      </div>
    {/if}
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
    overflow: hidden;
  }

  .built-in-section {
    width: 100%;
    flex-shrink: 0;
  }

  .scrollable-lists-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    position: relative;

    /* Default state when all spaces is collapsed */
    flex: 1 1 auto;
    min-height: 0;
    max-height: 100%;

    /* When all spaces is expanded, let it take up to 60% but no less than its content requires */
    .folders-sidebar:not(.all-spaces-hidden) & {
      max-height: 40%;
      height: fit-content;
      min-height: auto;
      flex: 0 1 auto;
    }

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

  .unpinned-container {
    position: relative;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1;
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

  .folders-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    position: relative;
    transition: max-height 0.3s ease;
    max-height: 2.5rem; /* Just enough for the header */

    /* When collapsed, position at the bottom */
    margin-top: auto;

    /* When all spaces list is expanded */
    .folders-sidebar:not(.all-spaces-hidden) & {
      flex: 1 1 auto;
    }

    &.expanded {
      max-height: none;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      margin-top: 0; /* Reset margin */

      /* When expanded, take remaining available space, but don't force it */
      flex: 1 1 auto;

      /* When expanded and all-spaces is applied */
      &.all-spaces {
        .unpinned-container {
          height: 100%;

          .folders-list {
            max-height: none;
          }
        }
      }
    }
  }

  .folders-sidebar hr {
    margin-inline: 1rem;
    margin-block: 0.35rem;
    @include utils.light-dark-custom(
      'border-color',
      var(--black-09),
      var(--white-15) var(--black-09),
      var(--white-15)
    );
    border-color: var(--border-color);
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
    gap: 0.1rem;
    width: 100%;
    /* Allow these lists to shrink to fit content */
    flex: 0 0 auto;
  }

  .built-in-list {
    position: relative;
  }

  .pinned-list {
    border: 1px dashed transparent;
    position: relative;
    width: 100%;

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

    .separator-line {
      flex: 1;
      height: 1px;
      opacity: 0.25;

      @apply bg-[#244581] dark:bg-gray-100;
    }

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
    display: none;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .pinned-list-drag-indicator {
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

  .folders-list {
    height: 100%;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    position: relative;
    padding: 0.5rem 0;
    display: flex;
    flex-direction: column;

    /* Hide scrollbar but keep functionality */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    &::-webkit-scrollbar {
      width: 0px;
      background: transparent; /* Chrome/Safari/Opera */
    }
  }

  .folders-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 0.5rem;
    padding-left: 0.75rem;
    padding-right: 0.5rem;
  }

  .folders-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    transition: all 0.2s ease;
    border-radius: 8px;
    padding: 0.25rem 0.5rem;
    padding-left: 0.2rem;
    margin-left: -0.2rem;

    @apply hover:bg-sky-100 hover:text-sky-500 dark:hover:bg-gray-700 dark:hover:text-sky-400;
  }

  .folders-header-text {
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.0025em;
    line-height: 1;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1;

    @apply text-[#3b578a] dark:text-gray-300;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: transparent;
    border: 0;
    border-radius: 8px;

    border-radius: 16px;
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
    border-radius: 50%;
    padding: 0 1px 0.5px 0;
    border: 0.5px solid transparent;
    backdrop-filter: blur(10px);
    margin: 0;
    gap: 0.75rem;
    opacity: 1;
    background: transparent;
    color: rgb(52, 108, 181);
    transition: all 0.2s ease;

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
