<script lang="ts">
  import { createEventDispatcher, tick, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { Resource, ResourceManager, useResourceManager } from '../../service/resources'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import type { Space, SpaceData } from '../../types'
  import { ResourceTagsBuiltInKeys, ResourceTypes, SpaceEntryOrigin } from '../../types'
  import { useLogScope, hover, tooltip, isModKeyPressed } from '@horizon/utils'
  import { HTMLDragZone, HTMLDragItem, DragculaDragEvent } from '@horizon/dragcula'
  import { useOasis } from '../../service/oasis'
  import { processDrop } from '../../service/mediaImporter'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { useToasts } from '../../service/toast'
  import { fade, fly } from 'svelte/transition'
  import {
    DeleteSpaceEventTrigger,
    RefreshSpaceEventTrigger,
    UpdateSpaceSettingsEventTrigger
  } from '@horizon/types'

  import type { TabSpace } from '../../types/browser.types'
  import { useTelemetry } from '../../service/telemetry'

  export let folder: Space
  export let selected: boolean
  export let showPreview = false
  export let isEditing = false // New prop to control editing state

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher()
  const oasis = useOasis()
  const toast = useToasts()
  const resourceManager = useResourceManager()
  const telemetry = useTelemetry()

  const editMode = writable(false)
  const hovered = writable(false)
  const draggedOver = writable(false)
  const inView = writable(false)

  let folderDetails = folder.name
  let inputWidth = `${folderDetails.folderName.length}ch`
  let processing = false
  let inputElement: HTMLInputElement
  let previewContainer: HTMLDivElement

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
        if (folder.name.folderName === 'New Space' && $selectedFolder === 'New Space') {
          return
        }
        if (isModKeyPressed(event)) {
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
    dispatch('editing-start', { id: folder.id })
  }

  const handleBlur = () => {
    dispatch('update-data', { folderName: folderDetails.folderName })
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
        space.name.showInSidebar = true

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
      const confirmed = confirm(`Are you sure you want to delete ${folder.name.folderName}?`)
      if (!confirmed) {
        return
      }

      log.debug('deleting space', folder.id)
      await oasis.deleteSpace(folder.id)

      await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpacesView)
      toast.success('Space deleted!')
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

  const handleDrop = async (drag: DragculaDragEvent) => {
    dispatch('Drop', { drag, spaceId: folder.id })
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    dispatch('update-data', { colors: event.detail })
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    draggedOver.set(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    draggedOver.set(false)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    e.stopPropagation()

    const target = e.target as HTMLInputElement
    const value = target.value

    if (e.code === 'Space' && !e.shiftKey) {
      e.preventDefault()
      folderDetails.folderName = value + ' '
    } else if (e.code === 'Enter') {
      e.preventDefault()
      dispatch('editing-end')
    } else if (e.code === 'Enter' && e.shiftKey) {
      e.preventDefault()
      createFolderWithAI(value)
    } else if (e.code === 'Escape') {
      e.preventDefault()
      dispatch('editing-end')
    }
  }

  const openResource = (id: string) => {
    log.debug('Resource clicked', id)

    dispatch('open-resource', id)
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
    inputWidth = `${folderDetails.folderName.length + 3}ch`
  }
</script>

<div
  class="folder-wrapper {processing ? 'magic-in-progress' : ''} {$draggedOver ? 'draggedOver' : ''}"
  on:dragover={handleDragOver}
  id={folder.id}
  data-folder-id={folder.id}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  aria-hidden="true"
  use:HTMLDragZone.action={{}}
  on:DragEnter={(drag) => {
    const dragData = drag.data
    if (
      drag.isNative ||
      (dragData['surf/tab'] !== undefined && dragData['surf/tab'].type !== 'space') ||
      dragData['oasis/resource'] !== undefined
    ) {
      drag.continue()
      return
    }
    drag.abort()
  }}
  on:Drop={handleDrop}
>
  <div
    class="folder {selected ? 'bg-sky-100' : 'hover:bg-sky-50'}"
    on:click={$editMode ? null : handleSpaceSelect}
    on:dblclick={handleDoubleClick}
    aria-hidden="true"
    use:hover={hovered}
    bind:this={previewContainer}
  >
    <!-- {#if $inView && showPreview}
      <div class="previews" transition:fly={{ y: 15 }}>
        {#await getPreviewResources(4)}
          <div class="folder-empty-wrapper">
            <div class="folder-empty">
              <Icon name="spinner" />
            </div>
          </div>
        {:then resources}
          {#if resources.length > 0}
            {#each resources as resource}
              <div class="folder-preview" style="transform: rotate({getRandomRotation()});">
                <ResourcePreviewClean
                  {resource}
                  showTitles={false}
                  interactive={false}
                  on:click={() => openResource(resource.id)}
                />
              </div>
            {/each}
          {:else}
            <div class="folder-empty-wrapper">
              <div class="folder-empty">
                <Icon name="leave" />
              </div>
            </div>
          {/if}
        {/await}
      </div>
    {/if} -->

    <div class="folder-label">
      <div class="folder-leading">
        <div class="space-icon-wrapper" on:click|stopPropagation aria-hidden="true">
          <SpaceIcon on:change={handleColorChange} {folder} />
        </div>

        {#if $editMode}
          <input
            bind:this={inputElement}
            id={`folder-input-${folder.id}`}
            style={`width: ${inputWidth};`}
            type="text"
            bind:value={folderDetails.folderName}
            class="folder-input isEditing"
            on:keydown={handleKeyDown}
            on:blur={handleBlur}
          />
        {:else}
          <div
            class="folder-input"
            style={`width: ${inputWidth};`}
            aria-hidden="true"
            on:click|stopPropagation={handleSpaceSelect}
          >
            {folderDetails.folderName}
          </div>
        {/if}
      </div>

      {#if !$editMode}
        {#if $hovered}
          <button
            on:click|stopPropagation={addItemToTabs}
            class="close"
            use:tooltip={{ text: 'Open as Tab', position: 'left' }}
          >
            <Icon name={'list-add'} size="18px" />
          </button>
          <button
            on:click|stopPropagation={handleDoubleClick}
            class="close"
            use:tooltip={{ text: 'Edit', position: 'left' }}
          >
            <Icon name="edit" size="18px" />
          </button>
        {/if}
      {:else}
        <div class="actions" in:fade={{ duration: 50 }} out:fade={{ duration: 100 }}>
          <button
            on:click|stopPropagation={handleDelete}
            class="close"
            use:tooltip={{ text: 'Delete Space', position: 'left' }}
          >
            <Icon name="trash" size="16px" />
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .folder-wrapper {
    position: relative;
    pointer-events: auto;
    width: 100%;
  }

  .folder {
    display: flex;
    flex-direction: column;
    align-items: end;
    justify-content: space-between;
    padding: 0.5rem;
    border-radius: 12px;
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
        gap: 0.5rem;
        flex: 1;
        max-width: calc(100% - 4.5rem);
        overflow: visible;
      }

      .space-icon-wrapper {
        padding: 0.25rem;
        border-radius: 4px;
        &:hover {
          background: #cee2ff;
        }
      }

      .folder-input {
        font-family: 'Inter', sans-serif;
        border: none;
        background: transparent;
        color: #244581;
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
