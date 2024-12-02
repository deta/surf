<script lang="ts" context="module">
  export type EditingStartEvent = { id: string }
  export type OpenSpaceAsTabEvent = { space: OasisSpace; active: boolean }
  export type SpaceSelectedEvent = { id: string; canGoBack: boolean }
  export type OpenSpaceAndChatEvent = { spaceId: string }
  export type UpdateFolderDataEvent = {
    folderName?: string
    emoji?: string
    smartFilterQuery?: string
    colors?: [string, string]
  }

  export type FolderEvents = {
    'editing-start': { id: string }
    'editing-end': void
    'update-data': UpdateFolderDataEvent
    select: void
    'open-space-as-tab': OpenSpaceAsTabEvent
    'space-selected': SpaceSelectedEvent
    'open-space-and-chat': { spaceId: string }
    'use-as-context': string
    pin: string
    unpin: string
    Drop: { drag: DragculaDragEvent; spaceId: string }
  }
</script>

<script lang="ts">
  import { createEventDispatcher, tick, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Resource, ResourceManager, useResourceManager } from '../../service/resources'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import type { DragTypes } from '../../types'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin
  } from '../../types'
  import { useLogScope, hover, isModKeyPressed, conditionalArrayItem } from '@horizon/utils'
  import { HTMLDragZone, HTMLDragItem, DragculaDragEvent } from '@horizon/dragcula'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { useToasts } from '../../service/toast'
  import {
    DeleteSpaceEventTrigger,
    RefreshSpaceEventTrigger,
    UpdateSpaceSettingsEventTrigger
  } from '@horizon/types'

  import { useTelemetry } from '../../service/telemetry'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { generalContext } from '@horizon/core/src/lib/constants/browsingContext'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  import { onboardingSpace } from '../../constants/examples'

  export let folder: OasisSpace
  export let selected: boolean
  export let showPreview = false
  export let isEditing = false // New prop to control editing state
  export let allowPinning = false

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher<FolderEvents>()
  const oasis = useOasis()
  const toast = useToasts()
  const resourceManager = useResourceManager()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const config = useConfig()
  const userSettings = config.settings

  let folderDetails = folder.data
  let inputWidth = `${$folderDetails.folderName.length}ch`
  let processing = false
  let inputElement: HTMLInputElement
  let previewContainer: HTMLDivElement

  const editMode = writable(false)
  const hovered = writable(false)
  const draggedOver = writable(false)
  const inView = writable(false)
  const previousName = writable($folderDetails.folderName)

  $: {
    if (isEditing) {
      editMode.set(true)
    } else {
      editMode.set(false)
    }
  }

  $: if ($editMode === true) {
    setTimeout(() => {
      inputElement?.focus()
      inputElement?.select()
    }, 100)
  } else {
    setTimeout(() => {
      inputElement?.blur()
    }, 100)
  }

  const getPreviewResources = async (numberOfLatestResourcesToFetch: number) => {
    let result: Resource[] = []

    if (folder.id === 'all') {
      result = await resourceManager.listResourcesByTags([
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
      ])
    } else {
      const contents = await resourceManager.getSpaceContents(folder.id)

      for (const item of contents.slice(0, numberOfLatestResourcesToFetch)) {
        const resource = await resourceManager.getResource(item.resource_id)
        if (resource) result.push(resource)

        await tick() // Yield to the event loop to avoid blocking
      }
    }

    log.debug('Resources:', result)

    return result
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, numberOfLatestResourcesToFetch)
  }

  const handleClick = () => {
    dispatch('select')
  }

  const handleSpaceSelect = async (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest('button')) {
      try {
        log.debug('Selected space:', folder.id)
        if (folder.dataValue.folderName === '.tempspace' && $selectedFolder === '.tempspace') {
          return
        }
        if (isModKeyPressed(event) && folder.id !== 'all') {
          dispatch('open-space-as-tab', { space: folder, active: event.shiftKey })
        } else {
          dispatch('space-selected', { id: folder.id, canGoBack: true })
        }
      } catch (error) {
        log.error('Failed to select folder:', error)
      }
    }
  }

  const handleDoubleClick = () => {
    // if (folder.id !== 'all') {
    //   dispatch('editing-start', { id: folder.id })
    // }
    dispatch('use-as-context', folder.id)
  }

  const handleBlur = async () => {
    if ($folderDetails.folderName.trim() !== '') {
      dispatch('update-data', { folderName: $folderDetails.folderName })
    } else {
      $folderDetails.folderName = $previousName
      dispatch('update-data', { folderName: $previousName })
      previousName.set($folderDetails.folderName)
      await tick()
    }
    dispatch('editing-end')

    resourceManager.telemetry.trackUpdateSpaceSettings(
      {
        setting: 'name',
        change: null
      },
      UpdateSpaceSettingsEventTrigger.SpacePreview
    )
  }

  const addItemToTabs = async () => {
    const space = await oasis.getSpace(folder.id)
    log.debug('Adding space to tabs:', space)
    try {
      if (space) {
        space.dataValue.showInSidebar = true

        await oasis.updateSpaceData(folder.id, {
          showInSidebar: true
        })

        dispatch('open-space-as-tab', { space, active: false })

        await tick()
      }
    } catch (error) {
      log.error('[Folder.svelte] Failed to add folder to sidebar:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const confirmed = confirm(`Are you sure you want to delete ${folder.dataValue.folderName}?`)
      if (!confirmed) {
        return
      }

      log.debug('deleting space', folder.id)
      await oasis.deleteSpace(folder.id)

      await tabsManager.removeSpaceTabs(folder.id)

      await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpacesView)
      toast.success('Context deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  export const createFolderWithAI = async (query: string) => {
    try {
      processing = true

      const userPrompt = JSON.stringify(query)

      log.debug('Creating folder with AI', userPrompt)
      inputElement.blur()

      dispatch('update-data', { smartFilterQuery: query })

      const response = await resourceManager.getResourcesViaPrompt(userPrompt)

      log.debug(`Automatic Folder Generation request`, response)

      const results = response.embedding_search_query
        ? response.embedding_search_results
        : response.sql_query_results
      log.debug('Automatic Folder generated with', results)

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        processing = false
        return
      }

      await oasis.addResourcesToSpace(folder.id, results, SpaceEntryOrigin.LlmQuery)
      selectedFolder.set(folder.id)

      await resourceManager.telemetry.trackRefreshSpaceContent(
        RefreshSpaceEventTrigger.RenameSpaceWithAI,
        {
          usedSmartQuery: true,
          addedResources: results.length > 0
        }
      )

      toast.success('Folder created with AI!')
    } catch (err) {
      log.error('Failed to create folder with AI', err)
    } finally {
      processing = false
    }
  }

  const handleDragStart = (drag: DragculaDragEvent<DragTypes>) => {
    drag.item!.data.setData(DragTypeNames.SURF_SPACE, folder)
    drag.continue()
  }

  let dragoverTimeout: Timer | null = null
  const handleDragEnter = (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)

    dragoverTimeout = setTimeout(() => {
      dispatch('select')
      dragoverTimeout = null
    }, 800)
  }

  const handleDragLeave = (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)
    dispatch('Drop', { drag, spaceId: folder.id })
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    dispatch('update-data', { colors: event.detail })
  }

  const handleOpenAsContext = () => {
    dispatch('use-as-context', folder.id)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    e.stopPropagation()

    const target = e.target as HTMLInputElement
    const value = target.value

    if (e.code === 'Space' && !e.shiftKey) {
      e.preventDefault()
      $folderDetails.folderName = value + ' '
    } else if (e.code === 'Enter') {
      e.preventDefault()
      if (value.trim() !== '') {
        dispatch('editing-end')
      }
    } else if (e.code === 'Enter' && e.shiftKey) {
      e.preventDefault()
      createFolderWithAI(value)
    } else if (e.code === 'Escape') {
      e.preventDefault()
      dispatch('editing-end')
    }
  }

  const getRandomRotation = () => {
    const maxRotation = 1.5
    const minRotation = -1.5
    return `${Math.random() * (maxRotation - minRotation) + minRotation}deg`
  }

  const initializeIntersectionObserver = () => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView.set(true)
            observer.disconnect() // Stop observing once it is in view
          }
        })
      },
      { threshold: 0.1 } // Trigger when 10% of the element is in view
    )

    if (previewContainer) {
      observer.observe(previewContainer)
    }
  }

  onMount(() => {
    initializeIntersectionObserver()
  })

  $: {
    inputWidth = `${$folderDetails.folderName.length + 3}ch`
  }
