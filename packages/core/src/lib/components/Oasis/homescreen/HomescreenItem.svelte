<script lang="ts" context="module">
  import { type Writable } from 'svelte/store'
  import { BentoController, BentoItem, type BentoItemData } from './BentoController'
  import { DragTypeNames } from '../../../types'
  import { useOasis } from '../../../service/oasis'
  import { createEventDispatcher, getContext, onMount } from 'svelte'
  import OasisResourceLoader from '../OasisResourceLoader.svelte'
  import { HTMLDragItem } from '@horizon/dragcula'
  import SpacePreview from '../../Resources/SpacePreview.svelte'
  import { CreateTabEventTrigger, UpdateHomescreenEventAction } from '@horizon/types'
  import { useHomescreen } from './homescreen'
  import type { Mode } from '../../Resources/Previews/Preview.svelte'
  import { useTelemetry } from '../../../service/telemetry'
  import { useTabsManager } from '../../../service/tabs'
  import { HomescreenController } from './homescreenController'

  export interface HomescreenItemData extends BentoItemData {
    resourceId?: string
    spaceId?: string

    /// Views
    contentViewMode: 'list' | 'grid'
    contentMode: Mode
  }
</script>

<script lang="ts">
  export let item: Writable<HomescreenItemData>
  export let homescreenController: Writable<HomescreenController>

  //const homescreenController = getContext<Writable<HomescreenController>>('homescreenController')

  const telemetry = useTelemetry()
  const oasis = useOasis()
  const spaces = oasis.spaces
  const resourceManager = oasis.resourceManager
  const tabs = useTabsManager()
  const homescreen = useHomescreen()
  const dispatch = createEventDispatcher<{
    'remove-from-homescreen': string
  }>()

  let bentoItemEl: HTMLElement

  let resizing = false
  function handleResizeMouseDown(direction: 'nw' | 'ne' | 'se' | 'sw'): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      resizing = true
      const init = {
        x: e.clientX,
        y: e.clientY,
        offsetX: 0,
        offsetY: 0
      }

      const handleMouseMove = (e: MouseEvent) => {
        const clientX = e.clientX - $homescreenController.CELL_SIZE / 2
        const clientY = e.clientY - $homescreenController.CELL_SIZE / 2
        const targetCell = $homescreenController.cellAtXY(clientX, clientY)

        item.update((v) => {
          if (direction === 'ne') {
            v.spanX = Math.max(1, targetCell.x - v.cellX + 1)
            v.cellY = targetCell.y + 1
          } else if (direction === 'se') {
            v.spanX = Math.max(1, targetCell.x - v.cellX + 1)
            v.spanY = Math.max(1, targetCell.y - v.cellY + 1)
          } else if (direction === 'sw') {
            v.spanY = targetCell.y - v.cellY + 1
            v.cellX = targetCell.x + 1
          } else if (direction === 'nw') {
          }
          return v
        })
      }
      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault()
        e.stopImmediatePropagation()
        resizing = false
        homescreen.store()

        window.removeEventListener('mousemove', handleMouseMove)
        telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.ResizeItem)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp, { capture: true, once: true })
    }
  }
</script>

<div
  id="homescreen-item-{$item.id}"
  class="homescreen-item item-type-{$item.resourceId ? 'resource' : 'space'}"
  draggable={true}
  style:--cell-x={$item.cellX}
  style:--cell-y={$item.cellY}
  style:--span-x={$item.spanX}
  style:--span-y={$item.spanY}
  bind:this={bentoItemEl}
  use:HTMLDragItem.action={{}}
  on:mouseup={async (e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) return
    if ($item.spaceId !== undefined && e.metaKey) {
      // TODO: oepn backgroun tab
      const _space = await oasis.getSpace($item.spaceId)
      if (_space === null) return
      tabs.addSpaceTab(_space, { active: false, trigger: CreateTabEventTrigger.Homescreen })
    }
  }}
  on:DragStart={async (drag) => {
    drag.data.setData(DragTypeNames.DESKTOP_ITEM, item)
    if ($item.resourceId) {
      const resource = await resourceManager.getResource($item.resourceId)
      drag.data.setData(DragTypeNames.SURF_RESOURCE, resource)
    } else if ($item.spaceId) {
      const space = await oasis.getSpace($item.spaceId)
      drag.data.setData(DragTypeNames.SURF_SPACE, space)
    }
    drag.continue()
  }}
  data-vaul-no-drag
>
  <!--
