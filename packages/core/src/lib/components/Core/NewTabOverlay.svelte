<script lang="ts">
  import { type Writable, writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { useLogScope, useLocalStorageStore } from '@horizon/utils'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { useToasts } from '../../service/toast'
  import { useConfig } from '../../service/config'
  import { useMiniBrowserService } from '@horizon/core/src/lib/service/miniBrowser'
  import type { OverlayEvents } from '../Overlay/types'
  import { DragOperation, Dragcula, HTMLDragArea } from '@horizon/dragcula'
  import { OpenInMiniBrowserEventFrom } from '@horizon/types'
  import OasisSpaceRenderer from '../Oasis/OasisSpace.svelte'
  import SpacesView from '../Oasis/Scaffolding/SpacesView.svelte'
  import Onboarding from './Onboarding.svelte'
  import MiniBrowser from '../MiniBrowser/MiniBrowser.svelte'
  import stuffAdd from '../../../../public/assets/demo/stuffsave.gif'
  import stuffSmart from '../../../../public/assets/demo/stuffsmart.gif'
  import stuffSearch from '../../../../public/assets/demo/stuffsearch.gif'
  import Tooltip from '../Onboarding/Tooltip.svelte'
  import { getBackgroundImageUrlFromId } from '../../service/colors'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import ResourceDetails from '@horizon/core/src/lib/components/Oasis/Scaffolding/ResourceDetails.svelte'
  import { removeSelectionById } from '@horizon/core/src/lib/components/Oasis/utils/select'
  import StuffRightSidebar from '@horizon/core/src/lib/components/Oasis/Scaffolding/StuffRightSidebar.svelte'

  export let showTabSearch: Writable<number>

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
  const userConfigSettings = config.settings
  const detailedResource = oasis.detailedResource
  const activeScopeId = tabsManager.activeScopeId

  const onboardingOpen = writable($userConfigSettings.onboarding.completed_stuff === false)
  const isCreatingNewSpace = writable(false)

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
  let oasisSpace: OasisSpaceRenderer

  let drawerHide = writable(false) // Whether to slide the drawer away
  let lastShowTabSearch = 0

  $: darkMode = $userConfigSettings.app_style === 'dark'

  $: if ($showTabSearch === 2) {
    if (lastShowTabSearch !== $showTabSearch) {
      telemetry.trackOpenOasis()
    }
    $drawerHide = false
    lastShowTabSearch = $showTabSearch
  } else {
    lastShowTabSearch = $showTabSearch
  }

  $: if ($showTabSearch !== 2) {
    closeResourceDetailsModal()
  }

  $: log.debug('selectedSpaceId', $selectedSpaceId)

  const openResourceDetailsModal = (resourceId: string) => {
    scopedMiniBrowser.openResource(resourceId, {
      from: OpenInMiniBrowserEventFrom.Oasis
    })
  }

  const closeResourceDetailsModal = () => {
    scopedMiniBrowser.close()
  }

  const handleOpen = async (e: CustomEvent<string>) => {
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

  const handleSpaceDeleted = async (_e: CustomEvent) => {
    oasis.changeSelectedSpace(oasis.defaultSpaceID)
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
    stuffWrapperRef?.classList.remove('hovering')
    updateWebviewPointerEvents('unset')
    window.removeEventListener('click', dragClickHandler, { capture: true })
    window.removeEventListener('keydown', dragClickHandler, { capture: true })
  }

  // Used to reset dragcula when clicking the page after dragging (to prevent the drawer from being stuck)
  const dragClickHandler = (_: Event) => {
    cleanupDragStuck()
    Dragcula.get().cleanupDragOperation()
  }

  const handleDragculaDragStart = (_drag: DragOperation) => {
    window.addEventListener('click', dragClickHandler, { capture: true })
    window.addEventListener('keydown', dragClickHandler, { capture: true })
  }

  const handleDragculaDragEnd = (drag: DragOperation | undefined) => {
    cleanupDragStuck()
    updateWebviewPointerEvents('unset')

    // If there's no drag operation, it means the user just clicked somewhere
    if (!drag) return

    log.debug('Drag end', drag, drag?.to, drag?.from)
  }

  const handlePostDropOnSpace = () => {}

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
  })

  onDestroy(() => {
    Dragcula.get().off('dragstart', handleDragculaDragStart)
    Dragcula.get().off('dragend', handleDragculaDragEnd)

    showTabSearch.subscribe((v) => {
      if (v === 0) {
        if ($selectedSpaceId === oasis.defaultSpaceID) {
          selectedSpaceId.set($activeScopeId ?? oasis.defaultSpaceID)
        }

        detailedResource.set(null)
      }
      oasis.resetNavigationHistory()
    })
  })
</script>

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
<div class="stuff-motion-wrapper relative z-[100000000]">
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
          type="horizontal"
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
              on:go-back={() => oasis.changeSelectedSpace(oasis.defaultSpaceID)}
              on:deleted={handleSpaceDeleted}
              on:updated-space={handleUpdatedSpace}
              on:creating-new-space={handleCreatingNewSpace}
              on:done-creating-new-space={handleDoneCreatingNewSpace}
              on:select-space={handleSpaceSelected}
              on:batch-open
              on:handled-drop={handlePostDropOnSpace}
              on:created-space={handleCreatedSpace}
              on:close={closeOverlay}
              on:seekToTimestamp
              on:highlightWebviewText
              on:open-space-and-chat
            />
          {/key}
        </div>

        {#if $detailedResource}
          <StuffRightSidebar>
            {#key $detailedResource.id}
              <ResourceDetails
                resource={$detailedResource}
                on:open={(e) => handleOpen(e)}
                on:close={handleCloseDetailedResource}
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

  #drawer {
    position: absolute;
    z-index: 100001;
    bottom: 2rem;
    left: 50%;
    overflow: visible !important;
    display: flex;

    border-radius: 16px 7px 16px 16px;

    -webkit-font-smoothing: antialiased;
    -webkit-app-region: no-drag;

    transform: translateX(-50%);
    transition:
      translate 100ms ease-out,
      transform 175ms cubic-bezier(0.165, 0.84, 0.44, 1);

    > .drawer-content {
      position: relative;
      width: calc(var(--drawer-width) - var(--drawer-width-offset));
      min-width: 120ch;
      max-width: min(95vw, 2000px);
      height: calc(var(--drawer-height) - var(--drawer-height-offset));
      min-height: 50ch;
      max-height: min(95vh, 1400px);
      overflow: hidden !important;
      border-radius: 16px 7px 16px 16px;
      @apply bg-white dark:bg-gray-700;
      display: flex;
      border: 0.25px solid rgba(0, 0, 0, 0.05);
      border: 0.25px solid color(display-p3 0 0 0 / 0.05);
      box-shadow:
        0px 0px 0px 0.2px rgba(0, 0, 0, 0.15) inset,
        0px 1px 1px 0px rgba(255, 255, 255, 0.15) inset;
      box-shadow:
        0px 0px 0px 0.2px color(display-p3 0 0 0 / 0.15) inset,
        0px 1px 1px 0px color(display-p3 1 1 1 / 0.15) inset;
      :global(.dark) & {
        box-shadow:
          0px 0px 0px 0.2px rgba(255, 255, 255, 0.15) inset,
          0px 1px 1px 0px rgba(255, 255, 255, 0.15) inset;
        box-shadow:
          0px 0px 0px 0.2px color(display-p3 255 255 255 / 0.15) inset,
          0px 1px 1px 0px color(display-p3 255 255 255 / 0.15) inset;
      }
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
    border-top-right-radius: 8px;
  }
</style>
