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
    select: string
    'open-space-as-tab': OpenSpaceAsTabEvent
    'navigate-context': string
    'space-selected': SpaceSelectedEvent
    'open-space-and-chat': { spaceId: string }
    'use-as-context': string
    pin: string
    unpin: string
    Drop: { drag: DragculaDragEvent; spaceId: string }
    'batch-open-as-tabs': void
    'batch-use-as-context': void
    'batch-remove': {
      spaceIds: string[]
      deleteFromStuff: boolean
    }
    'force-reload': void
  }
</script>

<script lang="ts">
  import { createEventDispatcher, tick, onMount, onDestroy } from 'svelte'
  import { writable, get, type Readable } from 'svelte/store'
  import { useResourceManager } from '../../service/resources'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import { selectedItemIds } from './utils/select'
  import type { DragTypes } from '../../types'
  import { DragTypeNames, SpaceEntryOrigin } from '../../types'
  import {
    useLogScope,
    hover,
    isModKeyPressed,
    conditionalArrayItem,
    generateID
  } from '@horizon/utils'
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
  import { useConfig } from '@horizon/core/src/lib/service/config'

  import { onboardingSpace } from '../../constants/examples'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import { openDialog } from '../Core/Dialog/Dialog.svelte'
  import { DynamicIcon, Icon } from '@horizon/icons'
  import ContextLinksSidebar from '@horizon/core/src/lib/components/Oasis/Scaffolding/ContextLinksSidebar.svelte'
  import { useContextService } from '@horizon/core/src/lib/service/contexts'
  import SpacePreviewSimple from './SpacePreviewSimple.svelte'

  // TODO: check if we're passing these in still
  export const showPreview = false
  export const expandable = false
  export const selectedItemsCount: number = 0
  //

  export let folder: OasisSpace
  export let depth: number = 0
  export let selected: boolean
  export let isInSpace: boolean = false
  export let isEditing = false // New prop to control editing state
  export let allowPinning = false
  export let editingSpaceId: Readable<string | null>
  export let displayMode: 'list' | 'card' = 'list'
  export let loadResources: boolean = displayMode === 'card'

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher<FolderEvents>()
  const oasis = useOasis()
  const toast = useToasts()
  const resourceManager = useResourceManager()
  const telemetry = useTelemetry()
  const tabsManager = useTabsManager()
  const ai = useAI()
  const contextService = useContextService()
  const config = useConfig()
  const userSettings = config.settings

  const spaceLinks = contextService.useSpaceLinks(folder.id, 'forward', 1)

  let folderDetails = folder.data
  let inputWidth = `${$folderDetails.folderName.length}ch`
  let processing = false
  let inputElement: HTMLInputElement
  let previewContainer: HTMLDivElement

  const editMode = writable(false)
  const hovered = writable(false)
  const inView = writable(false)
  const previousName = writable($folderDetails.folderName)
  const expanded = writable(false)
  const loadingResources = writable(false)
  //const cardResources = writable<Resource[]>([])

  const uid = generateID()

  $: folderUID = `folder-${folder.id}-${uid}`

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

  const handleClick = () => {
    dispatch('select', folder.id)
  }

  const handleNavigateContext = () => {
    dispatch('navigate-context', folder.id)
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

  const handleStartEdit = () => {
    if (folder.id !== 'all') {
      // Store the current name before editing starts
      previousName.set($folderDetails.folderName)
      // Set edit mode to true
      editMode.set(true)
      dispatch('editing-start', { id: folder.id })
    }
  }

  const handleDoubleClick = () => {
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
    // Explicitly set edit mode to false
    editMode.set(false)
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

  const getAllSpacesForSubmenu = () => {
    const spaces = get(oasis.spaces)
    return spaces
      .filter((space) => space && space.id !== folder.id) // Don't include the current folder
      .filter(
        (space) =>
          space && !space.dataValue.nestingData?.path?.some((item) => item.id === folder.id)
      ) // Don't include child spaces
      .map((space) => ({
        type: 'action' as const,
        text: space.dataValue.folderName,
        action: () => handleCreateLink(space.id, space.dataValue.folderName)
      }))
  }

  const handleCreateLink = async (targetSpaceId: string, targetSpaceName: string) => {
    try {
      const success = await oasis.nestSpaceWithin(folder.id, targetSpaceId)
      if (success) {
        toast.success(`Created a link to '${$folderDetails.folderName}' in '${targetSpaceName}'`)
        dispatch('force-reload')
      } else {
        toast.error('Failed to move space')
      }
    } catch (error) {
      log.error('Error moving space:', error)
      toast.error('Failed to move space')
    }
  }

  const handleRemove = async (event?: MouseEvent, deleteFromStuff = true) => {
    try {
      log.debug('handling folder removal', folder.id, 'deleteFromStuff:', deleteFromStuff)

      if (deleteFromStuff) {
        const { closeType: confirmed } = await openDialog({
          icon: `space;;${folder.id}`,
          message: `Are you sure you want to delete "${folder.dataValue.folderName}"?(Resources inside will not be deleted)`,
          actions: [
            { title: 'Cancel', type: 'reset' },
            { title: 'Delete', type: 'submit', kind: 'danger' }
          ]
        })
        if (!confirmed) {
          return
        }
        // Delete the folder completely
        await oasis.deleteSpace(folder.id)
        await tabsManager.removeSpaceTabs(folder.id)
        await telemetry.trackDeleteSpace(DeleteSpaceEventTrigger.SpacesView)
        toast.success(deleteFromStuff ? 'Context deleted!' : 'Context removed!')
        dispatch('force-reload')
      } else {
        dispatch('batch-remove', {
          spaceIds: [folder.id],
          deleteFromStuff
        })
      }
    } catch (error) {
      log.error('Failed to handle folder removal:', error)
      toast.error(deleteFromStuff ? 'Failed to delete context' : 'Failed to remove context')
    }
  }

  export const createFolderWithAI = async (query: string) => {
    try {
      processing = true

      const userPrompt = JSON.stringify(query)

      log.debug('Creating folder with AI', userPrompt)
      inputElement.blur()

      dispatch('update-data', { smartFilterQuery: query })

      const response = await ai.getResourcesViaPrompt(userPrompt)

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
      dispatch('select', folder.id)
      dragoverTimeout = null
    }, 800)
  }

  const handleDragLeave = (drag: DragculaDragEvent) => {
    if (dragoverTimeout) clearTimeout(dragoverTimeout)
  }

  const handleDrop = async (drag: DragculaDragEvent) => {
    log.debug('handling drop', drag)
    if (dragoverTimeout) clearTimeout(dragoverTimeout)

    // Check if the drag contains a space
    if (drag.item?.data.hasData(DragTypeNames.SURF_SPACE)) {
      const droppedSpace = drag.item.data.getData(DragTypeNames.SURF_SPACE) as OasisSpace

      // Don't allow dropping a space onto itself
      if (droppedSpace.id === folder.id) {
        log.debug('Cannot drop a space onto itself')
        return
      }

      try {
        const droppedFolderName = droppedSpace.dataValue.folderName
        const folderName = folder.dataValue.folderName

        // Move the space into this folder
        await oasis.nestSpaceWithin(droppedSpace.id, folder.id)
        toast.success(`Created a link to '${droppedFolderName}' in '${folderName}'`)

        // Select the folder we just dropped into
        dispatch('select', folder.id)

        // Stop propagation for folder nesting drops
        drag.stopPropagation()
      } catch (error) {
        log.error('Error moving space:', error)
        toast.error('Error moving space')
      }
    } else {
      // Handle other types of drops
      dispatch('Drop', { drag, spaceId: folder.id })
      drag.continue()
    }
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    dispatch('update-data', { colors: event.detail })
  }

  const handleChatWithSpace = () => {
    dispatch('open-space-and-chat', { spaceId: folder.id })
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
        // Explicitly set edit mode to false
        editMode.set(false)
        dispatch('editing-end')
      }
    } else if (e.code === 'Enter' && e.shiftKey) {
      e.preventDefault()
      createFolderWithAI(value)
    } else if (e.code === 'Escape') {
      e.preventDefault()
      // Explicitly set edit mode to false
      editMode.set(false)
      dispatch('editing-end')
    }
  }

  // Function for handling keyboard events in card mode
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !$editMode) {
      handleClick()
    }
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

  const calculateFolderNesting = (excludeSelf = false) => {
    // within this container of nested folders check if we are the deepest one with the same id
    const container = document.getElementById('spaces-view-wrapper')
    if (!container) return { clones: [], deepest: null }

    const clones = container.querySelectorAll(`#folder-${folder.id}`)
    const clonesArray = Array.from(clones).filter((clone) => {
      const cloneId = clone.getAttribute('data-folder-uid')
      if (excludeSelf) {
        return cloneId !== folderUID
      }
      return true
    })

    if (clonesArray.length === 1) {
      return { clones: [], deepest: { id: folderUID, elem: clonesArray[0], cloneDepth: 0 } }
    }

    const mapped = clonesArray.map((clone) => {
      const cloneId = clone.getAttribute('data-folder-uid')
      const cloneDepth = parseInt(clone.getAttribute('data-depth') || '0')
      return { id: cloneId, elem: clone, cloneDepth }
    })

    const deepestClone = mapped.reduce((acc, curr) => {
      if (curr.cloneDepth > acc.cloneDepth) {
        return curr
      }
      return acc
    }, mapped[0])

    return { clones: mapped, deepest: deepestClone }
  }

  const applyFolderNestingStyles = (excludeSelf: boolean) => {
    const { clones, deepest } = calculateFolderNesting()
    const deepestDepth = deepest?.cloneDepth || 0

    const clonesToFade = clones.filter((clone) => clone.id !== deepest?.id)

    // on every clone except the deepest one, add the faded class
    clonesToFade.forEach((clone) => {
      clone.elem.classList.add('faded-nested-folder')

      // Calculate opacity based on depth
      let opacity

      const totalFolders = clonesToFade.length
      const currentDepth = clone.cloneDepth

      if (totalFolders === 1) {
        // 1 folder: 0.5
        opacity = 0.5
      } else if (totalFolders === 2) {
        // 2 folders: 0.25 for depth 0, 0.5 for depth 1
        opacity = currentDepth === 0 ? 0.25 : 0.5
      } else if (totalFolders === 3) {
        // 3 folders: 0.15, 0.25, 0.5
        opacity = currentDepth === 0 ? 0.15 : currentDepth === 1 ? 0.25 : 0.5
      } else if (totalFolders === 4) {
        // 4 folders: 0.1, 0.15, 0.25, 0.5
        opacity =
          currentDepth === 0 ? 0.1 : currentDepth === 1 ? 0.15 : currentDepth === 2 ? 0.25 : 0.5
      } else {
        // 5+ folders: 0.1, 0.15, 0.25, 0.35, 0.5
        if (currentDepth === deepestDepth) opacity = 0.5
        else if (currentDepth === 0) opacity = 0.1
        else {
          const step = (0.5 - 0.1) / (deepestDepth - 0)
          opacity = 0.1 + step * currentDepth
        }
      }

      // If multiple folders have the same depth, use the higher opacity
      if (currentDepth === deepestDepth) {
        opacity = 0.5
      }

      clone.elem.style.setProperty('--faded-opacity', opacity.toString())
    })

    deepest?.elem.classList.remove('faded-nested-folder')
  }

  onMount(async () => {
    if ($userSettings.experimental_context_linking_sidebar) {
      initializeIntersectionObserver()
      applyFolderNestingStyles(false)
    }

    // Load resources if in card mode
    if (displayMode === 'card' && loadResources) {
      loadingResources.set(true)
      try {
        //const resources = await getPreviewResources(4) // Limit to 4 for the grid
        //cardResources.set(resources)
      } catch (error) {
        //log.error('Error loading resources for card view:', error)
        //cardResources.set([])
      } finally {
        loadingResources.set(false)
      }
    }
  })

  onDestroy(() => {
    if ($userSettings.experimental_context_linking_sidebar) {
      applyFolderNestingStyles(true)
    }
  })

  $: {
    inputWidth = `${$folderDetails.folderName.length + 3}ch`
  }