</script>

<div
  id={`folder-${folder.id}`}
  class="folder-wrapper {processing ? 'magic-in-progress' : ''}"
  data-vaul-no-drag
  data-folder-id={folder.id}
  aria-hidden="true"
  draggable={true}
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        // Cancel if tab dragged is a space itself
        if (drag.item?.data.getData(DragTypeNames.SURF_TAB)?.type === 'space') {
          return false
        }

        return true
      }
      return false
    }
  }}
  on:DragEnter={handleDragEnter}
  on:DragLeave={handleDragLeave}
  on:Drop={handleDrop}
  use:contextMenu={{
    canOpen: folder.id !== 'all',
    items: [
      ...(folder.id !== 'all'
        ? [
            {
              type: 'action',
              icon: generalContext.icon,
              text: 'Open Context',
              action: handleOpenAsContext
            },
            { type: 'action', icon: 'list-add', text: 'Open as New Tab', action: addItemToTabs },
            {
              type: 'action',
              icon: 'chat',
              text: 'Open in Chat',
              action: () => dispatch('open-space-and-chat', { spaceId: folder.id })
            },
            { type: 'separator' },
            ...conditionalArrayItem(allowPinning, {
              type: 'action',
              icon: $folderDetails.pinned ? `pinned-off` : `pin`,
              text: $folderDetails.pinned ? 'Unpin' : 'Pin',
              action: () =>
                $folderDetails.pinned ? dispatch('unpin', folder.id) : dispatch('pin', folder.id)
            }),
            { type: 'action', icon: 'edit', text: 'Rename', action: handleDoubleClick },
            { type: 'action', icon: 'trash', text: 'Delete', kind: 'danger', action: handleDelete }
          ]
        : [])
    ]
  }}
