<script lang="ts">
  import { useLogScope, wait } from '@horizon/utils'
  import { createEventDispatcher, onDestroy, onMount, setContext } from 'svelte'
  import { get, writable } from 'svelte/store'
  import { useTelemetry } from '../../../service/telemetry'
  import { OasisSpace, useOasis } from '../../../service/oasis'
  import { useToasts } from '../../../service/toast'
  import { HTMLDragZone } from '@horizon/dragcula'
  import { useHomescreen } from './homescreen'
  import {
    ChangeContextEventTrigger,
    RemoveHomescreenItemEventTrigger,
    UpdateHomescreenEventAction
  } from '@horizon/types'
  import HomescreenItem from './HomescreenItem.svelte'
  import { useMiniBrowserService } from '../../../service/miniBrowser'
  import MiniBrowser from '../../MiniBrowser/MiniBrowser.svelte'
  import { useTabsManager } from '../../../service/tabs'
  import { contextMenu } from '../../Core/ContextMenu.svelte'
  import { useConfig } from '../../../service/config'
  import { HomescreenController, type GridRect } from './homescreenController'

  export let newTabOverlayState: number = 0

  const log = useLogScope('Homescreen')
  const dispatch = createEventDispatcher<{
    'space-selected': OasisSpace
  }>()
  const telemetry = useTelemetry()
  const oasis = useOasis()
  const homescreen = useHomescreen()
  const resourceManager = oasis.resourceManager
  const tabsManager = useTabsManager()
  const toasts = useToasts()
  const miniBrowserService = useMiniBrowserService()
  const scropedMinibrowser = miniBrowserService.createScopedBrowser('homescreen')

  const spaces = oasis.spaces
  const bentoItems = homescreen.bentoItems
  const homescreenVisible = homescreen.visible

  const HOMESCREEN_CONFIG = {
    gap: 10,
    cellSize: 50,

    itemStore: $homescreen.bentoItems
  }

  /// Refs
  let bentoEl: HTMLElement
  $: gridTargetPreview = $homescreenController?.gridTargetPreview
  $: isDrawing = $homescreenController?.isDrawing

  const homescreenController = writable<HomescreenController | null>(null)

  /// Drag Handlers
  async function handleDrawEnd(e: CustomEvent<GridRect>) {
    // NOTE: Disabled for now
    return
    const { cellX, cellY, spanX, spanY } = e.detail
    const resource = await resourceManager.createResourceNote('', {
      name: `Untitled Note ${new Date().toLocaleString()}`
    })
    bentoItems.update((items) => {
      items.push(
        writable({
          id: crypto.randomUUID(),
          cellX: cellX,
          cellY: cellY,
          spanX: spanX,
          spanY: spanY,
          resourceId: resource.id
        })
      )
      return items
    })
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
    if (!scropedMinibrowser) return
    scropedMinibrowser?.openResource(e.detail)
  }

  function handleOpenSpaceAsContext(e: CustomEvent<OasisSpace>) {
    const space = e.detail

    log.debug('open space as context', space)

    tabsManager.changeScope(space.id, ChangeContextEventTrigger.Homescreen)
    homescreen.setVisible(false)
  }

  async function handleSetResourceBackground(e: CustomEvent<string>) {
    const resourceId = e.detail

    homescreen.customization.update((cfg) => {
      cfg.background = `${resourceId}`
      return cfg
    })

    telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.SetBackground)
  }

  function removeAllItemsLinking(to: { resourceId?: string; spaceId?: string }) {
    bentoItems.update((v) => {
      v = v.filter((e) => {
        if (to.resourceId !== undefined && get(e).resourceId === to.resourceId) return false
        if (to.spaceId !== undefined && get(e).spaceId === to.spaceId) return false
        return true
      })
      return v
    })
  }

  function handleResetHomescreen() {
    bentoItems.set([])
  }

  onDestroy(resourceManager.on('deleted', (resourceId) => removeAllItemsLinking({ resourceId })))
  onDestroy(oasis.on('deleted', (spaceId) => removeAllItemsLinking({ spaceId })))

  onMount(async () => {
    // Make sure that all the items on the hoemscreen exists
    for (const _item of get(bentoItems)) {
      const item = get(_item)
      if (item.resourceId !== undefined) {
        const exists = (await resourceManager.getResource(item.resourceId)) !== null
        if (!exists) removeAllItemsLinking({ resourceId: item.resourceId })
      } else if (item.spaceId !== undefined) {
        const exists = (await oasis.getSpace(item.spaceId)) !== null
        if (!exists) {
          removeAllItemsLinking({ spaceId: item.spaceId })
        }
      }
    }

    homescreenController.set(
      new HomescreenController(bentoEl, HOMESCREEN_CONFIG, oasis, tabsManager, toasts, telemetry)
    )

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

<div id="homescreen-wrapper" class:homescreenVisible={$homescreenVisible} style={$$restProps.style}>
  <MiniBrowser service={scropedMinibrowser} />

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    id="homescreen"
    class="no-drag"
    class:drawing={$isDrawing}
    style:--grid_cell_size={HOMESCREEN_CONFIG.cellSize + 'px'}
    style:--grid_gap={HOMESCREEN_CONFIG.gap + 'px'}
    bind:this={bentoEl}
    use:HTMLDragZone.action={{
      accepts: () => true
    }}
    on:DragEnter={(e) => $homescreenController?.handleDragEnter(e)}
    on:DragLeave={(e) => $homescreenController?.handleDragLeave(e)}
    on:DragOver={(e) => $homescreenController?.handleDragOver(e)}
    on:Drop={(e) => $homescreenController?.handleDrop(e)}
    on:mousedown={(e) => $homescreenController?.handleMouseDown(e)}
    on:drawend={(e) => handleDrawEnd(e)}
    use:contextMenu={{
      items: [
        {
          type: 'action',
          icon: 'trash',
          text: 'Reset Homescreen',
          kind: 'danger',
          action: handleResetHomescreen
        }
      ]
    }}
  >
    {#if $gridTargetPreview && $gridTargetPreview.visible}
      <div
        class="drop-preview"
        style:--cellX={$gridTargetPreview.cellX}
        style:--cellY={$gridTargetPreview.cellY}
        style:--spanX={$gridTargetPreview.spanX}
        style:--spanY={$gridTargetPreview.spanY}
      />
    {/if}
    {#if $bentoItems.length === 0}
      <div class="empty-state">
        <h3>Your homescreen is empty</h3>
        <p>Drag and drop tabs or items from your stuff onto here.</p>
      </div>
    {/if}
    {#each $bentoItems as item (get(item))}
      <HomescreenItem
        {item}
        {homescreenController}
        on:remove-from-homescreen={handleRemoveItem}
        on:set-resource-as-background={handleSetResourceBackground}
        on:open-space
        on:click
        on:open={handleOpenItem}
        on:open-and-chat
        on:open-space-as-tab
        on:open-space-as-context={handleOpenSpaceAsContext}
        on:remove
      />
    {/each}
  </div>
</div>

<style lang="scss">
  #homescreen-wrapper {
    position: relative;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;

    --padding: 1em;
    padding: var(--padding, 0);

    contain: strict;

    &:not(.homescreenVisible) {
      //display: none !important;
      visibility: hidden !important;
    }

    > #homescreen {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: clip;
      overflow-clip-margin: 2px;

      &.drawing * {
        transition: none !important;
      }

      .drop-preview {
        mix-blend-mode: difference;
        position: absolute;
        z-index: 5;
        width: calc(var(--spanX) * var(--grid_cell_size) + (var(--spanX) - 1) * var(--grid_gap));
        height: calc(var(--spanY) * var(--grid_cell_size) + (var(--spanY) - 1) * var(--grid_gap));
        background: rgba(200, 200, 200, 0.15);
        border: 2px dashed rgba(126, 126, 126, 0.4);
        border-radius: 0.5em;
        overflow: hidden;

        transition:
          width 0.2s,
          height 0.2s,
          transform 220ms cubic-bezier(0.19, 1, 0.22, 1);

        transform: translate3d(
          calc((var(--cellX) - 1) * var(--grid_cell_size) + (var(--cellX) - 1) * var(--grid_gap)),
          calc((var(--cellY) - 1) * var(--grid_cell_size) + (var(--cellY) - 1) * var(--grid_gap)),
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
      @apply select-none;

      :global(.dark) & {
        background: rgba(0, 0, 0, 0.15);
      }

      h3 {
        font-size: 1.875em;
        font-weight: 500;
        margin: 0 0 0.5em;
        padding: 0.75rem 1.5rem;
        border-radius: 64px;
        background: rgba(255, 255, 255, 0.5);
        @apply text-sky-500/60;

        :global(.dark) & {
          background: rgba(0, 0, 0, 0.5);
          @apply text-sky-500/80;
        }
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
  :global(#homescreen-wrapper .mini-browser-wrapper) {
    padding: var(--padding);
  }

  :global(body:has(#homescreen-wrapper.homescreenVisible) .teletype-motion > .outer-wrapper) {
    pointer-events: none;
  }
</style>
