<script lang="ts" context="module">
  import { type Writable } from 'svelte/store'
  import { BentoController, BentoItem, type BentoItemData } from './BentoController'
  import { DragTypeNames } from '../../../types'
  import { useOasis } from '../../../service/oasis'
  import { createEventDispatcher, onMount } from 'svelte'
  import OasisResourceLoader from '../OasisResourceLoader.svelte'
  import { HTMLDragItem } from '@horizon/dragcula'
  import SpacePreview from '../../Resources/SpacePreview.svelte'
  import { CreateTabEventTrigger, UpdateHomescreenEventAction } from '@horizon/types'
  import { useHomescreen } from './homescreen'
  import type { Mode } from '../../Resources/Previews/Preview.svelte'
  import { useTelemetry } from '../../../service/telemetry'
  import { useTabsManager } from '../../../service/tabs'

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
  let bentoItem: BentoItem

  function handleResizeMouseDown(direction: 'nw' | 'ne' | 'se' | 'sw'): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      // TODO: This should be generic parent?
      const bentoController = document.querySelector('#homescreen')
        .bentoController as BentoController<any>

      e.preventDefault()
      e.stopImmediatePropagation()
      const init = {
        x: e.clientX,
        y: e.clientY,
        offsetX: 0,
        offsetY: 0
      }

      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - init.x
        const dy = e.clientY - init.y

        const clientX = e.clientX - bentoController.CELL_SIZE / 2
        const clientY = e.clientY - bentoController.CELL_SIZE / 2
        const targetCell = bentoController.getCellAt(clientX, clientY)

        if (direction === 'ne') {
          bentoItem.spanX = Math.max(1, targetCell.cellX - bentoItem.cellX + 1)
          bentoItem.cellY = targetCell.cellY + 1
        } else if (direction === 'se') {
          bentoItem.spanX = Math.max(1, targetCell.cellX - bentoItem.cellX + 1)
          bentoItem.spanY = Math.max(1, targetCell.cellY - bentoItem.cellY + 1)
        } else if (direction === 'sw') {
          bentoItem.spanY = targetCell.cellY - bentoItem.cellY + 1
          bentoItem.cellX = targetCell.cellX + 1
        } else if (direction === 'nw') {
        }
      }
      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault()
        e.stopImmediatePropagation()
        homescreen.store()
        e.target.classList.remove('active')

        window.removeEventListener('mousemove', handleMouseMove)
        telemetry.trackUpdateHomescreen(UpdateHomescreenEventAction.ResizeItem)
      }

      e.target.classList.add('active')

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp, { capture: true, once: true })
    }
  }

  onMount(() => {
    bentoItem = bentoItemEl.bentoItem
  })
</script>

<div
  id="homescreen-item-{$item.id}"
  class="homescreen-item item-type-{$item.resourceId ? 'resource' : 'space'}"
  draggable={true}
  bind:this={bentoItemEl}
  use:BentoItem.action={{ data: item }}
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
    drag.data.setData(DragTypeNames.BENTO_ITEM, item)
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
        frameless={true}
        interactive={true}
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
  .homescreen-item {
    position: relative;
    //overflow: hidden;
    isolation: isolate;

    border-radius: 1em;
    border: 1px solid rgba(0, 0, 0, 0.1);

    --content-padding: 0.4em;

    font-size: 0.85em;

    > .content {
      overflow: hidden;
      width: 100%;
      height: 100%;
      border-radius: 1em;
    }

    &:global([data-dragging-item]) {
      opacity: 0.4;
    }
    &:global([data-dragging-item][data-drag-preview]) {
      opacity: 0.9;
    }

    &.item-type-resource {
      &:global(.resource-preview.preview-mode-media .image) {
        flex-direction: row !important;
      }
      > .content {
        /* NOTE: Should be fixed in the resource previews themselves!! */
        > :global(.wrapper) {
          height: 100%;

          > :global(.resource-preview) {
            height: 100%;
            > :global(.preview) {
              padding: var(--content-padding);
              height: 100%;

              & :global(.inner) {
                height: 100%;
              }

              :global(.image) {
                object-fit: cover;
                max-height: unset !important;
                > :global(img) {
                  object-fit: cover;
                  height: 100%;
                }
              }
            }
          }
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
        color: rgb(70 70 70);
        opacity: 1;
      }
      &:global(:has(.active)) {
        color: rgb(140, 140, 140);
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

    @apply bg-gray-100 dark:bg-gray-800 border-[1px] border-gray-200 dark:border-gray-700;
  }
</style>