>
  <div
    class="folder {selected
      ? 'bg-sky-100 dark:bg-gray-700'
      : 'hover:bg-sky-50 dark:hover:bg-gray-600'}"
    on:click={$editMode ? null : handleSpaceSelect}
    on:dblclick={handleDoubleClick}
    aria-hidden="true"
    use:hover={hovered}
    bind:this={previewContainer}
  >
    <div
      class="folder-label"
      data-tooltip-target={$folderDetails.folderName === onboardingSpace.name ? 'demo-space' : ''}
    >
      <div class="folder-leading">
        <div class="space-icon-wrapper" on:click|stopPropagation aria-hidden="true">
          <SpaceIcon on:change={handleColorChange} {folder} disablePopoverTransition />
        </div>

        {#if $editMode}
          <input
            bind:this={inputElement}
            id={`folder-input-${folder.id}`}
            style={`width: 100%;`}
            type="text"
            bind:value={$folderDetails.folderName}
            class="folder-input isEditing"
            on:keydown={handleKeyDown}
            on:blur={handleBlur}
          />
        {:else}
          <div
            class="folder-input text-[#244581] dark:text-sky-100/90"
            style={`width: ${inputWidth};`}
            aria-hidden="true"
            on:click|stopPropagation={handleSpaceSelect}
          >
            {$folderDetails.folderName}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .folder-wrapper {
    position: relative;
    pointer-events: auto;
    border: 1px dashed transparent;
    width: 100%;
  }

  :global(.folder-wrapper[data-drag-preview]) {
    width: var(--drag-width, auto) !important;
    height: var(--drag-height, auto) !important;

    background: rgba(255, 255, 255, 1);
    border-radius: 16px;
    opacity: 80%;
    border: 2px solid rgba(10, 12, 24, 0.1) !important;
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
  :global(.folder-wrapper:not([data-drag-preview])[data-drag-target]) {
    border-radius: 16px;
    outline: 1.5px dashed gray;
    outline-offset: -1.5px;
  }

  .folder {
    display: flex;
    flex-direction: column;
    align-items: end;
    justify-content: space-between;
    padding: 0.525rem 0.75rem;
    border-radius: 16px;
    cursor: pointer;

    position: relative;
    color: #244581;
    width: 100%;
    max-height: 12rem;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    z-index: 1000;
    .previews {
      position: relative;
      height: 100%;
      width: 100%;
      overflow: hidden;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      justify-content: center;
      -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
    }

    .folder-preview {
      width: 45%;
      margin: 2%;
      position: relative;
      max-height: 16rem;
      transition: transform 0.3s ease;
    }

    .folder-preview:hover {
      transform: rotate(0deg) scale(1.025) translateY(0.025rem) !important;
    }

    .folder-empty-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;

      .folder-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: rgb(125, 147, 187);
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 0.0025em;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    }

    .folder-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      position: relative;

      .actions {
        position: absolute;
        right: 0;
        display: flex;
        gap: 0.75rem;
        flex-shrink: 0;

        button {
          padding: 0.25rem;
          &:hover {
            border-radius: 4px;
            background: #cee2ff;
          }
        }
      }

      .folder-leading {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        max-width: calc(100% - 1rem);
        overflow: visible;
        padding-left: 0.5rem;
      }

      .space-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        margin: -0.25rem;
        border-radius: 4px;
        max-width: 1.75rem;

        &:hover {
          background: #cee2ff;
        }

        :global(.dark) & {
          &:hover {
            background: #244581;
          }
        }
      }

      .folder-input {
        border: none;
        background: transparent;
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 0.0025em;
        line-height: 1;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        max-width: 100%;
        padding: 0.525rem 0 0.5rem 0;
        outline: none;
        width: fit-content;

        // truncate text
        white-space: nowrap;
        overflow-y: visible;
        overflow-x: hidden;
        text-overflow: ellipsis;

        &::selection {
          background-color: rgba(0, 110, 255, 0.2);
        }

        &.isEditing {
          border-radius: 4px;
          padding: 0 0.25rem;
          margin: 0.4rem 0;
          outline: 4px solid rgba(0, 110, 255, 0.4);

          :global(.dark) & {
            outline: 4px solid rgba(0, 110, 255, 0.4);
            color: #fff;
          }
        }
      }

      .folder-input:focus {
        background-color: transparent;
      }

      .close {
        display: flex;
        align-items: center;
        justify-content: center;
        appearance: none;
        border: none;
        padding: 0;
        margin: 0;
        height: min-content;
        background: none;
        color: #5c77a8;
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: #244581;
        }

        &:disabled {
          color: #7d96c5;
        }
      }
    }
  }

  .folder.active {
    color: #585130;
    z-index: 1000;
    background-color: #blue;
  }

  .draggedOver {
    border-radius: 8px;
    background-color: #a9a9a9 !important;
  }

  .magic-in-progress {
    --magic-field-speed: 4s;
    --magic-field-colors: #30cfd0, #330867, #ff6978, #fffcf9, #330867, #30cfd0, #ff6978, #fffcf9,
      #330867;

    &::after {
      position: absolute;
      content: '';
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: -1;
      height: 100%;
      width: 100%;
      opacity: 1;
      transition: opacity 120ms ease-out;
      transform: scale(0.95) translateZ(0);
      filter: blur(25px);
      z-index: 0;
      background: linear-gradient(
        to top right,
        var(
          --magic-field-colors,
          #ff5770,
          #e4428d,
          #c42da8,
          #9e16c3,
          #6501de,
          #9e16c3,
          #c42da8,
          #e4428d,
          #ff5770
        )
      );
      background-size: 200% 200%;
      animation: animateGlow var(--magic-field-speed) linear infinite;
    }
  }

  @keyframes animateGlow {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
