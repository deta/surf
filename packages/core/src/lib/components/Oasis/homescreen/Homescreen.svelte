<script lang="ts">
  import { useLogScope, wait } from '@horizon/utils'
  import { createEventDispatcher, onMount } from 'svelte'
  import { get, writable } from 'svelte/store'
  import { useTelemetry } from '../../../service/telemetry'
  import { useOasis } from '../../../service/oasis'
  import { useToasts } from '../../../service/toast'
  import type { Resource } from '../../../service/resources'
  import { BentoController } from './BentoController'
  import { blobToDataUrl } from '../../../utils/screenshot'
  import { DragculaDragEvent, HTMLDragZone } from '@horizon/dragcula'
  import { DragTypeNames, type Space } from '../../../types'
  import { useHomescreen } from './homescreen'
  import LazyComponent from '../../Atoms/LazyComponent.svelte'
  import { createResourcesFromMediaItems, processDrop } from '../../../service/mediaImporter'
  import {
    AddHomescreenItemEventTrigger,
    AddHomescreenItemEventSource,
    EventContext,
    RemoveHomescreenItemEventTrigger,
    ResourceTagsBuiltInKeys,
    SaveToOasisEventTrigger,
    UpdateHomescreenEventAction
  } from '@horizon/types'
  import HomescreenItem from './HomescreenItem.svelte'
  import { useMiniBrowserService } from '../../../service/miniBrowser'
  import MiniBrowser from '../../MiniBrowser/MiniBrowser.svelte'
  import { useTabsManager } from '../../../service/tabs'

  export let newTabOverlayState: number = 0

  const log = useLogScope('Homescreen')
  const dispatch = createEventDispatcher<{
    'space-selected': Space
  }>()
  const telemetry = useTelemetry()
  const oasis = useOasis()
  const toast = useToasts()
  const homescreen = useHomescreen()
  const resourceManager = oasis.resourceManager
  const tabsManager = useTabsManager()
  const miniBrowserService = useMiniBrowserService()
  const scropedMinibrowser = miniBrowserService.createScopedBrowser('homescreen')
  const toasts = useToasts()

  const spaces = oasis.spaces
  const bentoItems = homescreen.bentoItems
  const customization = homescreen.customization

  const BENTO_CONFIG = {
    height: 348,
    PADDING: 20,
    GAP: 10,
    CELL_SIZE: 100,
    items: $homescreen.bentoItems
  }

  /// Refs
  let bentoEl: HTMLElement
  let bentoController: BentoController<any>

  /// DND Preview
  // TODO: (maxu) replace with uodate in raf, not reactive
  let dropTargetPreview = writable({
    visible: false,
    cellX: 1,
    cellY: 1,
    spanX: 2,
    spanY: 2
  })

  /// Drag Handlers

  function handleDragEnter(drag: DragculaDragEvent) {
    const overCellXY = bentoController.getCellAt(drag.event.x, drag.event.y)
    dropTargetPreview.update((o) => {
      o.cellX = overCellXY.cellX
      o.cellY = overCellXY.cellY
      return o
    })

    $dropTargetPreview.visible = true

    if (!drag.isNative && drag.data?.hasData(DragTypeNames.BENTO_ITEM)) {
      const item = drag.data?.getData(DragTypeNames.BENTO_ITEM)
      $dropTargetPreview.spanX = get(item).spanX
      $dropTargetPreview.spanY = get(item).spanY
    }
  }
  function handleDragLeave(drag: DragculaDragEvent) {
    $dropTargetPreview.visible = false
  }
  function handleDragOver(drag: DragculaDragEvent) {
    const overCellXY = bentoController.getCellAt(drag.event.x, drag.event.y)
    dropTargetPreview.update((o) => {
      o.cellX = overCellXY.cellX
      o.cellY = overCellXY.cellY
      return o
    })
  }
  async function handleDrop(drag: DragculaDragEvent) {
    $dropTargetPreview.visible = false

    let source: AddHomescreenItemEventSource | undefined
    if (drag.isNative) source = AddHomescreenItemEventSource.NativeDrop
    else if (drag.from?.id.startsWith('drawer')) source = AddHomescreenItemEventSource.Stuff
    else if (drag.from?.id.startsWith('sidebar')) source = AddHomescreenItemEventSource.Tabs
    else if (drag.from?.id.startsWith('stuff-stack')) source = AddHomescreenItemEventSource.Stack
    else if (drag.from?.id.startsWith('magic-chat')) source = AddHomescreenItemEventSource.Chat
    // TODO: command menu when we allow dragigng from there

    if (drag.isNative) {
      const parsed = await processDrop(drag.event!)
      log.debug('Parsed', parsed)

      const newResources = await createResourcesFromMediaItems(resourceManager, parsed, '')
      log.debug('Resources', newResources)

      bentoItems.update((items) => {
        for (const resource of newResources) {
          items.push(
            writable({
              id: crypto.randomUUID(),
              cellX: $dropTargetPreview.cellX,
              cellY: $dropTargetPreview.cellY,
              spanX: $dropTargetPreview.spanX,
              spanY: $dropTargetPreview.spanY,
              resourceId: resource.id
            })
          )

          telemetry.trackAddHomescreenItem(AddHomescreenItemEventTrigger.Drop, 'resource', source)
          telemetry.trackSaveToOasis(
            resource.type,
            SaveToOasisEventTrigger.Drop,
            false,
            EventContext.Homescreen
          )
        }
        return items
      })

      drag.continue()
      return
    }

    // NOTE: For convenience we only remove the old item and let it create a new one below
    // Need to re-write bento item logic better to just update the existing one

    let movingItem = false // Flag to disable tracking the drop afterwards if the items was mvoed only
    if (drag.data?.hasData(DragTypeNames.BENTO_ITEM)) {
      const item = drag.data?.getData(DragTypeNames.BENTO_ITEM)
      bentoItems.update((items) => {
        items = items.filter((i) => get(i).id !== get(item).id)
        return items
      })
      telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.MoveItem)
      movingItem = true
    }

    if (
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE_ID)
    ) {
      let resource: Resource | null = null
      if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
        resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
      } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
        const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
        resource = await resourceFetcher()
      } else if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE_ID)) {
        const resourceId = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE_ID)
        resource = await resourceManager.getResource(resourceId)
      }

      if (resource === null) {
        log.warn('Dropped resource but resource is null! Aborting drop!')
        drag.abort()
        return
      }

      // Make resource visible if it was silent
      const isSilent = (resource.tags ?? []).some(
        (tag) => tag.name === ResourceTagsBuiltInKeys.SILENT
      )

      if (isSilent) {
        await resourceManager.deleteResourceTag(resource.id, ResourceTagsBuiltInKeys.SILENT)
        oasis.reloadStack()
      }

      bentoItems.update((items) => {
        items.push(
          writable({
            id: crypto.randomUUID(),
            cellX: $dropTargetPreview.cellX,
            cellY: $dropTargetPreview.cellY,
            spanX: $dropTargetPreview.spanX,
            spanY: $dropTargetPreview.spanY,
            resourceId: resource.id
          })
        )
        return items
      })
      if (!movingItem)
        telemetry.trackAddHomescreenItem(AddHomescreenItemEventTrigger.Drop, 'resource', source)
    } else if (drag.data?.hasData(DragTypeNames.SURF_SPACE)) {
      const space = drag.data!.getData(DragTypeNames.SURF_SPACE)
      bentoItems.update((items) => {
        items.push(
          writable({
            id: crypto.randomUUID(),
            cellX: $dropTargetPreview.cellX,
            cellY: $dropTargetPreview.cellY,
            spanX: $dropTargetPreview.spanX,
            spanY: $dropTargetPreview.spanY,
            spaceId: space.id
          })
        )
        return items
      })
      if (!movingItem)
        telemetry.trackAddHomescreenItem(AddHomescreenItemEventTrigger.Drop, 'space', source)
    } else if (drag.data?.hasData(DragTypeNames.SURF_TAB)) {
      // NOTE: We already checked for resource so we force save the tab in this case as no resource
      // is attached
      const tab = drag.data.getData(DragTypeNames.SURF_TAB)

      // TODO: We dont have any way to easily call a function & get the resource crated :')
      // All just dispatched to Browser.svelte but cannot get resource returnd
      // We should have this common behavior in some service

      if (!get(tabsManager.activatedTabs).includes(tab.id)) {
        tabsManager.activatedTabs.update((tabs) => {
          return [...tabs, tab.id]
        })

        // give the tab some time to load
        await wait(200)
      }
      const browserTab = get(tabsManager.browserTabs)[tab.id]
      if (!browserTab) {
        log.error('Browser tab not found', tab.id)
        throw Error(`Browser tab not found`)
      }

      const toast = toasts.loading('Pinning item to homescreen...')
      let resource: Resource
      try {
        resource = await browserTab.bookmarkPage({
          freshWebview: true,
          silent: true
        })
      } catch (e) {
        toast.dismiss()
        toasts.error('Failed to pin item to homescreen')
        throw e
      }
      toast.dismiss()

      await telemetry.trackSaveToOasis(resource.type, SaveToOasisEventTrigger.Homescreen, false)

      bentoItems.update((items) => {
        items.push(
          writable({
            id: crypto.randomUUID(),
            cellX: $dropTargetPreview.cellX,
            cellY: $dropTargetPreview.cellY,
            spanX: $dropTargetPreview.spanX,
            spanY: $dropTargetPreview.spanY,
            resourceId: resource.id
          })
        )
        return items
      })

      if (!movingItem)
        telemetry.trackAddHomescreenItem(AddHomescreenItemEventTrigger.Drop, 'resource', source)
    }

    $dropTargetPreview.spanX = 2
    $dropTargetPreview.spanY = 2
    //bentoController.reflowItems($bentoItems)
    drag.continue()
  }

  function handleRemoveItem(e: CustomEvent<string>) {
    const itemId = e.detail
    bentoItems.update((items) => {
      items = items.filter((i) => get(i).id !== itemId)
      return items
    })
    telemetry.trackRemoveHomescreenItem(RemoveHomescreenItemEventTrigger.ContextMenu)
  }

  async function handleOpenItem(e: CustomEvent) {
    console.warn('Open item', e.detail)
    if (!scropedMinibrowser) return
    scropedMinibrowser?.openResource(e.detail)
  }
  async function handleSetResourceBackground(e: CustomEvent<string>) {
    const resourceId = e.detail
    const resource = await resourceManager.getResource(resourceId)

    const MAX_SIZE = 2 * 1000 * 1000 // 2MB but with room for error

    let dataUrl = ''
    if (resource && resource.type.startsWith('image/')) {
      const blob = resource.rawData as Blob
      if (blob.size <= MAX_SIZE) {
        dataUrl = await blobToDataUrl(blob)
      } else {
        toast.error('Image size exceeds 2MB limit')
        return
      }
    } else {
      const imgUrl = resource?.parsedData?.image
      if (imgUrl) {
        dataUrl = await window.api.fetchAsDataURL(imgUrl)
      }
    }
    homescreen.customization.update((cfg) => {
      cfg.background = `url(${dataUrl})`
      return cfg
    })

    telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.SetBackground)
  }

  onMount(() => {
    bentoController = bentoEl.bentoController

    window.api.onResetBackgroundImage(() => {
      homescreen.customization.update((cfg) => {
        cfg.background = ''
        return cfg
      })
    })
  })
