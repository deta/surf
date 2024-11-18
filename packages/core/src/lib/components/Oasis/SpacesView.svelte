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
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { tooltip, useLocalStorageStore, useLogScope } from '@horizon/utils'
  import Folder, { type EditingStartEvent, type FolderEvents } from './Folder.svelte'
  import { Icon, type Icons } from '@horizon/icons'
  import { OasisSpace, useOasis } from '../../service/oasis'

  import { useToasts } from '../../service/toast'
  import {
    DragTypeNames,
    SpaceEntryOrigin,
    type DragTypes,
    type SpaceData,
    type TabSpace
  } from '../../types'
  import type { Readable } from 'svelte/store'
  import { useTelemetry } from '../../service/telemetry'
  import { onboardingSpace } from '../../constants/examples'
  import { CreateSpaceEventFrom, OpenSpaceEventTrigger } from '@horizon/types'
  import type { ResourceManager } from '../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import BuiltInSpace from './BuiltInSpace.svelte'
  import { DragculaDragEvent, HTMLAxisDragZone } from '@horizon/dragcula'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const dispatch = createEventDispatcher<SpacesViewEvents>()

  let sidebarElement: HTMLElement
  let foldersWrapper: HTMLElement

  export let spaces: Readable<OasisSpace[]>
  export let interactive = true
  export let type: 'grid' | 'horizontal' = 'grid'
  export let resourceManager: ResourceManager
  export let showPreview = true
  const selectedSpace = oasis.selectedSpace

  const editingFolderId = writable<string | null>(null)
  const didChangeOrder = writable(false)
  const showAllSpaces = useLocalStorageStore<boolean>('showAllSpacesInOasis', true, true)

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
  const unpinnedSpaces = derived(filteredSpaces, ($spaces) =>
    $spaces.filter((space) => !space.dataValue.pinned)
  )

  const builtInSpaces = [
    {
      id: 'all',
      name: 'All Your Stuff',
      icon: 'leave'
    },
    {
      id: 'inbox',
      name: 'Inbox',
      icon: 'save'
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
        colors: ['#FFBA76', '#FB8E4E'],
        smartFilterQuery: userPrompt ? userPrompt : null,
        liveModeEnabled: !!userPrompt
      })

      log.debug('New Folder:', newSpace)

      selectedSpace.set(newSpace.id)

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

      await telemetry.trackCreateSpace(CreateSpaceEventFrom.OasisSpacesView)

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

      const response = await resourceManager.getResourcesViaPrompt(userPrompt)

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

      selectedSpace.set(id)
      log.debug('Selected space:', id)
      dispatch('space-selected', { id: id, canGoBack: true })
    } catch (error) {
      log.error('Failed to select folder:', error)
    }
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

  const handleTooltipTarget = (folder: OasisSpace) => {
    if (folder.id === 'all') {
      return 'stuff-spaces-all'
    }

    if (folder.dataValue.folderName === onboardingSpace.name) {
      return 'demo-space'
    }

    return undefined
  }

  const handleDrop = async (drag: DragculaDragEvent<DragTypes>) => {
    log.debug('dropping onto sidebar', drag, ' | ', drag.from?.id, ' >> ', drag.to?.id, ' | ')

    if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.item.data.getData(DragTypeNames.SURF_SPACE)
      if (!space || drag.index === null) return

      const target = drag.to?.id

      dispatch('handled-drop')
      drag.continue()

      log.debug('dropped space', space, drag.index, target)
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
</script>

<div
  class="folders-sidebar p-2 pl-12 w-[18rem] max-w-[18rem]"
  data-tooltip-target="stuff-spaces-list"
  bind:this={sidebarElement}
  on:wheel|passive={handleWheel}
>
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

    <div
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
          <div class="pinned-list-drag-indicator">Drop Space here to Pin</div>
        </div>
      {:else}
        {#each $pinnedSpaces as folder, index (folder.id + index)}
          <Folder
            {folder}
            on:select={() => handleSpaceSelect(folder.id)}
            on:space-selected={() => handleSpaceSelect(folder.id)}
            on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
            on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
            on:open-space-and-chat
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
  </div>

  <div class="folders-wrapper">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="folders-header" on:click={toggleShowSpaces}>
      <div class="folders-header-left">
        <Icon name="chevron.down" className={$showAllSpaces ? '' : '-rotate-90'} />
        <div class="folders-header-text">All Your Spaces</div>
      </div>

      <button
        class="action-new-space"
        class:disabled={$selectedSpace &&
          $spaces.find((space) => space.id === $selectedSpace)?.dataValue.folderName ===
            '.tempspace'}
        on:click|stopPropagation={handleCreateEmptySpace}
        data-tooltip-target="create-space"
        data-tooltip-action="action-new-space"
        use:tooltip={{ position: 'left', text: 'Create a new space' }}
      >
        <Icon name="add" size="17px" stroke-width="2" />
      </button>
    </div>

    {#if $showAllSpaces}
      <div
        class="folders-list"
        data-tooltip-target="stuff-spaces-list"
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
            on:select={() => handleSpaceSelect(folder.id)}
            on:space-selected={() => handleSpaceSelect(folder.id)}
            on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
            on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
            on:open-space-and-chat
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
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .top-bar {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    width: fit-content;
  }
  .folders-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 0.75rem 1rem 0.75rem;
    gap: 1.5rem;
    height: 100%;
    flex: 1;
    scrollbar-width: none;
    scrollbar-color: transparent transparent;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(24px);
    border-bottom: 0.5px solid var(--Grey-2, #f4f4f4);
    overflow: hidden;
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

  .folders-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .built-in-list,
  .pinned-list,
  .folders-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .built-in-list {
    position: relative;
  }

  .pinned-list {
    border: 1px dashed transparent;

    &.empty {
      min-height: 1.5rem;
      margin-top: -0.5rem !important;
      margin-bottom: -1rem;
    }
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
    padding-bottom: 2rem;
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
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
    padding: 0.25rem 0.5rem;
    padding-left: 0.2rem;
    margin-left: -0.2rem;

    &:hover {
      background: rgb(224 242 254); // bg-sky-100
      color: rgba(0, 103, 185, 1);
    }
  }

  .folders-header-text {
    color: #3b578a;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.0025em;
    line-height: 1;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    border-radius: 16px;
    background: var(--Black, #fff);
    background: var(--Black, color(display-p3 1 1 1));

    span {
      font-size: 1rem;
      line-height: 1;
      letter-spacing: 0.01em;
    }
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
      border: 0.5px solid rgba(67, 142, 239, 0.15);
    }

    &.disabled {
      opacity: 0.5;
      pointer-events: none;
      filter: grayscale(100%);
    }
  }

  .action-back-to-tabs {
    .label {
      letter-spacing: 0.04rem;
    }
  }
</style>
