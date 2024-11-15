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

  import { tooltip, useLogScope } from '@horizon/utils'
  import Folder, { type EditingStartEvent } from './Folder.svelte'
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

  const filteredSpaces = derived([spaces, didChangeOrder], ([$spaces, didChangeOrder]) =>
    $spaces
      .filter(
        (space) =>
          space.dataValue.folderName !== '.tempspace' && space.id !== 'all' && space.id !== 'inbox'
      )
      .sort((a, b) => {
        // if (a.id === 'all') return -1 // Move 'all' folder to the top
        // if (b.id === 'all') return 1

        // move built in folders to the top behind 'all'
        // if (a.dataValue.builtIn && !b.dataValue.builtIn) return -1

        return a.indexValue - b.indexValue
      })
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
    _e: MouseEvent,
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

      log.debug('dropped space', space, drag.index)
      didChangeOrder.set(false)

      if (drag.index !== null) {
        log.debug('moving space to index', drag.index)

        dispatch('handled-drop')
        drag.continue()

        await oasis.moveSpaceToIndex(space.id, drag.index)
        didChangeOrder.set(true)
      }
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
  </div>

  <div class="folders-wrapper">
    <div class="folders-header">
      <div class="folders-header-text">Your Spaces</div>

      <button
        class="action-new-space"
        class:disabled={$selectedSpace &&
          $spaces.find((space) => space.id === $selectedSpace)?.dataValue.folderName ===
            '.tempspace'}
        on:click={handleCreateEmptySpace}
        data-tooltip-target="create-space"
        data-tooltip-action="action-new-space"
        use:tooltip={{ position: 'left', text: 'Create a new space' }}
      >
        <Icon name="add" size="17px" stroke-width="2" />
      </button>
    </div>

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
      {#each $filteredSpaces as folder, index (folder.id + index)}
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
          selected={$selectedSpace === folder.id}
          isEditing={$editingFolderId === folder.id}
          {showPreview}
        />
      {/each}
    </div>
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
    gap: 1.75rem;
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
  .folders-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
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

    &:hover {
      background: rgba(201, 221, 243, 0.9);
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
