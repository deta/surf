<script lang="ts">
  import {
    type Writable,
    derived,
    writable,
    type Subscriber,
    type Unsubscriber
  } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import Fuse from 'fuse.js'
  import { useLogScope, useDebounce, useLocalStorageStore, tooltip } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import { useTabsManager } from '../../service/tabs'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import type { OverlayEvents } from '../Overlay/types'
  import { Icon } from '@horizon/icons'
  import { DragOperation, Dragcula, DragculaDragEvent } from '@horizon/dragcula'
  import {
    Resource,
    ResourceJSON,
    ResourceManager,
    type ResourceSearchResultItem
  } from '../../service/resources'
  import {
    DragTypeNames,
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    SpaceEntryOrigin,
    type DragTypes,
    type Space
  } from '../../types'
  import type { Tab, TabPage, TabSpace } from '../../types/browser.types'
  import type { HistoryEntriesManager } from '../../service/history'
  import {
    CreateTabEventTrigger,
    DeleteResourceEventTrigger,
    MultiSelectResourceEventAction,
    OpenInMiniBrowserEventFrom,
    SaveToOasisEventTrigger,
    SearchOasisEventTrigger
  } from '@horizon/types'
  import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINES } from '../../constants/searchEngines'
  import { CONTEXT_MENU_OPEN } from './ContextMenu.svelte'
  import * as Command from '../Command'
  import CommandMenuItem, { type CMDMenuItem } from './CommandMenuItem.svelte'
  import DropWrapper from '../Oasis/DropWrapper.svelte'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'
  import OasisSpaceRenderer from '../Oasis/OasisSpace.svelte'
  import SpacesView from '../Oasis/SpacesView.svelte'
  import Onboarding from './Onboarding.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import { Drawer } from 'vaul-svelte'
  import stuffAdd from '../../../../public/assets/demo/stuffsave.gif'
  import stuffSmart from '../../../../public/assets/demo/stuffsmart.gif'
  import stuffSearch from '../../../../public/assets/demo/stuffsearch.gif'
  import { portal } from '../Core/Portal.svelte'
  import Tooltip from '../Onboarding/Tooltip.svelte'
  import SearchField from '../Atoms/SearchField.svelte'
  import Select from '../Atoms/Select.svelte'
  import { createResourcesFromMediaItems, processDrop } from '../../service/mediaImporter'
  import { springVisibility } from '../motion/springVisibility'
  import { springAppear } from '../motion/springAppear'
  import FilterSelector, { type FilterItem } from '../Oasis/FilterSelector.svelte'
  import ContextTabsBar from '../Oasis/ContextTabsBar.svelte'

  export let activeTabs: Tab[] = []
  export let showTabSearch: Writable<number>
  export let spaceId: string
  export let historyEntriesManager: HistoryEntriesManager
  export let activeTab: Tab | undefined = undefined
  export let updateSearchValue: Writable<string>

  const log = useLogScope('NewTabOverlay')
  const dispatch = createEventDispatcher<OverlayEvents>()
  const tabsManager = useTabsManager()
  const config = useConfig()
  const oasis = useOasis()
  const toasts = useToasts()
  const miniBrowserService = useMiniBrowserService()
  const scopedMiniBrowser = miniBrowserService.createScopedBrowser(`new-tab-overlay`)

  const resourceManager = oasis.resourceManager
  const telemetry = resourceManager.telemetry
  const spaces = oasis.spaces
  const selectedSpaceId = oasis.selectedSpace
  const everythingContentsResources = oasis.everythingContents
  const userConfigSettings = config.settings
  const selectedFilterTypeId = oasis.selectedFilterTypeId

  let oasisSpace: OasisSpaceRenderer

  let createSpaceRef: SpacesView
  let page: 'tabs' | 'oasis' | 'history' | 'spaces' | null = null
  let selectFirstCommandItem: () => void
  let hasLoadedEverything = false
  let searchTimeout: NodeJS.Timeout | null = null
  let previousSearchValue = ''
  let showDragHint = writable(false)
  let filteredItems

  const defaultSpaceId = 'all'

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

  let stuffWrapperRef: HTMLElement

  $: isEverythingSpace = $selectedSpaceId === 'all'
  $: isInboxSpace = $selectedSpaceId === 'inbox'

  $: if (updateSearchValue) {
    //console.log('updateSearchValue', $updateSearchValue)
    searchValue.set($updateSearchValue)
  }

  $: if ($showTabSearch === 2) {
    loadEverything(true)
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

  $: if ($selectedSpaceId === 'all') {
    loadEverything()
  } else if ($selectedSpaceId === 'inbox') {
    loadEverything()
  }

  let dragculaTargetUnsubscriber: Unsubscriber
  $: {
    if (showTabSearch) {
      dragculaTargetUnsubscriber = Dragcula.get().targetDomElement.subscribe(
        (el: HTMLElement | null) => {
          if (stuffWrapperRef?.contains(el) && $showTabSearch === 2) {
            stuffWrapperRef?.classList.add('hovering')
          } else {
            stuffWrapperRef?.classList.remove('hovering')
            updateWebviewPointerEvents('unset')
          }
        }
      )
    } else {
      dragculaTargetUnsubscriber()
    }
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

  const isBuiltInSpace = derived([selectedSpaceId], ([$selectedSpaceId]) => {
    return $selectedSpaceId === 'all' || $selectedSpaceId === 'inbox'
  })

  const loadEverything = async (initialLoad = false) => {
    await tick()
    await oasis.loadEverything(initialLoad)
  }

  const handleResourceRemove = async (e: CustomEvent<string | string[]>) => {
    try {
      const resourceIds = Array.isArray(e.detail) ? e.detail : [e.detail]
      log.debug('removing resources', resourceIds)

      if (resourceIds.length === 0) {
        toasts.error('No resources found to remove.')
        return
      }

      const isInSpace = $selectedSpaceId !== 'all' && $selectedSpaceId !== 'inbox'
      await oasis.removeResourcesFromSpaceOrOasis(
        resourceIds,
        isInSpace ? $selectedSpaceId : undefined
      )

      if (resourceIds.length > 1) {
        await telemetry.trackMultiSelectResourceAction(
          MultiSelectResourceEventAction.Delete,
          resourceIds.length,
          isEverythingSpace || isInboxSpace ? 'oasis' : 'space'
        )
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
    toasts.success('Space icon updated!')
  }

  const handleItemClick = (e: CustomEvent<string>) => {
    log.debug('Item clicked:', e.detail)
    selectedItem.set(e.detail)
  }

  let handledDrop = false

  const handleDropOnSpace = async (spaceId: string, drag: DragculaDragEvent<DragTypes>) => {
    //const toast = toasts.loading(`${drag.effect === 'move' ? 'Moving' : 'Copying'} to space...`)
    const toast = toasts.loading(`Adding to space...`)

    try {
      if (drag.isNative) {
        handledDrop = true
        const parsed = await processDrop(drag.event!)
        log.debug('Parsed', parsed)

        const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
        log.debug('Resources', newResources)

        if (!isEverythingSpace && !isInboxSpace) {
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
            !isEverythingSpace && !isInboxSpace
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

  const handleCloseOverlay = () => {
    showTabSearch.set(0)
  }

  const handleCreateEmptySpace = async () => {
    await tick()
    const spaceID = await createSpaceRef.handleCreateSpace('.tempspace', undefined, '')
    if (spaceID === null) {
      toasts.error('Failed to create new space')
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
    oasis.changeSelectedSpace(defaultSpaceId)
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

  const handleFilterTypeChange = (e: CustomEvent<FilterItem | null>) => {
    log.debug('Filter type change:', e.detail)
    loadEverything()
  }

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
          ...hashtags.map((x) => ResourceManager.SearchTagHashtag(x))
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

  const handleReload = async () => {
    await tick()
    await loadEverything()
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

  const handleDrag = (e: DragEvent) => {
    if ($showTabSearch !== 0) return
    if (e.clientY > window.innerHeight - 80) {
      stuffWrapperRef.classList.add('hovering')
      showTabSearch.set(2)
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
</script>

<div id="drawer-hint" class:show={$showDragHint && $showTabSearch === 0} use:portal={'body'}>
  <span>Hover to open your Stuff</span>
</div>

{#if $showTabSearch === 2}
  <div class="stuff-backdrop" aria-hidden="true" on:click={handleCloseOverlay}></div>
{/if}
<div
  class="stuff-motion-wrapper relative z-[100000000]"
  use:springAppear={{
    visible: $showTabSearch === 2
  }}
>
  <div
    id="drawer-content"
    class="stuff-wrapper no-drag"
    style="width: fit-content;"
    bind:this={stuffWrapperRef}
  >
    <MiniBrowser service={scopedMiniBrowser} />

    <div class="w-[90vw] h-[calc(100vh-120px)] relative block overflow-hidden rounded-2xl">
      <div class="flex h-full">
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
                description: `<p>Create spaces and curate your items manually. Or let Surf do it for you.</p>`,
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
        {#if $showTabSearch === 2}
          <div id="stuff-sidebar" class="sidebar-wrap h-full bg-sky-500/40 w-[18rem] max-w-[18rem]">
            {#key $spaces}
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
            {/key}
          </div>

          <div class="stuff-view h-full w-full relative">
            <Tooltip rootID="stuff" />

            {#if isInboxSpace}
              <ContextTabsBar
                on:open-page-in-mini-browser={handleOpenPageInMiniBrowser}
                on:handled-drop={handlePostDropOnSpace}
                on:select-space={handleSpaceSelected}
                on:reload={handleReload}
              />
            {/if}

            {#if !$isBuiltInSpace}
              {#key $selectedSpaceId}
                {#await new Promise((resolve) => setTimeout(resolve, 175))}
                  <!-- wait -->
                {:then}
                  <OasisSpaceRenderer
                    spaceId={$selectedSpaceId}
                    active
                    showBackBtn
                    hideResourcePreview
                    handleEventsOutside
                    {historyEntriesManager}
                    on:open={handleOpen}
                    on:open-and-chat
                    on:open-page-in-mini-browser={handleOpenPageInMiniBrowser}
                    on:go-back={() => oasis.changeSelectedSpace(defaultSpaceId)}
                    on:deleted={handleSpaceDeleted}
                    on:updated-space={handleUpdatedSpace}
                    on:creating-new-space={handleCreatingNewSpace}
                    on:done-creating-new-space={handleDoneCreatingNewSpace}
                    on:select-space={handleSpaceSelected}
                    on:batch-open
                    on:batch-remove={handleResourceRemove}
                    on:handled-drop={handlePostDropOnSpace}
                    on:created-space={handleCreatedSpace}
                    on:open-space-and-chat
                    insideDrawer={true}
                    bind:this={oasisSpace}
                    {searchValue}
                  />
                {/await}
              {/key}
            {:else}
              <DropWrapper
                acceptDrop={true}
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
                <div class="w-full h-full">
                  {#if $resourcesToShow.length > 0}
                    {#key $selectedSpaceId}
                      {#await new Promise((resolve) => setTimeout(resolve, 175))}
                        <!-- wait -->
                      {:then}
                        <OasisResourcesViewSearchResult
                          resources={resourcesToShow}
                          selected={$selectedItem}
                          isEverythingSpace={true}
                          isInSpace={false}
                          scrollTop={0}
                          on:click={handleItemClick}
                          on:open={(e) => handleOpen(e, true)}
                          on:open-and-chat
                          on:open-space-as-tab
                          on:remove={handleResourceRemove}
                          on:batch-remove={handleResourceRemove}
                          on:set-resource-as-space-icon={handleUseResourceAsSpaceIcon}
                          on:batch-open
                          on:new-tab
                          {searchValue}
                        />
                      {/await}
                    {/key}

                    {#if $loadingContents}
                      <div class="floating-loading">
                        <Icon name="spinner" size="20px" />
                      </div>
                    {/if}
                  {:else if $isSearching && $searchValue?.length > 0}
                    <div class="content-wrapper h-full flex items-center justify-center">
                      <div
                        class="content flex flex-col items-center justify-center text-center space-y-4"
                      >
                        <Icon name="spinner" size="22px" />
                        <p class="text-lg font-medium text-gray-700">Searching your stuff...</p>
                      </div>
                    </div>
                  {:else if $resourcesToShow.length === 0 && $searchValue.length > 0}
                    <div class="content-wrapper h-full flex items-center justify-center">
                      <div
                        class="content flex flex-col items-center justify-center text-center space-y-4"
                      >
                        <Icon name="save" size="22px" class="mb-2" />

                        <p class="text-lg font-medium text-gray-700">
                          No stuff found for "{$searchValue}". Try a different search term.
                        </p>
                      </div>
                    </div>
                  {/if}
                </div>
              </DropWrapper>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    {#if $isBuiltInSpace}
      <div class="global-search-wrapper">
        {#if $showTabSearch === 2 && $isBuiltInSpace}
          <button
            class="onboarding-button"
            on:click={() => {
              $onboardingOpen = !$onboardingOpen
            }}
            use:tooltip={{
              text: 'Need help?',
              position: 'right'
            }}
            aria-label="Show onboarding"
          >
            <Icon name="info" />
          </button>
        {/if}

        <div class="input-wrapper">
          <SearchField {searchValue} placeholder="Search..." autoFocus={$showTabSearch === 2} />

          {#if $isBuiltInSpace && !!$searchValue}
            <Select {selectedFilter} on:change={handleOasisFilterChange}>
              <option value="all">Show All</option>
              <option value="saved_by_user">Saved by Me</option>
            </Select>
          {/if}
        </div>

        {#if $showTabSearch === 2}
          <div class="absolute right-2 flex items-center gap-2">
            <FilterSelector selected={selectedFilterTypeId} on:change={handleFilterTypeChange} />
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- {/if} -->

<style lang="scss">
  :global([data-vaul-drawer]) {
    transition: transform 10ms ease-out !important;
  }
  :global([data-vaul-drawer][data-vaul-drawer-direction='bottom']::after) {
    content: none;
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
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow: hidden;
    border-radius: 12px;
  }

  .onboarding-button {
    position: relative;

    transform: translateZ(0);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 200ms;
    cursor: pointer;
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

  .stuff-wrapper {
    position: absolute;
    z-index: 100001;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateZ(0);
    border-radius: 32px;
    -webkit-font-smoothing: antialiased;
    -webkit-app-region: no-drag;
    overflow: hidden;
    transition: translate 100ms ease-out;
    @apply bg-white dark:bg-gray-700;

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
  }

  .stuff-backdrop {
    position: fixed;
    inset: 0;
    /* pointer-events: none; */
    z-index: 100001;
    -webkit-app-region: no-drag;
    opacity: 1;
    transition: opacity 100ms ease-out;
    @apply bg-black/40 dark:bg-gray-700/80;
  }

  .page-background {
    background: linear-gradient(180deg, #f9f5e6, rgb(237, 236, 226));
    background: linear-gradient(
      180deg,
      color(display-p3 0.9725 0.9686 0.949) 0%,
      color(display-p3 0.9725 0.9686 0.949) 100%
    );
  }

  .background {
    background: linear-gradient(180deg, #e6ddda 0%, #f8f7f1 100%);
  }

  .modal-wrapper {
    position: absolute;
    top: 4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }

  .drawer-bar {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1000;
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

  :global(.stuff-wrapper) {
    overflow: visible !important;
    &::before {
      content: '';
      position: fixed;
      background: transparent;
      left: -100vw;
      right: -100vw;
      top: 100%;
      height: 100px;
    }
  }

  /* FIXES double drop as webview still consumes drop if pointer is inside overlay. */
  :global(body:has(.stuff-wrapper.hovering) webview) {
    pointer-events: none !important;
  }
  :global(body[data-dragging='true'] .stuff-backdrop) {
    pointer-events: none;
  }

  :global(body[data-dragging='true']:not(:has(.stuff-wrapper.hovering)) .stuff-backdrop) {
    opacity: 0 !important;
  }

  :global(body[data-dragging='true']:has(.stuff-wrapper:not(.hovering))) .stuff-wrapper {
    transform: translate(-50%, 100%) !important;
  }

  :global(body[data-dragging='true']:has(.stuff-wrapper:not(.hovering))) .stuff-backdrop {
    display: none;
  }

  /* Hides the Drawer when dragging and not targeting it */
  :global(body[data-dragging='true'] .stuff-wrapper:not(.hovering)) {
    transform: translate(-50%, 0);
  }
</style>
