<script lang="ts">
  import { useTabs, TabItem } from '@deta/services/tabs'
  import { spawnBoxSmoke } from '@deta/ui/src/lib/components/Effects/index'
  import { Favicon, Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { HTMLDragItem, DragData, Dragcula } from '@deta/dragcula'
  import { DragTypeNames } from '@deta/types'
  import { onMount, onDestroy } from 'svelte'

  let {
    tab,
    active,
    width,
    collapsed = false,
    squished = false,
    showCloseButton = true,
    isResizing = false,
    pinned = false,
    isInPinZone = false
  }: {
    tab: TabItem
    active: boolean
    width?: number
    collapsed?: boolean
    squished?: boolean
    showCloseButton?: boolean
    isResizing?: boolean
    pinned?: boolean
    isInPinZone?: boolean
  } = $props()

  const tabsService = useTabs()
  let isCurrentlyInPinZone = $state(isInPinZone)
  let isDragging = $state(false)

  const title = tab.view.title
  const url = tab.view.url

  function handleClick() {
    tabsService.setActiveTab(tab.id)
  }

  function handleClose(event: MouseEvent) {
    event.stopPropagation()

    const rect = document.getElementById(`tab-${tab.id}`)?.getBoundingClientRect()
    if (rect) {
      spawnBoxSmoke(rect, {
        densityN: 30,
        size: 13,
        cloudPointN: 7
      })
    }

    tabsService.delete(tab.id)
  }

  function handleDragStart() {
    tabsService.setActiveTab(tab.id)
    isDragging = true
  }

  function handleDragEnd() {
    isDragging = false
    isCurrentlyInPinZone = false
  }

  // Monitor drag operations to detect when we're in pin zone
  onMount(() => {
    const dragcula = Dragcula.get()

    // Listen for drag operations to detect pin zone
    const checkPinZone = () => {
      const activeDrag = dragcula.activeDrag
      if (!activeDrag || !isDragging) {
        isCurrentlyInPinZone = false
        return
      }

      // Check if this is the tab being dragged
      const draggedTab = activeDrag.item?.data?.getData(DragTypeNames.SURF_TAB)
      if (!draggedTab || draggedTab.id !== tab.id) {
        isCurrentlyInPinZone = false
        return
      }

      // Check if we're in pin zone (index < 0 or index 0 for unpinned tabs)
      const targetIndex = activeDrag.index ?? tabsService.tabs.length
      const inPinZone = targetIndex < 0 || (targetIndex === 0 && !draggedTab.pinned)

      isCurrentlyInPinZone = inPinZone
    }

    // Check pin zone status during drag operations
    const interval = setInterval(checkPinZone, 50) // Check every 50ms during drag

    onDestroy(() => {
      clearInterval(interval)
    })
  })
</script>

<div
  id="tab-{tab.id}"
  data-tab-id="tab-{tab.id}"
  class="tab-item"
  class:active
  class:collapsed
  class:squished
  class:pinned
  class:in-pin-zone={isCurrentlyInPinZone}
  class:no-transition={isResizing}
  style:--width={`${width ?? '0'}px`}
  onclick={handleClick}
  aria-hidden="true"
  draggable="true"
  use:HTMLDragItem.action={{
    id: `tab-${tab.id}`,
    data: (() => {
      const dragData = new DragData()
      dragData.setData(DragTypeNames.SURF_TAB, tab)
      return dragData
    })()
  }}
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
>
  <!-- Icon slot - always shown -->
  <div class="tab-icon">
    <slot name="icon" {tab} {url} {title}>
      <Favicon url={$url} title={$title} />
    </slot>
  </div>

  <!-- Title slot - conditional based on collapsed/squished state -->
  {#if !collapsed && !squished}
    <div class="tab-title-wrapper">
      <slot name="title" {tab} {title} isInPinZone={isCurrentlyInPinZone}>
        <span class="tab-title typo-tab-title" class:hidden={isCurrentlyInPinZone}>{$title}</span>
      </slot>
    </div>
  {/if}

  <!-- Close button slot - conditional -->
  {#if showCloseButton && !collapsed && !squished}
    <div class="close-button">
      <slot name="close-button" {tab} {handleClose}>
        <Button size="xs" square onclick={handleClose}>
          <Icon name="close" />
        </Button>
      </slot>
    </div>
  {/if}
</div>

<style lang="scss">
  .tab-item {
    position: relative;
    padding: 0.5rem 0.55rem;
    border-radius: 11px;
    user-select: none;
    overflow: hidden;
    display: flex;
    flex-shrink: 0;
    gap: var(--t-2);
    align-items: center;
    width: var(--width, 0px);
    opacity: 1;
    border: 0.5px solid transparent;
    transition:
      background-color 90ms ease-out,
      width 190ms cubic-bezier(0.165, 0.84, 0.44, 1),
      opacity 150ms ease-out;
    app-region: no-drag;
    box-sizing: border-box;
    will-change: width;

    @starting-style {
      width: calc(var(--width, 0px) * 0.5);
      opacity: 0.66;
    }

    &.no-transition {
      transition:
        background-color 90ms ease-out,
        opacity 150ms ease-out;
    }

    &.dragging {
      opacity: 0.5;
      --drag-scale: 0.95;
      z-index: 1000;
    }

    &.active {
      border: 0.5px solid light-dark(#fff, var(--border-subtle-dark));
      background: light-dark(
        radial-gradient(
          290.88% 100% at 50% 0%,
          rgba(237, 246, 255, 0.96) 0%,
          rgba(246, 251, 255, 0.93) 100%
        ),
        radial-gradient(
          290.88% 100% at 50% 0%,
          color-mix(in srgb, var(--surface-elevated-dark) 90%, transparent) 0%,
          color-mix(in srgb, var(--app-background-dark) 85%, transparent) 100%
        )
      );
      box-shadow: light-dark(
        0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
        0 1px 1px 0 #fff inset,
        0 12px 5px 0 #3e4750,
        0 7px 4px 0 rgba(62, 71, 80, 0.01),
        0 3px 3px 0 rgba(62, 71, 80, 0.01),
        0 1px 2px 0 rgba(62, 71, 80, 0.01),
        0 1px 1px 0 #000,
        0 1px 1px 0 rgba(0, 0, 0, 0.01),
        0 1px 1px 0 rgba(0, 0, 0, 0.02),
        0 0 1px 0 rgba(0, 0, 0, 0.04)
      ,
        0 8px 18px var(--shadow-soft-dark));
      .tab-title {
        color: light-dark(var(--on-surface-accent), var(--on-surface-accent-dark));
      }
      color: light-dark(var(--on-surface-accent), var(--on-surface-accent-dark));
    }

    // Pinned tab styles
    &.pinned {
      min-width: 40px;
      max-width: 40px;
      width: 40px !important;
      padding: 0.5rem 0.375rem;
      justify-content: center;

      .tab-title-wrapper {
        display: none; // Hide title for pinned tabs
      }

      .tab-icon {
        margin: 0;
      }

      .close-button {
        display: none; // Hide close button for pinned tabs
      }
    }

    // Pin zone drag preview
    &.in-pin-zone {
      .tab-title {
        opacity: 0.3;
        transition: opacity 200ms ease;
      }
    }

    &.squished {
      width: fit-content;
    }

    &.squished:not(.active) {
      padding: 0.25rem 0;
      width: auto;
      flex-grow: 1;
      min-width: 4px;
      overflow: visible;
      &:hover {
        background: none;
        box-shadow: none;
        &:after {
          content: '';
          position: absolute;
          top: 0;
          left: -25%;
          width: 150%;
          height: 100%;
          background: light-dark(var(--white-60), var(--tab-hover-overlay-dark));
          border-radius: 8px;
          outline: 0.5px solid
            light-dark(var(--white-60), color-mix(in srgb, var(--overlay-light-dark) 65%, transparent));
          z-index: 1;
        }
      }
      .tab-icon {
        position: absolute;
        left: 50%;
        width: 16px;
        height: 16px;
        max-width: 16px;
        max-height: 16px;
        overflow: visible;
        transform: translateX(-50%);
        z-index: 2;
      }
    }

    &:hover {
      .tab-title {
        -webkit-mask-image: linear-gradient(
          to right,
          light-dark(var(--black), var(--white)) calc(100% - 2.5rem),
          transparent calc(100% - 1.25rem)
        );
      }
    }

    &:hover:not(.active) {
    &:hover:not(.active) {
      border-radius: 18px;
      border: 0.5px solid light-dark(#fff, var(--border-subtle-dark));
      background: light-dark(
        radial-gradient(
          290.88% 100% at 50% 0%,
          rgba(237, 246, 255, 0.77) 0%,
          rgba(246, 251, 255, 0.74) 100%
        ),
        radial-gradient(
          290.88% 100% at 50% 0%,
          color-mix(in srgb, var(--surface-elevated-dark) 85%, transparent) 0%,
          color-mix(in srgb, var(--app-background-dark) 70%, transparent) 100%
        )
      );
      box-shadow: light-dark(
        0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
        0 1px 1px 0 #fff inset,
        0 12px 5px 0 #3e4750,
        0 7px 4px 0 rgba(62, 71, 80, 0.01),
        0 3px 3px 0 rgba(62, 71, 80, 0.01),
        0 1px 2px 0 rgba(62, 71, 80, 0.01),
        0 1px 1px 0 #000,
        0 1px 1px 0 rgba(0, 0, 0, 0.01),
        0 1px 1px 0 rgba(0, 0, 0, 0.02),
        0 0 1px 0 rgba(0, 0, 0, 0.04)
      ,
        0 6px 14px var(--shadow-soft-dark));
      transition: none;
    }
        0 12px 5px 0 color(display-p3 0.251 0.2784 0.3098 / 0),
        0 7px 4px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
        0 3px 3px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
        0 1px 2px 0 color(display-p3 0.251 0.2784 0.3098 / 0.01),
        0 1px 1px 0 color(display-p3 0 0 0 / 0),
        0 1px 1px 0 color(display-p3 0 0 0 / 0.01),
        0 1px 1px 0 color(display-p3 0 0 0 / 0.02),
        0 0 1px 0 color(display-p3 0 0 0 / 0.04);
      transition: none;
    }

    &.collapsed {
      justify-content: center;

      .tab-icon {
        margin: 0;
      }
    }

    /* Reveal close button on hover — but not in collapsed state or pinned state */
    &:hover:not(.collapsed):not(.pinned) .close-button {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .tab-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-title-wrapper {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .tab-title {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    -webkit-font-smoothing: subpixel-antialiased;
    text-rendering: optimizeLegibility;
    color: light-dark(var(--on-app-background), var(--on-app-background-dark));
    transition: opacity 200ms ease;

    &.hidden {
      opacity: 0.3;
    }
  }

  .close-button {
    position: absolute;
    right: 0.55rem;
    flex-shrink: 0;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    width: 16px;
    height: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
    color: light-dark(var(--on-surface-muted), var(--on-surface-muted-dark));

    &:hover {
      color: light-dark(var(--on-surface-muted), var(--on-surface-muted-dark));
      opacity: 1;
    }
        color: light-dark(var(--accent), var(--accent-dark));

  .pin-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    color: var(--on-surface-muted);
    opacity: 0.6;
    z-index: 10;
  }

  .pin-icon {
    width: 8px;
    height: 8px;
    background: currentColor;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    position: relative;
  }

  .pin-icon::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 2px;
    height: 2px;
    background: var(--app-background, white);
    border-radius: 50%;
  }
</style>
