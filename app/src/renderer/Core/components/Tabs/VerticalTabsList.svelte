<script lang="ts">
  import { useTabs } from '@deta/services/tabs'
  import VerticalPinnedTab from './VerticalPinnedTab.svelte'
  import VerticalUnpinnedTab from './VerticalUnpinnedTab.svelte'
  import { Icon } from '@deta/icons'
  import { isMac } from '@deta/utils'
  import {
    calculateVerticalTabLayout,
    measureContainerHeight,
    needsVerticalScrolling
  } from './TabsList/verticalTabsLayout.svelte'
  import type { VerticalLayoutCalculation } from './types'
  import { onMount, tick } from 'svelte'
  import { useDebounce } from '@deta/utils'
  import { Button } from '@deta/ui'
  import { HTMLAxisDragZone } from '@deta/dragcula'
  import { createTabsDragAndDrop, cleanupDropIndicators } from './TabsList/dnd.svelte'
  import { onDestroy } from 'svelte'

  const tabsService = useTabs()

  let containerElement: HTMLDivElement
  let scrollContainerElement: HTMLDivElement
  let containerHeight = $state(0)
  let layoutCalculation = $state<VerticalLayoutCalculation | null>(null)
  let isResizing = $state(false)
  let needsScrolling = $state(false)

  // Resize handle state
  let isResizingWidth = $state(false)
  let targetTabsWidth = $state(240)
  let tabsWidth = $state(240)
  let raf = null

  const dnd = createTabsDragAndDrop(tabsService)

  const handleNewTab = () => {
    tabsService.openNewTabPage()
  }

  // Resize handle functions
  const rafCbk = () => {
    tabsWidth = targetTabsWidth
    raf = null
  }

  const handleResizeMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    window.addEventListener('mousemove', handleResizingMouseMove, { capture: true })
    window.addEventListener('mouseup', handleResizingMouseUp, { capture: true, once: true })
    isResizingWidth = true
  }

  const handleResizingMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    targetTabsWidth = Math.max(200, Math.min(targetTabsWidth + e.movementX, 400))
    if (raf === null) raf = requestAnimationFrame(rafCbk)
  }

  const handleResizingMouseUp = (e: MouseEvent) => {
    e.preventDefault()
    window.removeEventListener('mousemove', handleResizingMouseMove, { capture: true })
    isResizingWidth = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    // TODO: Save width to user preferences
  }

  // Reactive calculation of layout
  $effect(() => {
    if (containerHeight > 0 && tabsService.tabs.length > 0) {
      layoutCalculation = calculateVerticalTabLayout(
        tabsService.tabs,
        containerHeight,
        tabsService.activeTabIdValue
      )
      needsScrolling = needsVerticalScrolling(tabsService.tabs, containerHeight)
    }
  })

  // Setup container height tracking
  onMount(() => {
    const updateHeight = () => {
      if (!containerElement) return
      containerHeight = measureContainerHeight(containerElement)
    }

    const debouncedUpdateHeight = useDebounce(updateHeight, 16)

    const handleResize = () => {
      isResizing = true
      updateHeight() // Immediate update
      debouncedUpdateHeight().then(() => {
        isResizing = false
      })
    }

    // Initial measurement
    tick().then(() => updateHeight())

    // Listen to window resize
    window.addEventListener('resize', handleResize)

    // Use ResizeObserver for more accurate container tracking
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    if (containerElement) {
      resizeObserver.observe(containerElement)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  })

  // Cleanup on component destroy (defensive measure)
  onDestroy(() => {
    cleanupDropIndicators()
  })

  // Auto-scroll to active tab when it changes
  $effect(() => {
    if (tabsService.activeTab && scrollContainerElement) {
      const activeTabElement = scrollContainerElement.querySelector(
        `#tab-${tabsService.activeTab.id}`
      )
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  })
</script>

<div
  class="vertical-tabs-list"
  bind:this={containerElement}
  style:--tabsWidth={tabsWidth + 'px'}
  class:mac={isMac()}
>
  <div
    class="tabs-scroll-container"
    class:needs-scrolling={needsScrolling}
    bind:this={scrollContainerElement}
    axis="vertical"
    use:HTMLAxisDragZone.action={{
      accepts: dnd.acceptTabDrag
    }}
    onDrop={dnd.handleTabDrop}
  >
    <!-- Small pin zone indicator when no pinned tabs exist -->
    {#if tabsService.tabs.filter((tab) => tab.pinned).length === 0}
      <div
        class="pin-zone-hint"
        use:HTMLAxisDragZone.action={{
          accepts: dnd.acceptUnpinnedTabDrag
        }}
        onDrop={dnd.handlePinZoneDrop}
      ></div>
    {/if}

    {#each tabsService.tabs as tab, index (tab.id)}
      {#if tab.pinned}
        <VerticalPinnedTab
          {tab}
          active={tabsService.activeTab?.id === tab.id}
          height={layoutCalculation?.tabDimensions[index]?.height}
          {isResizing}
        />
        <!-- Add separator line after last pinned tab -->
        {#if index + 1 < tabsService.tabs.length && !tabsService.tabs[index + 1].pinned}
          <div class="pinned-separator"></div>
        {/if}
      {:else}
        <VerticalUnpinnedTab
          {tab}
          active={tabsService.activeTab?.id === tab.id}
          height={layoutCalculation?.tabDimensions[index]?.height}
          showCloseButton={layoutCalculation?.tabDimensions[index]?.showCloseButton ?? true}
          {isResizing}
        />
      {/if}
    {/each}
  </div>

  <div class="add-tab-btn-container">
    <Button onclick={handleNewTab} size="md" square>
      <Icon name="add" size="1.1rem" />
    </Button>
  </div>

  <div
    class="resize-handle"
    onmousedown={handleResizeMouseDown}
    data-resizing={isResizingWidth}
  ></div>
</div>

<style lang="scss">
  .vertical-tabs-list {
    position: relative;
    height: 100%;
    width: var(--tabsWidth, 240px);
    min-width: 200px;
    max-width: 400px;
    padding-top: 3rem;
    display: flex;
    flex-direction: column;
    --fold-width: 0.5rem;
    &:not(.mac) {
      padding-top: 0rem;
    }
  }

  .pin-zone-hint {
    height: 0;
    margin: 0 0.5rem 0.25rem 0.5rem;
    border-radius: 6px;
    opacity: 0;
    transition: all 150ms ease-out;
    position: relative;
  }

  /* Show pin zone hint during drag when no pinned tabs exist */
  :global(body[data-dragging='true']) .pin-zone-hint {
    height: 40px;
    opacity: 1;
    background: light-dark(
      rgba(var(--accent-color-rgb, 0, 122, 204), 0.1),
      rgba(var(--accent-color-rgb, 129, 146, 255), 0.15)
    );
    border: 1px dashed
      light-dark(
        rgba(var(--accent-color-rgb, 0, 122, 204), 0.3),
        rgba(var(--accent-color-rgb, 129, 146, 255), 0.4)
      );
  }

  :global(body[data-dragging='true']) .pin-zone-hint::before {
    content: 'Drop here to pin';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    color: light-dark(var(--on-surface-muted), var(--on-surface-muted-dark));
    pointer-events: none;
  }

  /* Enhanced visual feedback when hovering over pin zone */
  .pin-zone-hint[data-drag-target='true'] {
    background: light-dark(
      rgba(var(--accent-color-rgb, 0, 122, 204), 0.2),
      rgba(var(--accent-color-rgb, 129, 146, 255), 0.25)
    ) !important;
    border-color: light-dark(
      rgba(var(--accent-color-rgb, 0, 122, 204), 0.5),
      rgba(var(--accent-color-rgb, 129, 146, 255), 0.6)
    ) !important;
    border-style: solid !important;
  }

  .pin-zone-hint[data-drag-target='true']::before {
    color: light-dark(var(--on-surface), var(--on-surface-dark)) !important;
    font-weight: 600;
  }

  .tabs-scroll-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    overflow-y: auto;
    overflow-x: hidden;

    &.needs-scrolling {
      // Add subtle scroll indicators
      &::before {
        content: '';
        position: sticky;
        top: 0;
        height: 1px;
        background: linear-gradient(
          to bottom,
          light-dark(var(--border-color), var(--border-color-dark)),
          transparent
        );
        z-index: 1;
      }

      &::after {
        content: '';
        position: sticky;
        bottom: 0;
        height: 1px;
        background: linear-gradient(
          to top,
          light-dark(var(--border-color), var(--border-color-dark)),
          transparent
        );
        z-index: 1;
      }
    }

    // Custom scrollbar styling
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: light-dark(var(--border-color), var(--border-color-dark));
      border-radius: 3px;

      &:hover {
        background: light-dark(var(--on-surface-muted), var(--on-surface-muted-dark));
      }
    }
  }

  .add-tab-btn-container {
    flex-shrink: 0;
    padding: 0.5rem;
    app-region: no-drag;
    display: flex;
    justify-content: center;

    :global(button) {
      background: light-dark(rgba(255, 255, 255, 0.5), rgba(35, 45, 65, 0.4));
      color: light-dark(var(--on-surface), var(--on-surface-dark));
      border: 0.5px solid light-dark(rgba(255, 255, 255, 0.3), rgba(71, 85, 105, 0.3));

      &:hover {
        background: light-dark(rgba(255, 255, 255, 0.7), rgba(35, 45, 65, 0.6));
        border-color: light-dark(rgba(255, 255, 255, 0.5), rgba(71, 85, 105, 0.5));
      }
    }
  }

  .pinned-separator {
    height: 1px;
    background: light-dark(var(--border-color), var(--border-color-dark));
    margin: 0.5rem 0.75rem;
    opacity: 0.3;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--fold-width);
    cursor: ew-resize;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    app-region: no-drag;

    &::before {
      content: '';
      z-index: 5;
      position: absolute;
      left: calc(50%);
      top: 50%;
      height: 30%;
      width: 3px;
      transform: translate(-50%, -50%);
      background: transparent;
      border-radius: 20px;
      transition: background 123ms ease-out;
    }

    &:hover::before {
      background: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.2));
    }

    &:active::before,
    &[data-resizing='true']::before {
      background: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.35));
      width: 4px;
    }
  }

  /* View Transitions for smooth tab reordering */
  :global([data-tab-id^='tab-']) {
    view-transition-name: var(--tab-id);
  }

  /* Smooth transitions during reordering */
  :global(::view-transition-old(vertical-tab)),
  :global(::view-transition-new(vertical-tab)) {
    animation-duration: 200ms;
    animation-timing-function: cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  /* Slide animation for vertical tab reordering */
  :global(::view-transition-old(vertical-tab)) {
    animation-name: slide-up;
  }

  :global(::view-transition-new(vertical-tab)) {
    animation-name: slide-down;
  }

  @keyframes slide-up {
    to {
      transform: translateY(-10px) scale(0.95);
      opacity: 0.8;
    }
  }

  @keyframes slide-down {
    from {
      transform: translateY(10px) scale(0.95);
      opacity: 0.8;
    }
  }
</style>