</script>

<svelte:document
  on:keydown={(e) => {
    if (get(homescreen.visible) && newTabOverlayState === 0 && e.key === 'Escape') {
      scropedMinibrowser?.close()
    }
  }}
/>

<div
  id="homescreen-wrapper"
  class="no-drag"
  style:--background={$customization.background}
  style={$$restProps.style}
>
  <MiniBrowser service={scropedMinibrowser} />

  <div
    id="homescreen"
    style:--bento_gap={BENTO_CONFIG.GAP + 'px'}
    style:--bento_cell_size={BENTO_CONFIG.CELL_SIZE + 'px'}
    bind:this={bentoEl}
    use:BentoController.action={{
      config: BENTO_CONFIG
    }}
    use:HTMLDragZone.action={{
      accepts: () => true
    }}
    on:DragEnter={handleDragEnter}
    on:DragLeave={handleDragLeave}
    on:DragOver={handleDragOver}
    on:Drop={handleDrop}
  >
    {#if $dropTargetPreview.visible}
      <div
        class="drop-preview"
        style:--cellX={$dropTargetPreview.cellX + 1}
        style:--cellY={$dropTargetPreview.cellY + 1}
        style:--spanX={$dropTargetPreview.spanX}
        style:--spanY={$dropTargetPreview.spanY}
      />
    {/if}
    {#if $bentoItems.length === 0}
      <div class="empty-state">
        <h3>Your homescreen is empty</h3>
        <p>Drag and drop tabs or items from your stuff onto here.</p>
      </div>
    {/if}
    {#each $bentoItems as item (get(item).id)}
      <HomescreenItem
        {item}
        on:remove-from-homescreen={handleRemoveItem}
        on:set-resource-as-background={handleSetResourceBackground}
        on:select-space={(e) =>
          dispatch(
            'space-selected',
            $spaces.find((s) => s.id === e.detail)
          )}
        on:click
        on:open={handleOpenItem}
        on:open-and-chat
        on:open-space-as-tab
        on:remove
      />
      <!-- NOTE: Not using anymore as HomescreenItem wont be included in the final build correctly. Still might beuseful later if fixed, so keeping it for now -->
      <!--<LazyComponent this={() => import('./HomescreenItem.svelte')}>
        <svelte:fragment slot="component" let:Component>
          <Component
            {item}
            on:remove-from-homescreen={handleRemoveItem}
            on:set-resource-as-background={handleSetResourceBackground}
            on:select-space={(e) =>
              dispatch(
                'space-selected',
                $spaces.find((s) => s.id === e.detail)
              )}
            on:click
            on:open
            on:open-and-ohat
            on:open-space-as-tab
            on:remove
          />
        </svelte:fragment>
      </LazyComponent>-->
    {/each}
  </div>
</div>

<style lang="scss">
  :global(.app-contents.horizontalTabs.showLeftSidebar #homescreen-wrapper .mini-browser-wrapper) {
    top: var(--left-sidebar-height, 0);
    height: unset;
    padding-top: 4rem;
  }
  :global(.app-contents.horizontalTabs.showRightSidebar #homescreen-wrapper .mini-browser-wrapper) {
    right: var(--right-sidebar-size, 0);
    width: unset;
  }

  :global(
      .app-contents:not(.horizontalTabs).showLeftSidebar #homescreen-wrapper .mini-browser-wrapper
    ) {
    left: var(--left-sidebar-size, 0);
    width: unset;
  }
  :global(
      .app-contents:not(.horizontalTabs).showRightSidebar #homescreen-wrapper .mini-browser-wrapper
    ) {
    right: var(--right-sidebar-size, 0);
    width: unset;
  }
  #homescreen-wrapper {
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;

    padding: var(--padding, 0);

    //background-image: radial-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 1)),var(--background);
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    background-image: var(--background);

    > #homescreen {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      overflow-y: auto;

      .drop-preview {
        mix-blend-mode: difference;
        position: absolute;
        z-index: 5;
        width: calc(var(--spanX) * var(--bento_cell_size) + (var(--spanX) - 1) * var(--bento_gap));
        height: calc(var(--spanY) * var(--bento_cell_size) + (var(--spanY) - 1) * var(--bento_gap));
        background: rgba(200, 200, 200, 0.21);
        border: 2px dashed rgba(255, 255, 255, 0.9);
        border-radius: 0.5em;
        overflow: hidden;

        transition:
          width 0.2s,
          height 0.2s,
          transform 60ms ease-out;

        transform: translate3d(
          calc((var(--cellX) - 1) * var(--bento_cell_size) + (var(--cellX) - 1) * var(--bento_gap)),
          calc((var(--cellY) - 1) * var(--bento_cell_size) + (var(--cellY) - 1) * var(--bento_gap)),
          0px
        );
      }
    }

    .empty-state {
      position: absolute;
      flex-direction: column;
      width: 100%;
      height: 100%;
      display: flex;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.15);
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(10px);
      text-align: center;
      h3 {
        font-size: 1.875em;
        font-weight: 500;
        margin: 0 0 0.5em;
        padding: 0.75rem 1.5rem;
        border-radius: 64px;
        background: rgba(255, 255, 255, 0.5);
        @apply text-sky-500/60;
      }

      p {
        font-size: 1.2em;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.5;
        max-width: 400px;
        text-wrap: pretty;
        @apply text-sky-600/80;
      }
    }
  }
</style>
