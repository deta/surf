<script lang="ts">
  import { type Writable, derived, writable, get, type Readable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import {
    useLogScope,
    useDebounce,
    useLocalStorageStore,
    tooltip,
    isMac,
    conditionalArrayItem
  } from '@horizon/utils'
  import { DEFAULT_SPACE_ID, OasisSpace, useOasis } from '../../service/oasis'
  import { useToasts, type ToastItem } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import type { OverlayEvents } from '../Overlay/types'
  import { Icon } from '@horizon/icons'
  import { DragOperation, Dragcula, DragculaDragEvent, HTMLDragArea } from '@horizon/dragcula'
  import {
    Resource,
    ResourceManager,
    ResourceTag,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin,
    type DragTypes
  } from '../../types'
  import type { HistoryEntriesManager } from '../../service/history'
  import {
    type ContextViewDensity,
    type ContextViewType,
    MultiSelectResourceEventAction,
    OpenInMiniBrowserEventFrom,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  import DropWrapper from '../Oasis/DropWrapper.svelte'
  import OasisSpaceRenderer from '../Oasis/OasisSpace.svelte'
  import SpacesView from '../Oasis/Scaffolding/SpacesView.svelte'
  import Onboarding from './Onboarding.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import stuffAdd from '../../../../public/assets/demo/stuffsave.gif'
  import stuffSmart from '../../../../public/assets/demo/stuffsmart.gif'
  import stuffSearch from '../../../../public/assets/demo/stuffsearch.gif'
  import { portal } from '../Core/Portal.svelte'
  import Tooltip from '../Onboarding/Tooltip.svelte'
  import { getBackgroundImageUrlFromId } from '../../service/colors'
  import Select from '../Atoms/Select.svelte'
  import {
    createResourcesFromMediaItems,
    processDrop,
    processPaste
  } from '../../service/mediaImporter'
  import { springAppear } from '../motion/springAppear'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import OasisResourcesView from '../Oasis/ResourceViews/OasisResourcesView.svelte'
  import ResourceDetails from '@horizon/core/src/lib/components/Oasis/Scaffolding/ResourceDetails.svelte'
  import { removeSelectionById } from '@horizon/core/src/lib/components/Oasis/utils/select'
  import StuffRightSidebar from '@horizon/core/src/lib/components/Oasis/Scaffolding/StuffRightSidebar.svelte'

  import LazyScroll, { type LazyItem } from '../Utils/LazyScroll.svelte'
  import type { FilterChangeEvent, ViewChangeEvent } from '../Oasis/SpaceFilterViewButtons.svelte'
  import ContextHeader from '../Oasis/ContextHeader.svelte'
  import ContextTabsBar from '../Oasis/ContextTabsBar.svelte'
  import OasisSpaceNavbar from '../Oasis/OasisSpaceNavbar.svelte'
  import SpaceFilterViewButtons from '../Oasis/SpaceFilterViewButtons.svelte'
  import {
    everythingContext,
    inboxContext,
    notesContext
  } from '@horizon/core/src/lib/constants/browsingContext'

  export let showTabSearch: Writable<number>
  export let spaceId: string
  export let historyEntriesManager: HistoryEntriesManager
  export let updateSearchValue: Writable<string>

  const SEARCH_RESET_TIMEOUT = 8000

  const log = useLogScope('NewTabOverlay')
  const dispatch = createEventDispatcher<OverlayEvents>()
  const config = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const tabsManager = useTabsManager()
  const miniBrowserService = useMiniBrowserService()
  const scopedMiniBrowser = miniBrowserService.createScopedBrowser(`new-tab-overlay`)

  const resourceManager = oasis.resourceManager
  const telemetry = resourceManager.telemetry
  const spaces = oasis.spaces
  const selectedSpaceId = oasis.selectedSpace
  const everythingContentsResources = oasis.everythingContents
  const userConfigSettings = config.settings
  const selectedFilterTypeId = oasis.selectedFilterTypeId
  const detailedResource = oasis.detailedResource
  const activeScopeId = tabsManager.activeScopeId

  const searchValue = writable('')
  const searchResults = writable<ResourceSearchResultItem[]>([])
  const isSearching = writable(false)
  const hasSearched = writable(false)
  const selectedItem = writable<string | null>(null)
  const onboardingOpen = writable($userConfigSettings.onboarding.completed_stuff === false)
  const loadingContents = writable(false)
  const isCreatingNewSpace = writable(false)
  const selectedFilter = useLocalStorageStore<'all' | 'saved_by_user'>(
    'oasis-filter-resources',
    'all'
  )

  const isResizing = writable(false)
  const resizingDirection = writable<
    undefined | 'horizontal' | 'vertical' | 'diag-left' | 'diag-right'
  >(undefined)
  const stuffWidthPercentage = useLocalStorageStore<number>('stuff_width_percentage', 90)
  const stuffWidthOffset = writable(0)
  const stuffHeightPercentage = useLocalStorageStore<number>('stuff_height_percentage', 90)
  const stuffHeightOffset = writable(0)
  let _stuffWidthOffset = 0
  let _stuffHeightOffset = 0
  let resizeRaf: null | number = null

  let stuffWrapperRef: HTMLElement
  let createSpaceRef: SpacesView
  let hasLoadedEverything = false
  let oasisSpace: OasisSpaceRenderer

  let searchTimeout: NodeJS.Timeout | null = null
  let searchResetTimeout: NodeJS.Timeout | null = null
  let previousSearchValue = ''
  let showDragHint = writable(false)
  let drawerHide = writable(false) // Whether to slide the drawer away

  $: isEverythingSpace = $selectedSpaceId === 'all'
  $: isInboxSpace = $selectedSpaceId === 'inbox'
  $: isNotesSpace = $selectedSpaceId === 'notes'
  $: darkMode = $userConfigSettings.app_style === 'dark'

  $: if (updateSearchValue) {
    searchValue.set($updateSearchValue)
  }

  $: if ($showTabSearch === 2) {
    loadEverything(true)
    $drawerHide = false
  }

  $: if ($showTabSearch === 2 && $searchValue !== previousSearchValue) {
    isSearching.set(true)
    previousSearchValue = $searchValue

    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    searchTimeout = setTimeout(async () => {
      await debouncedSearch($searchValue)
    }, 300)
  }

  $: if ($showTabSearch !== 2) {
    closeResourceDetailsModal()
  }

  $: if (['all', 'inbox', 'notes'].includes($selectedSpaceId)) {
    loadEverything()
  }

  const everythingContents = derived(
    [everythingContentsResources],
    ([everythingContentsResources]) => {
      return everythingContentsResources
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(
          (resource) =>
            ({
              id: resource.id,
              resource: resource,
              annotations: resource.annotations,
              engine: 'local'
            }) as ResourceSearchResultItem
        )
    }
  )

  const resourcesToShow = derived(
    [searchValue, searchResults, everythingContents],
    ([searchValue, searchResults, everythingContents]) => {
      if (searchValue && $showTabSearch === 2) {
        return searchResults
      }
      return everythingContents
    }
  )

  const renderContents = derived<[Readable<ResourceSearchResultItem[]>], LazyItem[]>(
    [resourcesToShow],
    ([resourcesToShow]) => {
      return (resourcesToShow ?? []).map((item) => {
        return { id: item.id, data: null }
      })
    }
  )

  const isBuiltInSpace = derived([selectedSpaceId], ([$selectedSpaceId]) => {
    return ['all', 'inbox', 'notes'].includes($selectedSpaceId)
  })

  const builtInSpacesViewSettings = useLocalStorageStore<{
    all?: {
      viewType?: ContextViewType
      viewDensity?: ContextViewDensity
    }
    inbox?: {
      viewType?: ContextViewType
      viewDensity?: ContextViewDensity
    }
    notes?: {
      viewType?: ContextViewType
      viewDensity?: ContextViewDensity
    }
  }>(
    'stuff_built_in_spaces_view_settings',
    {
      all: {},
      inbox: {},
      notes: {}
    },
    true
  )

  const loadEverything = async (initialLoad = false) => {
    await tick()
    await oasis.loadEverything(initialLoad)
  }

  const handleResourceRemove = async (
    e: CustomEvent<{ ids: string; deleteFromStuff: boolean }>
  ) => {
    const ids = e.detail.ids
    try {
      const resourceIds = Array.isArray(ids) ? ids : [ids]
      log.debug('removing resources', resourceIds)

      if (resourceIds.length === 0) {
        toasts.error('No resources found to remove.')
        return
      }

      const isInSpace =
        $selectedSpaceId !== 'all' && $selectedSpaceId !== 'inbox' && $selectedSpaceId != 'notes'
      const res = await oasis.removeResourcesFromSpaceOrOasis(
        resourceIds,
        isInSpace ? $selectedSpaceId : undefined
      )
      if (!res) {
        return
      }

      if (resourceIds.length > 1) {
        await telemetry.trackMultiSelectResourceAction(
          MultiSelectResourceEventAction.Delete,
          resourceIds.length,
          isEverythingSpace || isInboxSpace || isNotesSpace ? 'oasis' : 'space'
        )
      }

      if ($detailedResource && resourceIds.includes($detailedResource.id)) {
        detailedResource.set(null)
      }

      if ($searchValue) {
        await debouncedSearch($searchValue)
      }

      toasts.success('Resources deleted!')
    } catch (error) {
      log.error('Error removing resources:', error)
      if (error instanceof Error) {
        toasts.error('Error removing resources: ' + error.message)
      } else if (typeof error === 'string') {
        toasts.error('Error removing resources: ' + error)
      } else {
        toasts.error('Error removing resources')
      }
    }
  }

  const handleSavedResourceInSpace = (e: CustomEvent<string>) => {
    const spaceId = e.detail
    log.debug('Saved resource in space:', spaceId)
    if (spaceId !== 'inbox' && spaceId !== 'all') {
      loadEverything()
    }
  }

  const handleUseResourceAsSpaceIcon = async (e: CustomEvent<string>) => {
    const resourceId = e.detail
    const space = $spaces.find((x) => x.id === $selectedSpaceId)
    if (!space) {
      log.error('Space not found:', $selectedSpaceId)
      return
    }
    await space.useResourceAsIcon(resourceId)
    toasts.success('Context icon updated!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  let handledDrop = false

  const handleDropOnSpace = async (spaceId: string, drag: DragculaDragEvent<DragTypes>) => {
    //const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    const toast = toasts.loading(`Adding to context...`)

    try {
      if (drag.isNative) {
        handledDrop = true
        const parsed = await processDrop(drag.event!)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '', [
          ResourceTag.dragLocal()
        ])
        log.debug('Resources', newResources)

        if (!isEverythingSpace && !isInboxSpace && !isNotesSpace) {
          await oasis.addResourcesToSpace(
            spaceId,
            newResources.map((r) => r.id),
            SpaceEntryOrigin.ManuallyAdded
          )
        }

        for (const r of newResources) {
          telemetry.trackSaveToOasis(
            r.type,
            SaveToOasisEventTrigger.Drop,
            !isEverythingSpace && !isInboxSpace && !isNotesSpace
          )
        }
      } else if (
        drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        let resource: Resource | null = null
        if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
          resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
        } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
          const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
          resource = await resourceFetcher()
        }

        if (resource === null) {
          log.warn('Dropped resource but resource is null! Aborting drop!')
          drag.abort()
          return
        }

        await oasis.addResourcesToSpace(spaceId, [resource.id], SpaceEntryOrigin.ManuallyAdded)

        // FIX: Not exposed outside OasisSpace component.. cannot reload directlry :'( !?
        //await loadSpaceContents(spaceId)
      }

      await loadEverything()
    } catch (error) {
      log.error('Error dropping:', error)
      toast.error('Error dropping: ' + (error as Error).message)
      drag.abort()
      return
    }
    drag.continue()

    toast.success(`Resources added!`)
    await tick()
    showTabSearch.set(2)
  }

  const handlePaste = async (e: ClipboardEvent) => {
    if ($showTabSearch !== 2 || get(miniBrowserService.isOpen)) return

    const target = e.target as HTMLElement
    const isFocused = target === document.activeElement

    if (
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true') &&
      isFocused
    ) {
      log.debug('Ignoring paste event in input field or editable content')
      return
    }

    let toast: ToastItem | null = null

    log.debug('Handling paste event')

    try {
      // NOTE: We filter plain text items, as that just leads to too many issue with the input fields
      // for right now.
      const mediaItems = (await processPaste(e)).filter((item) => item.type !== 'text')
      if (mediaItems.length === 0) {
        log.debug('No valid media items found in paste event')
        return
      }

      toast = toasts.loading(
        `Importing ${mediaItems.length} item${mediaItems.length > 1 ? 's' : ''}…`
      )

      const resources = await createResourcesFromMediaItems(
        resourceManager,
        mediaItems,
        `Imported at ${new Date().toLocaleString()}`,
        [ResourceTag.paste()]
      )

      if (!isEverythingSpace && !isInboxSpace && !isNotesSpace) {
        const space = await oasis.getSpace($selectedSpaceId)
        if (!space) {
          toast.warning('Could not find active space! Import still succeeded!')
        }

        await space?.addResources(
          resources.map((e) => e.id),
          SpaceEntryOrigin.ManuallyAdded
        )

        oasis.reloadSpace($selectedSpaceId)
      } else {
        oasis.loadEverything(false)
      }

      toast?.success(`Imported ${mediaItems.length} item${mediaItems.length > 1 ? 's' : ''}!`)
    } catch (e) {
      if (toast) toast.error('Could not import item(s)!')
      else toasts.error('Could not import item(s)!')
    }
  }

  const openResourceDetailsModal = (resourceId: string) => {
    scopedMiniBrowser.openResource(resourceId, {
      from: OpenInMiniBrowserEventFrom.Oasis
    })
  }

  const closeResourceDetailsModal = () => {
    scopedMiniBrowser.close()
  }

  const handleOpen = async (e: CustomEvent<string>, trackSource: boolean = false) => {
    openResourceDetailsModal(e.detail)
  }

  const handleOpenPageInMiniBrowser = async (e: CustomEvent<string>) => {
    scopedMiniBrowser.openWebpage(e.detail, {
      from: OpenInMiniBrowserEventFrom.Oasis
    })
  }

  const handleChatWithSpace = (spaceId: string) => {
    dispatch('open-space-and-chat', {
      spaceId,
      text: $searchValue
    })
    showTabSearch.set(0)
    searchValue.set('')
  }

  const handleCloseOverlay = () => {
    showTabSearch.set(0)
  }

  const handleCreateEmptySpace = async () => {
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace('.tempspace', undefined, '')
    if (spaceID === null) {
      toasts.error('Failed to create new context')
      return
    }

    isCreatingNewSpace.set(true)
    oasis.changeSelectedSpace(spaceID)
  }

  const handleDeleteSpace = async () => {
    await oasisSpace.handleDeleteSpace(false, true)
    isCreatingNewSpace.set(false)
  }

  const handleSpaceDeleted = async (e: CustomEvent) => {
    oasis.changeSelectedSpace(DEFAULT_SPACE_ID)
  }

  const handleSpaceSelected = async (e: CustomEvent<string>) => {
    log.debug('Space selected:', e.detail)
    oasis.changeSelectedSpace(e.detail)
  }

  const handleUpdatedSpace = async (e: CustomEvent<string | undefined>) => {
    log.debug('Space updated:', e.detail)
    isCreatingNewSpace.set(false)
    await tick()

    if (e.detail) {
      oasis.changeSelectedSpace(e.detail)
    }
  }

  const handleCreatedSpace = async (e: CustomEvent<OasisSpace>) => {
    const createdSpace = e.detail
    createSpaceRef.createdNewSpace(createdSpace)
  }

  const handleCreatingNewSpace = () => {
    isCreatingNewSpace.set(true)
  }

  const handleDoneCreatingNewSpace = () => {
    isCreatingNewSpace.set(true)
  }

  const handleOasisFilterChange = async (e: CustomEvent<string>) => {
    log.debug('Filter change:', e.detail)
    await debouncedSearch($searchValue)
  }

  const handleFilterTypeChange = (e: CustomEvent<FilterChangeEvent>) => {
    log.debug('Filter type change:', e.detail)
    oasis.selectedFilterTypeId.set(e.detail.filter?.id ?? null)
    loadEverything()
  }

  // TODO: (@maxu / @maxi): cant do rn only for contexts
  /*const handleSortBySettingsChanged = async (e: CustomEvent<SortByChangeEvent>) => {
    const { sortBy } = e.detail

    const prevSortby = $spaceData?.sortBy

    // TODO: Typing we dont expose a type for the sort exactly so this is scudffed
    await $space.updateData({ sortBy })
    loadSpaceContents(spaceId, true)

    if (prevSortby !== sortBy) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'sort_by',
        change: sortBy
      })
    }
  }*/

  const closeOnboarding = async () => {
    onboardingOpen.set(false)

    const existingOnboardingSettings = window.api.getUserConfigSettings().onboarding
    await window.api.updateUserConfigSettings({
      onboarding: {
        ...existingOnboardingSettings,
        completed_stuff: true
      }
    })
  }

  // Add this debounced search function
  const debouncedSearch = useDebounce(async (value: string) => {
    if (!value) return

    if (value.length === 0) {
      searchResults.set([])
      hasSearched.set(false)
      isSearching.set(false)
      if (!hasLoadedEverything) {
        hasLoadedEverything = true
        loadEverything()
      }
      return
    }

    try {
      isSearching.set(true)

      const hashtagMatch = value.match(/#[a-zA-Z0-9]+/g)
      const hashtags = hashtagMatch ? hashtagMatch.map((x) => x.slice(1)) : []

      if (hashtags.length === value.split(' ').length) {
        value = ''
      }

      // Only track telemetry if first search after reset
      if (!$hasSearched) {
        await telemetry.trackSearchOasis(SearchOasisEventTrigger.Oasis, false)
        hasSearched.set(true)
      }

      const result = await resourceManager.searchResources(
        value,
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ...($selectedFilter === 'saved_by_user'
            ? [ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)]
            : []),
          ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x)),
          ...conditionalArrayItem(
            $selectedSpaceId === 'notes',
            ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          )
        ],
        {
          semanticEnabled: $userConfigSettings.use_semantic_search
        }
      )

      searchResults.set(result)
    } catch (error) {
      log.error('Search error:', error)
      searchResults.set([])
    } finally {
      isSearching.set(false)
    }
  }, 300)

  const closeOverlay = () => {
    showTabSearch.set(0)
  }

  const handleMiniBrowserClose = (e: CustomEvent<boolean>) => {
    const completeley = e.detail
    if (completeley) {
      closeOverlay()
    }
  }

  const handleCloseDetailedResource = () => {
    if ($detailedResource) {
      removeSelectionById($detailedResource.id)
    }
    detailedResource.set(null)
  }

  const handleViewSettingsChanges = async (e: CustomEvent<ViewChangeEvent>) => {
    const { viewType, viewDensity } = e.detail

    const prevViewType =
      $builtInSpacesViewSettings[isInboxSpace ? 'inbox' : isNotesSpace ? 'notes' : 'all']?.viewType
    const prevViewDensity =
      $builtInSpacesViewSettings[isInboxSpace ? 'inbox' : isNotesSpace ? 'notes' : 'all']
        ?.viewDensity

    builtInSpacesViewSettings.update((v) => {
      if (isInboxSpace) {
        if (v.inbox === undefined) v.inbox = {}
        v.inbox.viewType = viewType
        v.inbox.viewDensity = viewDensity
      } else if (isNotesSpace) {
        if (v.notes === undefined) v.notes = {}
        v.notes.viewType = viewType
        v.notes.viewDensity = viewDensity
      } else {
        if (v.all === undefined) v.all = {}
        v.all.viewType = viewType
        v.all.viewDensity = viewDensity
      }
      return v
    })

    if (viewType !== undefined && prevViewType !== viewType) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'view_type',
        change: viewType
      })
    }
    if (viewDensity !== undefined && prevViewDensity !== viewDensity) {
      telemetry.trackUpdateSpaceSettings({
        setting: 'view_density',
        change: viewDensity
      })
    }
  }

  const handleReload = async () => {
    await tick()
    await loadEverything()
  }

  const resizeRafCbk = () => {
    $stuffWidthOffset = _stuffWidthOffset
    $stuffHeightOffset = _stuffHeightOffset
    resizeRaf = null
  }

  const handleResizeHandlerMouseDown = (
    _: MouseEvent,
    direction: 'left' | 'right' | 'top' | 'top-right' | 'top-left'
  ) => {
    $isResizing = true
    $resizingDirection = ['left', 'right'].includes(direction)
      ? 'horizontal'
      : direction === 'top'
        ? 'vertical'
        : direction === 'top-left'
          ? 'diag-left'
          : 'diag-right'
    const move = (e: MouseEvent) => {
      if (direction === 'left') {
        _stuffWidthOffset += e.movementX * 2
      } else if (direction === 'right') {
        _stuffWidthOffset -= e.movementX * 2
      } else if (direction === 'top') {
        _stuffHeightOffset += e.movementY
      } else if (direction === 'top-left') {
        _stuffHeightOffset += e.movementY
        _stuffWidthOffset += e.movementX * 2
      } else if (direction === 'top-right') {
        _stuffHeightOffset += e.movementY
        _stuffWidthOffset -= e.movementX * 2
      }
      if (resizeRaf === null) resizeRaf = requestAnimationFrame(resizeRafCbk)
    }
    const up = (_: MouseEvent) => {
      $isResizing = false
      const drawerWidth = stuffWrapperRef.clientWidth
      const drawerHeight = stuffWrapperRef.clientHeight
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      $stuffWidthPercentage = Math.round((drawerWidth / windowWidth) * 100)
      $stuffHeightPercentage = Math.round((drawerHeight / windowHeight) * 100)
      _stuffWidthOffset = 0
      _stuffHeightOffset = 0
      $resizingDirection = undefined
      if (resizeRaf === null) resizeRaf = requestAnimationFrame(resizeRafCbk)
      window.removeEventListener('mousemove', move, { capture: true })
    }

    window.addEventListener('mousemove', move, { capture: true })
    window.addEventListener('mouseup', up, { capture: true, once: true })
  }

  const cleanupDragStuck = () => {
    showDragHint.set(false)
    stuffWrapperRef?.classList.remove('hovering')
    updateWebviewPointerEvents('unset')
    window.removeEventListener('drag', handleDrag)
    window.removeEventListener('click', dragClickHandler, { capture: true })
    window.removeEventListener('keydown', dragClickHandler, { capture: true })
  }

  // Used to reset dragcula when clicking the page after dragging (to prevent the drawer from being stuck)
  const dragClickHandler = (_: Event) => {
    cleanupDragStuck()
    Dragcula.get().cleanupDragOperation()
  }

  const handleDrag = async (e: DragEvent) => {
    if ($showTabSearch !== 0) return
    if (e.clientY > window.innerHeight - 80) {
      stuffWrapperRef.classList.add('hovering')
      showTabSearch.set(2)
      // await tick()
    }
  }

  const handleDragculaDragStart = (drag: DragOperation) => {
    showDragHint.set(true)
    window.addEventListener('drag', handleDrag)
    window.addEventListener('click', dragClickHandler, { capture: true })
    window.addEventListener('keydown', dragClickHandler, { capture: true })
  }

  const handleDragculaDragEnd = (drag: DragOperation | undefined) => {
    cleanupDragStuck()
    updateWebviewPointerEvents('unset')

    // If there's no drag operation, it means the user just clicked somewhere
    if (!drag) return

    log.debug('Drag end', drag, drag?.to, drag?.from)

    // Check if drag target is within drawer or related components
    const containedIds = ['drawer', 'folder-', 'overlay-']
    const isTargetWithinContainer =
      drag?.to && containedIds.some((id) => drag.to!.id.startsWith(id))
    const isSourceWithinContainer =
      drag?.from && containedIds.some((id) => drag.from!.id.startsWith(id))

    // Don't close if dragged within container components
    if (isTargetWithinContainer && isSourceWithinContainer) {
      return
    }

    log.warn('Drag end - closing', handledDrop)
    // Only close drawer if item wasn't successfully dropped
    if (!handledDrop) {
      showTabSearch.set(0)
    } else {
      handledDrop = false
    }

    handledDrop = false
  }

  const handlePostDropOnSpace = () => {
    handledDrop = true
  }

  const updateWebviewPointerEvents = (value: string) => {
    // TODO: find a better way to do this
    document.querySelectorAll('.browser-window.active webview').forEach((webview) => {
      ;(webview as HTMLElement).style.pointerEvents = value
    })
  }

  $: themeOverride = !['all', 'inbox'].includes($selectedSpaceId)
    ? undefined
    : {
        backgroundImage: getBackgroundImageUrlFromId(undefined, darkMode),
        colors: {
          contrast: darkMode ? 'hsl(212, 92%, 92%)' : 'hsl(212, 92%, 8%)',
          base: '#808080'
        }
      }

  onMount(() => {
    Dragcula.get().on('dragstart', handleDragculaDragStart)
    Dragcula.get().on('dragend', handleDragculaDragEnd)

    window.api.onBrowserFocusChange((v) => {
      if (v === 'unfocused') {
        showDragHint.set(false)
      }
    })
  })

  onDestroy(() => {
    Dragcula.get().off('dragstart', handleDragculaDragStart)
    Dragcula.get().off('dragend', handleDragculaDragEnd)
  })

  onDestroy(
    showTabSearch.subscribe((v) => {
      if (v === 0) {
        if (searchResetTimeout !== null) clearTimeout(searchResetTimeout)

        if ($selectedSpaceId === DEFAULT_SPACE_ID) {
          selectedSpaceId.set($activeScopeId ?? DEFAULT_SPACE_ID)
        }

        detailedResource.set(null)

        searchResetTimeout = setTimeout(() => {
          searchValue.set('')
          selectedSpaceId.set($activeScopeId ?? DEFAULT_SPACE_ID)
          selectedFilterTypeId.set(null)
          searchResetTimeout = null
        }, SEARCH_RESET_TIMEOUT)
      } else {
        if (searchResetTimeout) {
          clearTimeout(searchResetTimeout)
          searchResetTimeout = null
        }
      }
    })
  )
