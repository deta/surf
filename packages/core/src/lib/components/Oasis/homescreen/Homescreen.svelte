<script lang="ts">
  import { useLogScope } from '@horizon/utils'
  import { createEventDispatcher, onDestroy, onMount, setContext, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { useTelemetry } from '../../../service/telemetry'
  import { OasisSpace, useOasis } from '../../../service/oasis'
  import { HTMLDragZone } from '@horizon/dragcula'
  import HomescreenItem from './HomescreenItem.svelte'
  import MiniBrowser from '../../MiniBrowser/MiniBrowser.svelte'
  import { contextMenu } from '../../Core/ContextMenu.svelte'
  import { DesktopService, useDesktopManager } from '../../../service/desktop'
  import type { GridRect } from '../../../types/desktop.types'
  import { ChangeContextEventTrigger, OpenInMiniBrowserEventFrom } from '@horizon/types'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { clamp } from '../../../../../../dragcula/dist/utils/internal'

  export let desktop: DesktopService
  export let newTabOverlayState: number = 0

  const log = useLogScope('Homescreen')
  const dispatch = createEventDispatcher<{
    'space-selected': OasisSpace
  }>()
  const telemetry = useTelemetry()
  const oasis = useOasis()
  const toasts = useToasts()
  const desktopManager = useDesktopManager()
  const resourceManager = oasis.resourceManager

  const items = desktop.items
  const desktopVisible = desktopManager.activeDesktopVisible
  const miniBrowser = desktop.miniBrowser

  /// Refs
  let desktopEl: HTMLElement
  const gridTargetPreview = desktop.gridTargetPreview

  /// Drag Handlers
  async function handleDrawEnd(e: CustomEvent<GridRect>) {
    // NOTE: Disabled for now
  }

  async function handleOpenItem(e: CustomEvent) {
    miniBrowser.openResource(e.detail, { from: OpenInMiniBrowserEventFrom.Homescreeen })
  }

  async function handleOpenSpaceAsContext(e: CustomEvent<OasisSpace>) {
    const space = e.detail

    log.debug('open space as context', space)

    // Make the currently active tab in the current context not active so the user lands back on the homescreen when they come back
    desktopManager.tabsManager.removeActiveTabFromScopedActiveTabs()
    await desktopManager.tabsManager.changeScope(space.id, ChangeContextEventTrigger.Homescreen)
  }

  function removeAllItemsLinking(to: { resourceId?: string; spaceId?: string }) {
    items.update((v) => {
      v = v.filter((e) => {
        if (to.resourceId !== undefined && get(e).resourceId === to.resourceId) return false
        if (to.spaceId !== undefined && get(e).spaceId === to.spaceId) return false
        return true
      })
      return v
    })
    desktop.store()
  }

  function handleResetHomescreen() {
    const confirmed = confirm(
      `Are you sure you want to reset your Desktop layout? This can't be undone. Your resources won't be deleted.`
    )
    if (!confirmed) return
    desktop.setBackgroundImage(undefined)
    items.set([])
    desktop.store()
    toasts.success('Desktop reset successfully!')
  }

  function handleResetBackgroundImage() {
    const confirmed = confirm(
      `Are you sure you want to reset your background? This can't be undone.`
    )
    if (!confirmed) return
    desktop.setBackgroundImage(undefined)
    desktop.store()
    toasts.success('Background reset successfully!')
  }

  onMount(async () => {
    // Make sure that all the items on the hoemscreen exists
    for (const _item of get(items)) {
      const item = get(_item)
      if (item.type === 'resource') {
        const exists = (await resourceManager.getResource(item.resourceId)) !== null
        if (!exists) removeAllItemsLinking({ resourceId: item.resourceId })
      } else if (item.type === 'space') {
        const exists = (await oasis.getSpace(item.spaceId)) !== null
        if (!exists) {
          removeAllItemsLinking({ spaceId: item.spaceId })
        }
      }
    }

    desktop.attachNode(desktopEl)
  })
</script>

<svelte:document
  on:keydown={(e) => {
    if ($desktopVisible && newTabOverlayState === 0 && e.key === 'Escape') {
      miniBrowser?.close()
    }
  }}
/>

<div id="homescreen-wrapper" class:homescreenVisible={$desktopVisible} style={$$restProps.style}>
  {#key miniBrowser.key}
    <MiniBrowser service={miniBrowser} />
  {/key}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    id="homescreen"
    class="no-drag"
    style:--grid_cell_size={desktop.CELL_SIZE + 'px'}
    style:--grid_gap={desktop.CELL_GAP + 'px'}
    bind:this={desktopEl}
    use:HTMLDragZone.action={{
      accepts: () => true
    }}
    on:DragEnter={(e) => desktop.handleDragEnter(e)}
    on:DragLeave={(e) => desktop.handleDragLeave(e)}
    on:DragOver={(e) => desktop.handleDragOver(e)}
    on:Drop={(e) => desktop.handleDrop(e)}
    on:mousedown={(e) => desktop.handleMouseDown(e)}
    on:drawend={(e) => handleDrawEnd(e)}
    use:contextMenu={{
      items: [
        {
          type: 'action',
          icon: 'close',
          text: 'Remove Background',
          kind: 'danger',
          action: handleResetBackgroundImage
        },
        {
          type: 'action',
          icon: 'trash',
          text: 'Reset Desktop',
          kind: 'danger',
          action: handleResetHomescreen
        }
      ]
    }}
  >
    {#if $gridTargetPreview && $gridTargetPreview.visible}
      <div
        class="drop-preview"
        style:--cellX={clamp($gridTargetPreview.x, 1, Infinity)}
        style:--cellY={clamp($gridTargetPreview.y, 1, Infinity)}
        style:--spanX={$gridTargetPreview.width}
        style:--spanY={$gridTargetPreview.height}
      />
    {/if}
    {#if $items.length === 0}
      <div class="empty-state">
        <h3>Your homescreen is empty</h3>
        <p>Drag and drop tabs or items from your stuff onto here.</p>
      </div>
    {/if}
    {#each $items as item (get(item))}
      <HomescreenItem
        {desktop}
        {item}
        on:remove-from-homescreen={(e) => desktop.removeItem(e.detail)}
        on:set-resource-as-background={(e) => desktop.setBackgroundImage(e.detail)}
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

    contain: strict;

    --base-padding: 1.5em;
    :global(.verticalTabs) & {
      padding: var(--base-padding);
      padding-left: calc(var(--left-sidebar-size) + var(--base-padding));
    }
    :global(.verticalTabs:not(.showLeftSidebar)) & {
      padding-left: var(--base-padding) !important;
    }

    :global(.horizontalTabs) & {
      padding: 1.5em;
      padding-top: calc(var(--left-sidebar-size) + var(--base-padding));
    }
    :global(.horizontalTabs:not(.showLeftSidebar)) & {
      padding-top: var(--base-padding) !important;
    }

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
      isolation: isolate;

      display: grid;
      grid-template-columns: repeat(
        auto-fill,
        minmax(var(--grid_cell_size, 50px), var(--grid_cell_size, 50px))
      );
      grid-auto-rows: var(--grid_cell_size, 50px);
      gap: var(--grid_gap, 10px);

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
        :global(.custom) & {
          background: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 0%, 0.2)) !important;
          color: var(--contrast-color) !important;
        }
        :global(.dark.custom) & {
          background: color-mix(in hsl, var(--custom-color), hsla(0, 80%, 50%, 0.65)) !important;
          color: var(--contrast-color) !important;
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

        :global(.custom) & {
          color: var(--contrast-color) !important;
        }
        :global(.dark.custom) & {
          color: var(--contrast-color) !important;
        }
      }
    }
  }

  :global(#homescreen-wrapper > .modal) {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }
  :global(.verticalTabs.showLeftSidebar #homescreen-wrapper > .modal) {
    left: var(--left-sidebar-size) !important;
  }

  :global(.horizontalTabs.showLeftSidebar #homescreen-wrapper > .modal) {
    top: var(--left-sidebar-size) !important;
  }

  :global(.showRightSidebar #homescreen-wrapper > .modal) {
    right: var(--right-sidebar-size) !important;
  }

  :global(body:has(#homescreen-wrapper.homescreenVisible) .teletype-motion > .outer-wrapper) {
    pointer-events: none;
  }
</style>
