<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { useLogScope } from '@horizon/utils'
  import Folder from './Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { useOasis } from '../../service/oasis'
  import { fly } from 'svelte/transition'

  import { useToasts } from '../../service/toast'
  import { SpaceEntryOrigin, type SpaceData, type SpaceSource, type TabSpace } from '../../types'
  import type { Readable } from 'svelte/store'
  import type { Space } from '@horizon/core/src/lib/types'
  import { useTelemetry } from '../../service/telemetry'
  import { CreateSpaceEventFrom, OpenSpaceEventTrigger } from '@horizon/types'
  import type { ResourceManager } from '../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const dispatch = createEventDispatcher<{
    createTab: { tab: TabSpace; active: boolean }
    'space-selected': { id: string; canGoBack: boolean }
    'create-empty-space': void
    'delete-space': { id: string }
  }>()

  let sidebarElement: HTMLElement
  let foldersWrapper: HTMLElement
  let newSpaceButton: HTMLElement
  const isNewSpaceButtonSticky = writable(false)

  export let spaces: Readable<Space[]>
  export let interactive = true
  export let type: 'grid' | 'horizontal' = 'grid'
  export let resourceManager: ResourceManager
  export let showPreview = true
  const selectedSpace = oasis.selectedSpace

  const renamingFolderId = writable(null)
  const editingFolderId = writable(null)

  export let onBack = () => {}
  $: log.debug('Spaces:', $spaces)

  $: log.debug('xxx-Spaces:', $selectedSpace)

  export const handleCreateSpace = async (
    _e: MouseEvent,
    name: string,
    colors?: [string, string],
    userPrompt?: string
  ) => {
    try {
      const toasty = toast.loading('Creating Space...')

      const newSpace = await oasis.createSpace({
        folderName: name ? name : 'New Space',
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

      toasty.success('Folder created!')

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
        space.name.showInSidebar = true

        await oasis.updateSpaceData(id, {
          showInSidebar: true
        })

        dispatch('createTab', {
          tab: {
            title: space.name.folderName,
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
          isLiveSpace: space.name.liveModeEnabled,
          hasSources: (space.name.sources ?? []).length > 0,
          hasSmartQuery: !!space.name.smartFilterQuery
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
    } catch (error) {
      log.error('Failed to update folder:', error)
    }
  }

  const handleSpaceSelect = async (id: string) => {
    try {
      const space = $spaces.find((space) => space.id === $selectedSpace)

      if (space?.name.folderName === 'New Space') {
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

  const handleEditingStart = (event) => {
    const newEditingId = event.detail.id
    editingFolderId.set(newEditingId)
  }

  const handleEditingEnd = () => {
    editingFolderId.set(null)
  }

  const handleCreateEmptySpace = () => {
    dispatch('create-empty-space')
  }

  const updateNewSpaceButtonPosition = () => {
    if (foldersWrapper && newSpaceButton) {
      const foldersWrapperRect = foldersWrapper.getBoundingClientRect()
      const newSpaceButtonRect = newSpaceButton.getBoundingClientRect()

      if (foldersWrapperRect.bottom + newSpaceButtonRect.height > window.innerHeight - 50) {
        isNewSpaceButtonSticky.set(true)
      } else {
        isNewSpaceButtonSticky.set(false)
      }
    }
  }

  onMount(() => {
    log.debug('Mounted SpacesView')
    const resizeObserver = new ResizeObserver(updateNewSpaceButtonPosition)
    if (foldersWrapper) {
      resizeObserver.observe(foldersWrapper)
    }
    return () => {
      resizeObserver.disconnect()
    }
  })

  const filteredSpaces = derived(spaces, ($spaces) =>
    $spaces.sort((a, b) => {
      if (a.id === 'all') return -1 // Move 'all' folder to the top
      if (b.id === 'all') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // Sort others by creation date
    })
  )
</script>

<div
  class="folders-sidebar p-2 pl-12 w-[18rem] max-w-[18rem]"
  bind:this={sidebarElement}
  on:wheel|passive={handleWheel}
>
  <div class="folders-wrapper" bind:this={foldersWrapper}>
    {#each $filteredSpaces as folder (folder.id)}
      {#key folder.id}
        <div class="folder-wrapper">
          <Folder
            {folder}
            on:select={() => handleSpaceSelect(folder.id)}
            on:space-selected={() => handleSpaceSelect(folder.id)}
            on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
            on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
            on:open-resource
            on:Drop
            on:editing-start={handleEditingStart}
            on:editing-end={handleEditingEnd}
            selected={$selectedSpace === folder.id}
            isEditing={$editingFolderId === folder.id}
            {showPreview}
          />
        </div>
      {/key}
    {/each}
  </div>
  <button
    class="action-new-space"
    class:sticky={$isNewSpaceButtonSticky}
    class:text-white={$isNewSpaceButtonSticky}
    on:click={handleCreateEmptySpace}
    bind:this={newSpaceButton}
  >
    <div class="icon-wrapper">
      <Icon name="add" size="2rem" color={'white'} />
    </div>
    <span class="new-space-text">Create New Space</span>
  </button>
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
    padding: 2rem 0.75rem;
    gap: 0.5rem;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: none;
    scrollbar-color: transparent transparent;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(24px);
    border-bottom: 0.5px solid var(--Grey-2, #f4f4f4);
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
    gap: 0.5rem;
    width: 100%;
  }

  button {
    display: flex;
    align-items: center;
    margin: 0.5rem 0;
    padding: 1rem 0;
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
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    background: transparent;
    box-shadow:
      0 1px 1px rgba(67, 142, 239, 0.05),
      0 1px 2px rgba(67, 142, 239, 0.03),
      0 2px 4px rgba(67, 142, 239, 0.02),
      0 3px 6px rgba(67, 142, 239, 0.01),
      0 4px 8px rgba(67, 142, 239, 0.005);
    border: 0.5px solid rgba(67, 142, 239, 0.15);
    color: rgba(0, 103, 185, 0.7); // Tinted text color for sticky state

    backdrop-filter: blur(10px);
    .new-space-text {
      font-size: 1rem;
      line-height: 1;
      color: rgba(0, 82, 147, 0.9);
    }
    letter-spacing: 0.01em;
    margin: 0;
    padding: 1rem 0.75rem;
    opacity: 1;
    &:hover {
      background: rgba(224, 242, 254, 1);
      color: rgba(0, 103, 185, 1);
    }
    &.sticky {
      position: sticky;
      bottom: 0;
      backdrop-filter: blur(10px);
      box-shadow:
        0 1px 1px rgba(67, 142, 239, 0.05),
        0 1px 2px rgba(67, 142, 239, 0.03),
        0 2px 4px rgba(67, 142, 239, 0.02),
        0 3px 6px rgba(67, 142, 239, 0.01),
        0 4px 8px rgba(67, 142, 239, 0.005);
      border: 0.5px solid rgba(67, 142, 239, 0.15);
      color: rgba(0, 103, 185, 0.7); // Tinted text color for sticky state
    }
    & .icon-wrapper {
      background: rgba(0, 122, 255, 0.9);
      border: 1px solid rgba(67, 142, 239, 0.3);
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
  }

  .action-back-to-tabs {
    .label {
      letter-spacing: 0.04rem;
    }
  }
</style>
