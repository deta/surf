<script lang="ts">
  import { useTabs } from '@deta/services/tabs'
  import TabItem from '../TabItem.svelte'
  import { Icon } from '@deta/icons'
  import {
    calculateTabLayout,
    measureContainerWidth,
    type LayoutCalculation
  } from './tabsLayout.svelte'
  import { onMount, tick } from 'svelte'

  import { useDebounce } from '@deta/utils'
  import { Button } from '@deta/ui'
  import { HTMLAxisDragZone } from '@deta/dragcula'
  import { createTabsDragAndDrop } from './dnd.svelte'

  const tabsService = useTabs()

  let containerElement: HTMLDivElement
  let containerWidth = $state(0)
  let layoutCalculation = $state<LayoutCalculation | null>(null)
  let isResizing = $state(false)

  const dnd = createTabsDragAndDrop(tabsService)

  const handleNewTab = () => {
    tabsService.openNewTabPage()
  }

  // Reactive calculation of layout
  $effect(() => {
    if (containerWidth > 0 && tabsService.tabs.length > 0) {
      layoutCalculation = calculateTabLayout(
        tabsService.tabs,
        containerWidth,
        tabsService.activeTabIdValue
      )
    }
  })

  // Setup container width tracking
  onMount(() => {
    const updateWidth = () => {
      if (!containerElement) return

      containerWidth = measureContainerWidth(containerElement)
    }

    const debouncedUpdateWidth = useDebounce(updateWidth, 16)

    const handleResize = () => {
      isResizing = true
      updateWidth() // Immediate update
      debouncedUpdateWidth().then(() => {
        isResizing = false
      })
    }

    // Initial measurement
    tick().then(() => updateWidth())

    // Listen to window resize
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  })
</script>

<div
  class="tabs-list"
  bind:this={containerElement}
  axis="horizontal"
  dragdeadzone="5"
  use:HTMLAxisDragZone.action={{
    accepts: dnd.acceptTabDrag
  }}
  onDrop={dnd.handleTabDrop}
>
  {#each tabsService.tabs as tab, index (tab.id)}
    <TabItem
      tab={tabsService.tabs[index]}
      active={tabsService.activeTab?.id === tab.id}
      width={layoutCalculation?.tabDimensions[index]?.width}
      collapsed={layoutCalculation?.tabDimensions[index]?.collapsed ?? false}
      squished={layoutCalculation?.tabDimensions[index]?.squished ?? false}
      showCloseButton={layoutCalculation?.tabDimensions[index]?.showCloseButton ?? true}
      {isResizing}
    />
  {/each}

  <div class="add-tab-btn-container">
    <Button onclick={handleNewTab} size="md">
      <Icon name="add" size="1.1rem" />
    </Button>
  </div>
</div>

<style lang="scss">
  .tabs-list {
    position: relative;
    flex-grow: 1;
    width: 100%;
    width: -webkit-fill-available;
    flex-shrink: 1;
    overflow: hidden;
    display: flex;
    gap: 0.375rem;
    padding-top: 0.33rem;
    padding-bottom: 0.33rem;
  }

  .add-tab-btn-container {
    flex-shrink: 0;
    app-region: no-drag;
  }

  /* View Transitions for smooth tab reordering */
  :global([data-tab-id]) {
    view-transition-name: var(--tab-id);
  }

  /* Smooth transitions during reordering */
  :global(::view-transition-old(tab)),
  :global(::view-transition-new(tab)) {
    animation-duration: 200ms;
    animation-timing-function: cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  /* Crossfade animation for tab reordering */
  :global(::view-transition-old(tab)) {
    animation-name: slide-out;
  }

  :global(::view-transition-new(tab)) {
    animation-name: slide-in;
  }

  @keyframes slide-out {
    to {
      transform: scale(0.95);
      opacity: 0.8;
    }
  }

  @keyframes slide-in {
    from {
      transform: scale(0.95);
      opacity: 0.8;
    }
  }
</style>