</script>

<svelte:window on:paste={handlePaste} />

<div id="drawer-hint" class:show={$showDragHint && $showTabSearch === 0} use:portal={'body'}>
  <span>Hover to open your Stuff</span>
</div>

{#if $showTabSearch === 2}
  <div
    class="drawer-backdrop"
    style:view-transition-name="drawer-backdrop"
    data-dragcula-ignore
    class:showing={!$drawerHide}
    role="none"
    on:click={handleCloseOverlay}
  ></div>
{/if}
<div
  class="stuff-motion-wrapper relative z-[100000000]"
  use:springAppear={{
    visible: $showTabSearch === 2
  }}
>
  <div
    id="drawer"
    bind:this={stuffWrapperRef}
    class:hovering={!$drawerHide}
    class:isResizing={$isResizing}
    class="no-drag"
    data-resize-direction={$resizingDirection}
    style="width: fit-content;"
    style:view-transition-name="stuff-drawer"
    style:--drawer-width={$stuffWidthPercentage + 'vw'}
    style:--drawer-width-offset={$stuffWidthOffset + 'px'}
    style:--drawer-height={$stuffHeightPercentage + 'vh'}
    style:--drawer-height-offset={$stuffHeightOffset + 'px'}
    use:HTMLDragArea.use={{
      accepts: () => true
    }}
    on:DragEnter={() => {
      $drawerHide = false
    }}
    on:DragLeave={() => {
      $drawerHide = true
      updateWebviewPointerEvents('unset')
    }}
  >
    {#if $showTabSearch === 2}
      <MiniBrowser
        service={scopedMiniBrowser}
        on:seekToTimestamp
        on:highlightWebviewText
        on:close={handleMiniBrowserClose}
      />
      <div
        role="none"
        class="resize-handle right"
        on:mousedown={(e) => handleResizeHandlerMouseDown(e, 'right')}
      ></div>
      <div
        role="none"
        class="resize-handle left"
        on:mousedown={(e) => handleResizeHandlerMouseDown(e, 'left')}
      ></div>
      <div
        role="none"
        class="resize-handle top"
        on:mousedown={(e) => handleResizeHandlerMouseDown(e, 'top')}
      ></div>
      <div
        role="none"
        class="resize-handle top-right"
        on:mousedown={(e) => handleResizeHandlerMouseDown(e, 'top-right')}
      ></div>
      <div
        role="none"
        class="resize-handle top-left"
        on:mousedown={(e) => handleResizeHandlerMouseDown(e, 'top-left')}
      ></div>

      <div class="drawer-content">
        {#if $onboardingOpen}
          <Onboarding
            on:close={closeOnboarding}
            title="Stay on top of your stuff"
            tip=""
            sections={[
              {
                title: 'Save anything',
                description: `<p>Save webpages, tweets, YouTube videos, screenshots, PDFs,and more. </p>`,
                imgSrc: stuffAdd,
                imgAlt: 'Save anything',
                iconName: 'save'
              },
              {
                title: '(Auto)-organize',
                description: `<p>Create contexts and curate your items manually. Or let Surf do it for you.</p>`,
                imgSrc: stuffSmart,
                imgAlt: '(Auto)-organize',
                iconName: 'rectangle-group'
              },
              {
                title: 'Find',
                description: `<p>Easily find anything you've saved, with Surf search.</p>`,
                imgSrc: stuffSearch,
                imgAlt: 'Find',
                iconName: 'search'
              }
            ]}
            buttonText="Continue"
          />
        {/if}

        <SpacesView
          bind:this={createSpaceRef}
          {spaces}
          {resourceManager}
          showPreview={true}
          type="horizontal"
          interactive={false}
          on:space-selected={(e) => oasis.changeSelectedSpace(e.detail.id)}
          on:createTab={(e) => dispatch('create-tab-from-space', e.detail)}
          on:create-empty-space={handleCreateEmptySpace}
          on:open-space-and-chat
          on:delete-space={handleDeleteSpace}
          on:handled-drop={handlePostDropOnSpace}
          on:close-oasis={closeOverlay}
          on:Drop
        />

        <div
          class="stuff-view h-full w-full relative"
          style:--background-image={themeOverride?.backgroundImage}
          style:--base-color={themeOverride?.colors?.base}
          style:--contrast-color={themeOverride?.colors?.contrast}
        >
          <Tooltip rootID="stuff" />

          {#if !$isBuiltInSpace}
            {#await new Promise((resolve) => setTimeout(resolve, 175))}
              <!-- wait -->
            {:then}
              {#key $selectedSpaceId}
                <OasisSpaceRenderer
                  bind:this={oasisSpace}
                  spaceId={$selectedSpaceId}
                  active
                  handleEventsOutside
                  insideDrawer
                  on:open={handleOpen}
                  on:open-and-chat
                  on:open-page-in-mini-browser={handleOpenPageInMiniBrowser}
                  on:go-back={() => oasis.changeSelectedSpace(DEFAULT_SPACE_ID)}
                  on:deleted={handleSpaceDeleted}
                  on:updated-space={handleUpdatedSpace}
                  on:creating-new-space={handleCreatingNewSpace}
                  on:done-creating-new-space={handleDoneCreatingNewSpace}
                  on:select-space={handleSpaceSelected}
                  on:batch-open
                  on:batch-remove={handleResourceRemove}
                  on:handled-drop={handlePostDropOnSpace}
                  on:created-space={handleCreatedSpace}
                  on:close={closeOverlay}
                  on:seekToTimestamp
                  on:highlightWebviewText
                  on:open-space-and-chat
                />
              {/key}
            {/await}
          {:else}
            <DropWrapper
              {spaceId}
              acceptsDrag={(drag) => {
                if (drag.from?.id.startsWith('drawer-') && drag.from?.id.endsWith(spaceId))
                  return false
                if (
                  drag.isNative ||
                  drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
                  drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
                  drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
                ) {
                  return true
                }
                return false
              }}
              on:Drop={(e) => handleDropOnSpace(spaceId, e.detail)}
              zonePrefix="drawer-"
            >
              <LazyScroll items={renderContents} let:renderedItems>
                {#await new Promise((resolve) => setTimeout(resolve, 175))}
                  <!-- wait -->
                {:then}
                  {#key $selectedSpaceId}
                    <!--
                        TODO: Needs extended api
                        on:changedSortBy={handleSortBySettingsChanged}
                        on:changedOrder={handleOrderSettingsChanged}
                      -->

                    <OasisSpaceNavbar {searchValue}>
                      <svelte:fragment slot="left">
                        <Icon
                          name={isInboxSpace
                            ? inboxContext.icon
                            : isNotesSpace
                              ? notesContext.icon
                              : everythingContext.icon}
                          size="1.4rem"
                          color="currentColor"
                          style="color: currentColor;"
                        />

                        <span class="context-name"
                          >{isInboxSpace
                            ? inboxContext.label
                            : isNotesSpace
                              ? notesContext.label
                              : everythingContext.label}</span
                        >
                      </svelte:fragment>
                      <svelte:fragment slot="right">
                        {#if isInboxSpace}
                          <button
                            use:tooltip={{
                              position: 'left',
                              text:
                                $searchValue.length > 0
                                  ? 'Create new chat with this context'
                                  : `Create new chat with this context (${isMac() ? '⌘' : 'ctrl'}+↵)`
                            }}
                            class="chat-with-space pointer-all"
                            class:activated={$searchValue.length > 0}
                            on:click={() => handleChatWithSpace('inbox')}
                          >
                            <Icon name="face" size="1.6em" />

                            <div class="chat-text">Ask Context</div>
                          </button>
                        {/if}
                        {#if $isBuiltInSpace && !!$searchValue}
                          <Select {selectedFilter} on:change={handleOasisFilterChange}>
                            <option value="all">Show All</option>
                            <option value="saved_by_user">Saved by Me</option>
                          </Select>
                        {/if}
                      </svelte:fragment>
                      <svelte:fragment slot="right-dynamic">
                        <SpaceFilterViewButtons
                          hideSortingSettings
                          filter={$selectedFilterTypeId ?? null}
                          viewType={$builtInSpacesViewSettings[isInboxSpace ? 'inbox' : 'all']
                            ?.viewType}
                          viewDensity={$builtInSpacesViewSettings[isInboxSpace ? 'inbox' : 'all']
                            ?.viewDensity}
                          sortBy={'resource_added_to_space'}
                          order={'desc'}
                          on:changedView={handleViewSettingsChanges}
                          on:changedFilter={handleFilterTypeChange}
                        />
                      </svelte:fragment>
                    </OasisSpaceNavbar>

                    <ContextHeader
                      headline={isInboxSpace
                        ? inboxContext.label
                        : isNotesSpace
                          ? notesContext.label
                          : everythingContext.label}
                      description={isInboxSpace
                        ? inboxContext.description
                        : isNotesSpace
                          ? notesContext.description
                          : everythingContext.description}
                      headlineEditable={false}
                      descriptionEditable={false}
                    >
                      <svelte:fragment slot="icon">
                        <Icon
                          name={isInboxSpace
                            ? inboxContext.icon
                            : isNotesSpace
                              ? notesContext.icon
                              : everythingContext.icon}
                          size="xl"
                          color="currentColor"
                          style="color: currentColor;"
                        />
                      </svelte:fragment>
                    </ContextHeader>

                    {#if isInboxSpace}
                      <ContextTabsBar
                        on:open-page-in-mini-browser={handleOpenPageInMiniBrowser}
                        on:handled-drop={handlePostDropOnSpace}
                        on:select-space={handleSpaceSelected}
                        on:reload={handleReload}
                      />
                    {/if}

                    <OasisResourcesView
                      resources={renderedItems}
                      {searchValue}
                      isInSpace={false}
                      status={$loadingContents
                        ? { icon: 'spinner', message: 'Loading contents…' }
                        : $isSearching && $searchValue?.length > 0
                          ? { icon: 'spinner', message: 'Searching your stuff…' }
                          : undefined}
                      viewType={$builtInSpacesViewSettings[
                        isInboxSpace ? 'inbox' : isNotesSpace ? 'notes' : 'all'
                      ]?.viewType}
                      viewDensity={$builtInSpacesViewSettings[
                        isInboxSpace ? 'inbox' : isNotesSpace ? 'notes' : 'all'
                      ]?.viewDensity}
                      hideSortingSettings
                      hideFilterSettings={isNotesSpace}
                      on:click={handleItemClick}
                      on:open={(e) => handleOpen(e, true)}
                      on:open-and-chat
                      on:open-space-as-tab
                      on:remove={handleResourceRemove}
                      on:batch-remove={handleResourceRemove}
                      on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
                      on:batch-open
                      on:new-tab
                      on:changedView={handleViewSettingsChanges}
                      on:changedFilter={handleFilterTypeChange}
                    />
                  {/key}
                {/await}
              </LazyScroll>
            </DropWrapper>
          {/if}
        </div>

        {#if $detailedResource}
          <StuffRightSidebar>
            {#key $detailedResource.id}
              <ResourceDetails
                resource={$detailedResource}
                on:open={(e) => handleOpen(e)}
                on:close={handleCloseDetailedResource}
                on:remove={handleResourceRemove}
                on:open-and-chat
              />
            {/key}
          </StuffRightSidebar>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  :global(body:has(#drawer.isResizing[data-resize-direction='horizontal'])),
  :global(body:has(#drawer.isResizing[data-resize-direction='vertical'])) {
    user-select: none;

    #drawer.isResizing .resize-handle {
      pointer-events: auto;
    }
  }
  :global(body:has(#drawer.isResizing[data-resize-direction='horizontal'])) {
    cursor: ew-resize !important;
  }
  :global(body:has(#drawer.isResizing[data-resize-direction='vertical'])) {
    cursor: ns-resize !important;
  }
  :global(body:has(#drawer.isResizing[data-resize-direction='diag-left'])) {
    cursor: nwse-resize !important;
  }
  :global(body:has(#drawer.isResizing[data-resize-direction='diag-right'])) {
    cursor: nesw-resize !important;
  }

  #drawer-hint {
    pointer-events: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 4rem;
    z-index: 9;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    font-weight: 500;
    letter-spacing: 0.07px;
    font-size: 0.9em;
    mix-blend-mode: exclude;
    transition: transform 105ms ease-out;
    transform: translateY(100%);
    text-align: center;

    background: linear-gradient(to top, #00000022, #00000000);

    > span {
      background: #fff;
      padding: 0.5em 1em;
      border-radius: 1.3em 1.3em 0 0;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-bottom: 0;
      width: 90%;
    }
    &.show {
      transform: translateY(0) !important;
    }
  }
  :global(body.dark) #drawer-hint {
    background: linear-gradient(to top, #ffffff22, #ffffff00);
    > span {
      background: #121828;
      color: #aaaaaacc;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
  }

  .onboarding-button {
    position: relative;

    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 200ms;

    height: fit-content;
    width: fit-content;
    background: white;
    padding: 0.5rem;
    left: 0.5rem;
    border-radius: 0.5rem;

    &:hover {
      background: rgba(244, 114, 182, 0.5);
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  #drawer {
    position: absolute;
    z-index: 100001;
    bottom: 2rem;
    left: 50%;
    overflow: visible !important;
    display: flex;

    border-radius: 24px 24px 16px 16px;

    -webkit-font-smoothing: antialiased;
    -webkit-app-region: no-drag;

    transform: translateX(-50%);
    transition:
      translate 100ms ease-out,
      transform 175ms cubic-bezier(0.165, 0.84, 0.44, 1);

    &::before {
      content: '';
      position: fixed;
      background: transparent;
      left: -100vw;
      right: -100vw;
      top: 100%;
      height: 100px;
    }

    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 89px 0px rgba(0, 0, 0, 0.18),
      0px 4px 18px 0px rgba(0, 0, 0, 0.18),
      0px 1px 1px 0px rgba(126, 168, 240, 0.3),
      0px 4px 4px 0px rgba(126, 168, 240, 0.15);
    box-shadow:
      inset 0px 1px 4px -1px white,
      inset 0px -1px 1p2 0 white,
      inset 0px 30px 20px -20px color(display-p3 1 1 1 / 0.15),
      0px 0px 89px 0px color(display-p3 0 0 0 / 0.18),
      0px 4px 18px 0px color(display-p3 0 0 0 / 0.18),
      0px 1px 1px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.3),
      0px 4px 4px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.15);

    > .drawer-content {
      position: relative;
      width: calc(var(--drawer-width) - var(--drawer-width-offset));
      min-width: 120ch;
      max-width: min(95vw, 2000px);
      height: calc(var(--drawer-height) - var(--drawer-height-offset));
      min-height: 50ch;
      max-height: min(95vh, 1400px);
      overflow: hidden !important;
      border-radius: 24px 24px 16px 16px;
      @apply bg-white dark:bg-gray-700;
      display: flex;
    }
    .resize-handle {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 100%;

      z-index: 999999999999999999999999999;
      cursor: ew-resize;

      &.left {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        &:hover {
          border-radius: 2em;
        }
      }

      &.top {
        left: 50%;
        top: 0;
        height: 8px;
        width: 100%;
        cursor: ns-resize;
      }
      &.top-right {
        left: unset;
        right: 0;
        top: 0;
        height: 16px;
        width: 16px;
        cursor: nesw-resize;
        transform: translate(0%, -0%);
      }
      &.top-left {
        left: 0;
        top: 0;
        height: 16px;
        width: 16px;
        cursor: nwse-resize;
        transform: translate(0%, -0%);
      }
      &.right {
        left: unset;
        right: 0;
        top: 50%;
        transform: translate(50%, -50%);
        cursor: ew-resize;

        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
    }
  }

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100001;
    -webkit-app-region: no-drag;
    opacity: 1;

    transition: opacity 175ms cubic-bezier(0.165, 0.84, 0.44, 1);
    @apply bg-black/40 dark:bg-gray-700/80;
  }
  :global(body[data-dragging='true'] .drawer-backdrop:not(.showing)) {
    opacity: 0;
    pointer-events: none !important;
  }
  :global(body[data-dragging='true'] .drawer-backdrop.showing) {
    opacity: 1;
  }

  .global-search-wrapper {
    position: absolute;
    bottom: 0;
    right: 0;
    width: calc(100% - 19rem);
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4rem;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      color(display-p3 0.9373 0.9569 1) 0%,
      color(display-p3 0.9321 0.9531 1) 50%,
      color(display-p3 0.8349 0.8849 0.9974) 100%
    );
    border: 0.5px solid #58688460;
    backdrop-filter: blur(30px);
    z-index: 10;
    padding: 0.5rem;
    margin: 0.5rem;
    border-radius: 1rem;
    outline: 1px solid rgba(126, 168, 240, 0.05);
    box-shadow:
      inset 0px 1px 1px -1px white,
      inset 0px -1px 1px -1px white,
      inset 0px 30px 20px -20px rgba(255, 255, 255, 0.15),
      0px 0px 30px 0px rgba(0, 0, 0, 0.12),
      0px 2px 8px 0px rgba(0, 0, 0, 0.12),
      0px 1px 1px 0px rgba(126, 168, 240, 0.3),
      0px 2px 2px 0px rgba(126, 168, 240, 0.15);
    box-shadow:
      inset 0px 1px 4px -1px white,
      inset 0px -1px 1p2 0 white,
      inset 0px 30px 20px -20px color(display-p3 1 1 1 / 0.15),
      0px 0px 30px 0px color(display-p3 0 0 0 / 0.12),
      0px 2px 8px 0px color(display-p3 0 0 0 / 0.12),
      0px 1px 1px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.3),
      0px 2px 2px 0px color(display-p3 0.5294 0.6549 0.9176 / 0.15);
  }

  .input-wrapper {
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* FIXES double drop as webview still consumes drop if pointer is inside overlay. */
  :global(body[data-dragging='true']:has(#drawer.hovering) webview) {
    pointer-events: none !important;
  }

  :global(body[data-dragging='true']:has(#drawer:not(.hovering))) #drawer {
    transform: translate(-50%, 100%) !important;
  }

  /* Hides the Drawer when dragging and not targeting it */
  :global(body[data-dragging='true'] #drawer:not(.hovering)) {
    transform: translate(-50%, 0);
  }
  .stuff-view {
    overflow: hidden;
  }
</style>
