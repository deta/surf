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
  import { openDialog } from '../../Core/Dialog/Dialog.svelte'

  export let desktop: DesktopService
  export let newTabOverlayState: number = 0

  const log = useLogScope('Homescreen')
  const dispatch = createEventDispatcher<{
    'space-selected': OasisSpace
    'open-stuff': void
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

  async function handleResetHomescreen() {
    const { closeType: confirmed } = await openDialog({
      title: 'Reset Desktop',
      message: `This can't be undone. <br>Your resources won't be deleted.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Reset', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    desktop.setBackgroundImage(undefined)
    items.set([])
    desktop.store()
    toasts.success('Desktop reset successfully!')
  }

  async function handleResetBackgroundImage() {
    const { closeType: confirmed } = await openDialog({
      title: 'Remove Background',
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Remove', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    desktop.setBackgroundImage(undefined)
    desktop.store()
    toasts.success('Background reset successfully!')
  }

  function handleOpenStuff() {
    dispatch('open-stuff')
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
    <MiniBrowser service={miniBrowser} on:seekToTimestamp on:highlightWebviewText />
  {/key}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    id="homescreen"
    class="no-drag"
    class:empty={$items.length <= 0 && newTabOverlayState === 0}
    style:--grid_cell_size={desktop.CELL_SIZE + 'px'}
    style:--grid_gap={desktop.CELL_GAP + 'px'}
    data-tooltip-target="desktop-demo"
    bind:this={desktopEl}
    use:HTMLDragZone.action={{
      accepts: () => $desktopVisible
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
        <div class="text">
          <svg
            width="100%"
            height="141"
            viewBox="-70 0 198 121"
            xmlns="http://www.w3.org/2000/svg"
            color="currentColor"
            opacity="0.4"
            stroke-width="4"
            stroke-linecap="round"
          >
            <g fill="none">
              <path
                id="svg_1"
                d="m176.81118,18.18184c-75.48311,4.19185 -132.95322,45.40562 -148,87"
                stroke="currentColor"
              />
              <line
                id="svg_4"
                y2="82.81239"
                x2="28.85533"
                y1="105.10472"
                x1="28.85533"
                stroke="currentColor"
              />
              <line
                id="svg_5"
                y2="94.11079"
                x2="47.59595"
                y1="104.92583"
                x1="28.63045"
                stroke="currentColor"
              />
            </g>
          </svg>
          <h3>Your desktop is empty</h3>
          <p class="mb-3">
            Drag and drop tabs, contexts and other items from your Stuff and almost any place onto
            here.
          </p>
          <p>Place images and gifs and set them as your theme from the context menu.</p>
        </div>
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
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {/each}
  </div>
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  #homescreen-wrapper {
    position: relative;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;

    contain: strict;
    pointer-events: all;

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
    :global(body:has(.vertical-window-bar) :not(.horizontalTabs)) & {
      padding-top: calc(var(--base-padding) + 1.75em) !important;
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
        @include utils.light-dark-custom(
          'contrast-border',
          black,
          white,
          var(--contrast-color),
          var(--contrast-color)
        );

        mix-blend-mode: exclusion;
        position: absolute;
        z-index: 9999999999999;
        width: calc(var(--spanX) * var(--grid_cell_size) + (var(--spanX) - 1) * var(--grid_gap));
        height: calc(var(--spanY) * var(--grid_cell_size) + (var(--spanY) - 1) * var(--grid_gap));
        background: rgba(200, 200, 200, 0.15);
        border: 2px dashed var(--contrast-border);
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
      justify-content: start;
      align-items: end;
      backdrop-filter: blur(10px);
      text-align: center;
      @apply select-none;
      padding: 4rem;
      padding-top: 4rem;
      padding-right: 14rem;

      :global(#app .main.os__windows) & {
        padding-right: 24rem !important;
      }

      :global(body:has(#app-contents.verticalTabs)) & {
        align-items: start;
        justify-content: end;

        .text {
          svg {
            order: 45;
            transform: scale(-1) translate(-1rem, -1rem);
          }
        }
      }

      @apply text-sky-600/80;

      :global(.custom) & {
        color: var(--contrast-color) !important;
      }
      :global(.dark.custom) & {
        color: var(--contrast-color) !important;
      }

      .text {
        display: flex;
        flex-direction: column;
        max-width: 37ch;
      }

      :global(.dark) & {
        background: rgba(0, 0, 0, 0.15);
      }

      h3 {
        font-size: 1.875em;
        font-weight: 500;
        margin: 0 0 0.5em;
        border-radius: 64px;
        // background: rgba(255, 255, 255, 0.5);
        @apply text-sky-500/90;

        :global(.dark) & {
          @apply text-sky-500/80;
        }
        :global(.custom) & {
          color: var(--contrast-color) !important;
        }
        :global(.dark.custom) & {
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
        opacity: 0.85;

        :global(.dark) & {
          opacity: 1;
        }
        :global(.custom) & {
          color: var(--contrast-color) !important;
        }
        :global(.dark.custom) & {
          color: var(--contrast-color) !important;
        }
      }

      button {
        font-size: 1.2em;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.5;
        background: rgba(255, 255, 255, 0.5);
        border: none;
        border-radius: 64px;
        padding: 0.75rem 1.5rem;
        margin-top: 1em;

        transition: all 0.2s ease;
        @apply text-sky-500/60;

        &:hover {
          background: rgba(255, 255, 255, 0.7);
          transform: translateY(-2px);
        }

        :global(.dark) & {
          background: rgba(0, 0, 0, 0.5);
          @apply text-sky-500/80;

          &:hover {
            background: rgba(0, 0, 0, 0.7);
          }
        }

        :global(.custom) & {
          background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.2)) !important;
          color: var(--contrast-color) !important;

          &:hover {
            background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.3)) !important;
          }
        }

        :global(.dark.custom) & {
          background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 50%, 0.65)) !important;
          color: var(--contrast-color) !important;

          &:hover {
            background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 50%, 0.75)) !important;
          }
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

  :global(
      body:has(#homescreen-wrapper.homescreenVisible)
        .teletype-motion
        > .outer-wrapper
        > .inner-wrapper
    ) {
    pointer-events: all;
  }

  :global(#homescreen:has(.homescreen-item.resizing) webview) {
    pointer-events: none !important;
  }
</style>
