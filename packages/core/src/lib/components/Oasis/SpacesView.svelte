<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { useLogScope } from '@horizon/utils'
  import Folder from './Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { useOasis } from '../../service/oasis'
  import { fly } from 'svelte/transition'

  import { useToasts } from '../../service/toast'
  import type { SpaceData, SpaceSource, TabSpace } from '../../types'
  import type { Writable } from 'svelte/store'
  import type { Space } from '@horizon/core/src/lib/types'
  import { useTelemetry } from '../../service/telemetry'
  import {
    CreateSpaceEventFrom,
    DeleteSpaceEventTrigger,
    OpenSpaceEventTrigger
  } from '@horizon/types'
  import type { ResourceManager } from '../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const dispatch = createEventDispatcher<{
    createTab: { tab: TabSpace; active: boolean }
    'space-selected': { id: string; canGoBack: boolean }
    'open-creation-modal': void
  }>()

  let sidebarElement: HTMLElement

  export let spaces: Writable<Space[]>
  export let interactive = true
  export let type: 'grid' | 'horizontal' = 'grid'
  export let resourceManager: ResourceManager
  export let showPreview = true
  const selectedSpace = oasis.selectedSpace

  export let onBack = () => {}
  $: log.debug('Spaces:', $spaces)

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

      await oasis.addResourcesToSpace(spaceId, resourceIds)

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
      selectedSpace.set(id)
      log.debug('Selected space:', id)
      dispatch('space-selected', { id: id, canGoBack: true })
    } catch (error) {
      log.error('Failed to select folder:', error)
    }
  }

  const handleWheel = (event: WheelEvent) => {
    if (sidebarElement) {
      event.preventDefault()
      sidebarElement.scrollLeft += event.deltaY
    }
  }

  const handleShowCreationModal = () => {
    dispatch('open-creation-modal')
  }

  onMount(() => {
    log.debug('Mounted SpacesView')
  })

  const filteredSpaces = derived(spaces, ($spaces) =>
    $spaces
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((folder) => folder.id !== 'all')
  )
</script>

<div class="folders-sidebar p-2 pl-12" bind:this={sidebarElement} on:wheel|passive={handleWheel}>
  <button class="action-new-space" on:click={handleShowCreationModal}>
    <span class="new-space-text">New Space</span>
  </button>
  <div class="folders-wrapper">
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
            selected={$selectedSpace === folder.id}
            {showPreview}
          />
        </div>
      {/key}
    {/each}
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
    align-items: center;
    padding: 0.6rem 3.5rem 0.6rem 2.75rem;
    gap: 1rem;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    scrollbar-width: none;
    scrollbar-color: transparent transparent;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(24px);
    border-bottom: 0.5px solid var(--Grey-2, #f4f4f4);
    box-shadow:
      0px 2px 1px 0px #000,
      0px 2px 1px 0px rgba(0, 0, 0, 0.01),
      0px 1px 1px 0px rgba(0, 0, 0, 0.05),
      0px 0px 1px 0px rgba(0, 0, 0, 0.09);

    box-shadow:
      0px 2px 1px 0px color(display-p3 0 0 0 / 0),
      0px 2px 1px 0px color(display-p3 0 0 0 / 0.01),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.05),
      0px 0px 1px 0px color(display-p3 0 0 0 / 0.09);
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
    gap: 1rem;
    max-height: 100%;
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
    box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);

    span {
      font-size: 1rem;
      letter-spacing: 0.01em;
    }
  }

  .folder-wrapper {
    min-width: 230px;
    flex: 0 0 auto;
  }

  .action-new-space {
    width: 22rem;
    .new-space-text {
      font-size: 1.1rem;
      line-height: 1.2;
    }
    letter-spacing: 0.01em;
    margin: 0;
    height: 4.65rem;
    padding: 0.75rem 2rem;
    opacity: 0.6;
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    &:hover {
      opacity: 1;
    }
  }

  .action-back-to-tabs {
    .label {
      letter-spacing: 0.04rem;
    }
  }
</style>