</script>

{#if displayMode === 'list'}
  <div
    id={`folder-${folder.id}`}
    data-folder-uid={folderUID}
    data-depth={depth}
    class="folder-wrapper {processing ? 'magic-in-progress' : ''}"
    class:list={displayMode === 'list'}
    class:selected-folder={selected}
    data-vaul-no-drag
    data-folder-id={folder.id}
    role="none"
    draggable={true}
    use:HTMLDragItem.action={{}}
    on:mouseup={(e) => {
      if (e.button === 1) {
        // Middle mouse button
        e.preventDefault()
        addItemToTabs()
      }
    }}
    on:DragStart={handleDragStart}
    use:HTMLDragZone.action={{
      accepts: (drag) => {
        if (
          drag.isNative ||
          drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
          drag.item?.data.hasData(DragTypeNames.SURF_SPACE) ||
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
      canOpen: true,
      items: [
        { type: 'action', icon: 'list-add', text: 'Open as New Tab', action: addItemToTabs },
        {
          type: 'action',
          icon: 'chat',
          text: 'Ask Context',
          action: () => handleChatWithSpace()
        },
        { type: 'separator' },
        {
          type: 'sub-menu',
          search: true,
          icon: 'link',
          text: 'Link this context in...',
          items: getAllSpacesForSubmenu()
        },
        { type: 'separator' },
        ...conditionalArrayItem(allowPinning, {
          type: 'action',
          icon: $folderDetails.pinned ? `pinned-off` : `pin`,
          text: $folderDetails.pinned ? 'Unpin' : 'Pin',
          action: () =>
            $folderDetails.pinned ? dispatch('unpin', folder.id) : dispatch('pin', folder.id)
        }),
        {
          type: 'action',
          icon: 'trash',
          text: 'Delete from Stuff',
          kind: 'danger',
          action: () => handleRemove(undefined, true)
        }
      ]
    }}
  >
    <div
      class="folder {selected
        ? 'bg-sky-100 dark:bg-gray-700'
        : 'hover:bg-sky-50 dark:hover:bg-gray-600'}"
      data-has-links={$spaceLinks.length > 0 && $userSettings.experimental_context_linking_sidebar}
      on:click={$editMode ? null : handleSpaceSelect}
      on:dblclick={handleDoubleClick}
      role="none"
      use:hover={hovered}
      bind:this={previewContainer}
    >
      <div
        class="folder-label"
        data-tooltip-target={$folderDetails.folderName === onboardingSpace.name ? 'demo-space' : ''}
      >
        <div class="folder-leading">
          <div class="folder-icon">
            <button
              id="expand-btn-{folder.id}"
              on:click={() => ($expanded = !$expanded)}
              class="expand-toggle"
            >
              <Icon name="chevron.right" className={$expanded ? 'rotate-90' : ''} size="17px" />
            </button>

            <div class="space-icon-wrapper" on:click|stopPropagation role="none">
              <!-- <SpaceIcon on:change={handleColorChange} {folder} disablePopoverTransition /> -->
              <DynamicIcon name={folder.getIconString()} size="14px" />
            </div>
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
              role="none"
              on:click|stopPropagation={handleSpaceSelect}
            >
              {$folderDetails.folderName}
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if $expanded && $userSettings.experimental_context_linking_sidebar}
      <ContextLinksSidebar
        space={folder}
        {editingSpaceId}
        depth={depth + 1}
        on:select
        on:space-selected
        on:open-space-as-tab
        on:update-data
        on:use-as-context
        on:open-space-and-chat
        on:Drop
        on:editing-start
        on:editing-end
        on:pin
        on:unpin
        on:navigate-context
        on:batch-open-as-tabs
        on:batch-use-as-context
      />
    {/if}
  </div>
{:else}
  <!-- Card View Mode -->
  <div
    class="context-card"
    class:selected
    draggable={true}
    on:click={handleNavigateContext}
    on:keydown={handleKeydown}
    tabindex="0"
    role="button"
    aria-label="Open {$folderDetails.folderName} context"
    data-selectable={true}
    data-selectable-id={folder.id}
    data-selectable-type="space"
    data-folder-id={folder.id}
    on:select
    on:space-selected
    on:open-space-as-tab
    on:update-data
    on:use-as-context
    on:open-space-and-chat
    on:Drop
    on:editing-start
    on:editing-end
    on:pin
    on:unpin
    on:batch-open-as-tabs
    on:batch-use-as-context
    use:HTMLDragItem.action={{}}
    on:DragStart={handleDragStart}
    use:HTMLDragZone.action={{
      accepts: (drag) => {
        if (
          drag.isNative ||
          drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
          drag.item?.data.hasData(DragTypeNames.SURF_SPACE) ||
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
    on:mouseup={(e) => {
      if (e.button === 1) {
        // Middle mouse button
        e.preventDefault()
        addItemToTabs()
      }
    }}
    use:contextMenu={{
      canOpen: folder.id !== 'all' && $selectedItemIds.length === 0,
      items: [
        {
          type: 'action',
          icon: 'list-add',
          text: 'Open as New Tab',
          action: addItemToTabs
        },
        {
          type: 'action',
          icon: 'chat',
          text: 'Ask Context',
          action: () => handleChatWithSpace()
        },
        { type: 'separator' },
        {
          type: 'sub-menu',
          icon: 'link',
          search: true,
          text: 'Link this context in...',
          items: getAllSpacesForSubmenu()
        },
        { type: 'separator' },
        ...conditionalArrayItem(allowPinning, {
          type: 'action',
          icon: $folderDetails.pinned ? `pinned-off` : `pin`,
          text: $folderDetails.pinned ? 'Unpin' : 'Pin',
          action: () =>
            $folderDetails.pinned ? dispatch('unpin', folder.id) : dispatch('pin', folder.id)
        }),
        { type: 'action', icon: 'edit', text: 'Rename', action: handleStartEdit },
        ...(isInSpace
          ? [
              {
                type: 'sub-menu',
                icon: 'trash',
                text: 'Delete',
                kind: 'danger',
                items: [
                  {
                    type: 'action',
                    icon: 'close',
                    text: 'Delete Link',
                    kind: 'danger',
                    action: () => {
                      handleRemove(undefined, false)
                    }
                  },
                  {
                    type: 'action',
                    icon: 'trash',
                    text: 'Delete Context',
                    kind: 'danger',
                    action: () => {
                      handleRemove(undefined, true)
                    }
                  }
                ]
              }
            ]
          : [
              {
                type: 'action',
                icon: 'trash',
                text: 'Delete from Stuff',
                kind: 'danger',
                action: () => {
                  handleRemove(undefined, true)
                }
              }
            ])
      ]
    }}
  >
    <!-- Resources preview section -->
    <div class="context-resources">
      {#if $loadingResources}
        <div class="loading-resources">
          <Icon name="spinner" size="24px" />
          <span>Loading...</span>
        </div>
      {:else}
        <SpacePreviewSimple icon={folder.getIconString()} isLink={isInSpace} />
      {/if}
      <!--
      {:else if $cardResources && $cardResources.length > 0}
        <div class="resources-grid">
          <SpacePreviewSimple icon={folder.getIconString()} />
        </div>
      {:else}
        <div class="empty-resources">
          <SpacePreviewSimple icon={folder.getIconString()} />
        </div>
      {/if}
      -->
    </div>
    <div class="context-footer">
      <div class="context-title-row">
        <!-- Icon next to the title -->
        <div class="icon-wrapper">
          <SpaceIcon {folder} disablePopoverTransition on:change={handleColorChange} />
        </div>

        {#if $editMode}
          <input
            bind:this={inputElement}
            type="text"
            bind:value={$folderDetails.folderName}
            class="context-name-input isEditing"
            on:keydown={handleKeyDown}
            on:blur={handleBlur}
          />
        {:else}
          <h3 class="context-name">{$folderDetails.folderName}</h3>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .folder-wrapper {
    position: relative;
    pointer-events: auto;
    border: 1px dashed transparent;
    width: 100%;
  }

  :global([data-density='compact'] .masonry-grid .context-card),
  :global([data-density='compact'] .masonry-grid .card-container) {
    min-height: 175px;
  }

  :global([data-density='cozy'] .masonry-grid .context-card),
  :global([data-density='cozy'] .masonry-grid .card-container) {
    min-height: 250px;
  }

  :global([data-density='comfortable'] .masonry-grid .context-card),
  :global([data-density='comfortable'] .masonry-grid .card-container) {
    min-height: 420px;
  }

  :global([data-density='spacious'] .masonry-grid .context-card),
  :global([data-density='spacious'] .masonry-grid .card-container) {
    min-height: 420px;
  }

  :global(.folder-wrapper[data-drag-preview]),
  :global(.context-card[data-drag-preview]) {
    width: var(--drag-width, auto) !important;
    height: var(--drag-height, auto) !important;
  }
  :global(.folder-wrapper:not([data-drag-preview])[data-drag-target]),
  :global(.context-card:not([data-drag-preview])[data-drag-target]) {
    border-radius: 16px;
    outline: 1.5px dashed gray;
    outline-offset: -1.5px;
  }

  :global(.faded-nested-folder.selected-folder .folder) {
    background: rgb(224 242 254 / var(--faded-opacity)) !important;
  }

  .folder {
    display: flex;
    flex-direction: column;
    align-items: end;
    justify-content: space-between;
    padding: 0.3rem 0.5rem;
    border-radius: 12px;

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

    &[data-has-links='true']:hover {
      .space-icon-wrapper {
        display: none !important;
        opacity: 0 !important;
      }

      .expand-toggle {
        display: flex !important;
        opacity: 1 !important;
      }
    }

    .folder-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      position: relative;

      .folder-leading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        max-width: calc(100% - 1rem);
        overflow: visible;
        padding-left: 0.5rem;
      }

      .space-icon-wrapper {
        display: flex;
        opacity: 1;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        margin: -0.25rem;
        border-radius: 4px;
        max-width: 1.75rem;

        transition: all 0.2s ease-in-out;

        &:hover {
          background: #cee2ff;
        }

        :global(.dark) & {
          &:hover {
            background: #244581;
          }
        }
      }

      .expand-toggle {
        display: none;
        opacity: 0;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        border-radius: 4px;
        padding: 0.25rem;
        margin: -0.25rem;
        max-width: 1.75rem;

        transition: all 0.2s ease-in-out;

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
        font-size: 1em;
        font-weight: 450;
        letter-spacing: 0.01em;
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
    }
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

  /* Card View Mode Styles */
  .context-card {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    max-height: 700px;
    height: 100%;
    transition: all 0.2s ease-in-out;
    cursor: pointer;
    position: relative;

    &.selected,
    &:global(.selected) {
      outline: 3px solid rgba(10, 143, 255, 0.4) !important;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    &:focus {
      outline: 2px solid rgba(59, 130, 246, 0.5);
    }
    .context-footer {
      background: rgba(245, 250, 255, 0.5);
      padding: 0 1.5rem 0;
      .context-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
        .icon-wrapper {
          width: 24px;
          height: 24px;
          min-width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
      .context-name {
        font-size: 0.95rem;
        font-weight: 500;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .context-name-input {
        border: none;
        background: transparent;
        font-size: 0.95rem;
        font-weight: 500;
        width: 100%;
        padding: 0.25rem;
        outline: none;

        &.isEditing {
          border-radius: 4px;
          outline: 4px solid rgba(0, 110, 255, 0.4);

          :global(.dark) & {
            outline: 4px solid rgba(0, 110, 255, 0.4);
            color: #fff;
          }
        }

        &:focus {
          background-color: transparent;
        }

        &::selection {
          background-color: rgba(0, 110, 255, 0.2);
        }
      }
    }
    .context-resources {
      flex: 1;
      overflow: hidden;
      background: rgba(245, 250, 255, 0.5);
      display: flex;
      flex-direction: column;

      .loading-resources {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        opacity: 0.6;
        font-size: 0.85rem;
      }

      .loading-resources {
        :global(svg) {
          animation: spin 1s linear infinite;
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    }
  }
  :global(.dark) {
    .context-card {
      background: rgba(31, 41, 55, 0.8);
      border-color: rgba(250, 250, 250, 0.075);
      box-shadow:
        0 0 0 1px rgba(205, 205, 161, 0.06),
        0 2px 5px 0 rgba(205, 205, 161, 0.04),
        0 1px 1.5px 0 rgba(255, 255, 255, 0.01);
      &:hover {
        outline: 2px solid rgba(250, 250, 250, 0.2);
      }
      &.selected,
      &:global(.selected) {
        outline: 3px solid rgba(10, 143, 255, 0.4) !important;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      .context-footer {
        background: rgba(15, 23, 42, 0.3);
        color: #e2e8f0;

        .context-name {
          color: #f1f5f9;
        }

        .context-name-input {
          color: #f1f5f9;

          &::placeholder {
            color: rgba(241, 245, 249, 0.6);
          }
        }
      }

      .context-resources {
        background: rgba(15, 23, 42, 0.3);
      }
    }
  }
</style>