TODO: Fix resizing logic for other corners
<svg
    class="resize-handle corner top-left"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    on:mousedown={handleResizeMouseDown('nw')}
  >
    <path
      d="M2 18C13 18 18 13 18 2"
      stroke="currentColor"
      stroke-width="var(--stroke-width)"
      stroke-linecap="round"
    />
  </svg>
  <svg
    class="resize-handle corner top-right"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    on:mousedown={handleResizeMouseDown('ne')}
  >
    <path
      d="M2 18C13 18 18 13 18 2"
      stroke="currentColor"
      stroke-width="var(--stroke-width)"
      stroke-linecap="round"
    />
  </svg>
  <svg
    class="resize-handle corner bottom-left"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    on:mousedown={handleResizeMouseDown('sw')}
  >
    <path
      d="M2 18C13 18 18 13 18 2"
      stroke="currentColor"
      stroke-width="var(--stroke-width)"
      stroke-linecap="round"
    />
  </svg>-->
  <svg
    class="resize-handle corner bottom-right"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    on:mousedown={handleResizeMouseDown('se')}
    class:active={resizing}
  >
    <path
      d="M2 18C13 18 18 13 18 2"
      stroke="currentColor"
      stroke-width="var(--stroke-width)"
      stroke-linecap="round"
    />
  </svg>

  <div class="content">
    {#if $item.resourceId}
      <OasisResourceLoader
        resourceOrId={$item.resourceId}
        mode={'responsive'}
        origin="homescreen"
        draggable={false}
        frameless={false}
        interactive={true}
        hideProcessing
        on:set-resource-as-background
        on:click
        on:open
        on:open-and-chat
        on:remove-from-homescreen={() => {
          dispatch('remove-from-homescreen', $item.id)
        }}
      />
    {:else if $item.spaceId}
      {@const space = $spaces.find((s) => s.id === $item.spaceId)}
      <SpacePreview
        {space}
        mode="container"
        contentViewMode={$item.contentViewMode}
        contentMode={$item.contentMode}
        renderContents={$item.spanX > 2 && $item.spanY > 2}
        interactive={true}
        draggable={false}
        on:change-space-view-mode={(e) => {
          $item.contentViewMode = e.detail
          homescreen.store()
        }}
        on:set-resource-as-background
        on:open
        on:open-space
        on:open-and-chat
        on:open-space-as-tab
        on:remove-from-homescreen={() => {
          dispatch('remove-from-homescreen', $item.id)
        }}
      />
    {/if}
  </div>
</div>

<style lang="scss">
  :global(html:has(.resize-handle.active)) {
    cursor: nwse-resize !important;
  }
  .homescreen-item {
    --background: #fff;
    :global(.dark) & {
      --background: #1f2937;
      --text-color: #fff;
    }

    position: relative;
    //overflow: hidden;
    //isolation: isolate;

    grid-column: var(--cell-x) / span var(--span-x);
    grid-row: var(--cell-y) / span var(--span-y);

    border-radius: 1em;
    border: 1px solid rgba(0, 0, 0, 0.1);

    --content-padding: 0.4em;

    font-size: 0.85em;

    &:not(:hover) :global(*) {
      user-select: none !important;
    }

    > .content {
      width: 100%;
      height: 100%;
    }

    &:global([data-dragging-item]) {
      opacity: 0.4;
    }
    &:global([data-dragging-item][data-drag-preview]) {
      opacity: 0.9;
    }

    &.item-type-resource {
      &:global(.resource-preview .image) {
        flex-direction: row !important;
      }
      > .content {
        > :global(.wrapper) {
          height: 100%;

          :global(.media) {
            object-fit: cover;
            max-height: unset !important;
            :global(img) {
              object-fit: cover;
              height: 100% !important;
            }
          }

          > :global(.resource-preview) {
            height: 100%;
            > :global(.preview) {
              height: 100%;

              & :global(.inner) {
                height: 100%;
                justify-content: space-between;
              }
            }
          }
        }
      }
    }

    &.item-type-space {
      background: var(--background);
      border-radius: 1.1em;
      border: 1px solid rgba(50, 50, 50, 0.075);
      box-shadow:
        0 0 0 1px rgba(50, 50, 93, 0.06),
        0 2px 5px 0 rgba(50, 50, 93, 0.04),
        0 1px 1.5px 0 rgba(0, 0, 0, 0.01);
      overflow: hidden;
      outline: 0px solid transparent;

      &:not(.frameless):hover {
        outline: 2px solid rgba(50, 50, 50, 0.175);
      }

      &:global(.selected) {
        outline: 3px solid rgba(0, 123, 255, 0.4) !important;
      }

      :global(.dark) & {
        border-color: rgba(250, 250, 250, 0.075);
        box-shadow:
          0 0 0 1px rgba(205, 205, 161, 0.06),
          0 2px 5px 0 rgba(205, 205, 161, 0.04),
          0 1px 1.5px 0 rgba(255, 255, 255, 0.01);

        &:not(.frameless):hover {
          outline-color: rgba(250, 250, 250, 0.2);
        }

        &:global(.selected) {
          outline-color: rgba(10, 143, 255, 0.4) !important;
        }
      }
    }

    > .resize-handle {
      color: rgb(255, 255, 255);
      mix-blend-mode: difference;
      opacity: 0;
      transition:
        opacity 150ms ease-out,
        color 150ms ease-out;
      &:hover {
        color: rgb(140, 140, 140);
        opacity: 1;
      }
      &.active {
        color: rgb(70 70 70);
        opacity: 1;
      }

      &.corner {
        position: absolute;
        z-index: 10;

        --offset: 35%;
        --stroke-width: 4;

        &.top-left {
          top: 0;
          left: 0;
          transform: translate(calc(-1 * var(--offset)), calc(-1 * var(--offset))) rotate(180deg);
          cursor: nwse-resize;
        }
        &.top-right {
          top: 0;
          right: 0;
          transform: translate(var(--offset), calc(-1 * var(--offset))) rotate(-90deg);
          cursor: nesw-resize;
        }
        &.bottom-right {
          bottom: 0;
          right: 0;
          transform: translate(var(--offset), var(--offset));
          cursor: nwse-resize;
        }
        &.bottom-left {
          bottom: 0;
          left: 0;
          transform: translate(calc(-1 * var(--offset)), var(--offset)) rotate(90deg);
          cursor: nesw-resize;
        }
      }
    }
  }
</style>
