<script lang="ts" context="module">
  export type SidebarPaneEvents = {
    'collapsed-left-sidebar': void
    'expanded-left-sidebar': void
    'pane-update': PaneAPI
    'collapsed-right-sidebar': void
    'expanded-right-sidebar': void
    'pane-update-right': PaneAPI
  }
</script>

<script lang="ts">
  import { PaneGroup, Pane, PaneResizer, type PaneAPI } from 'paneforge'
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  const MIN_LEFT_SIDEBAR = 200
  const MIN_RIGHT_SIDEBAR = 300

  const DEFAULT_LEFT_SIDEBAR_WIDTH = 300
  const DEFAULT_RIGHT_SIDEBAR_WIDTH = 500

  export let horizontalTabs: boolean = false
  export let paneItem: PaneAPI | undefined = undefined
  export let rightPaneItem: PaneAPI | undefined = undefined
  export let rightSidebarHidden: boolean = true

  export const expandLeft = () => {
    if (!$paneStore) return

    $paneStore.expand()

    const width = percentageToPx(paneSize)
    if (width < MIN_LEFT_SIDEBAR) {
      $paneStore.resize(pxToPercentage(DEFAULT_LEFT_SIDEBAR_WIDTH))
    }
  }

  export const collapseLeft = () => {
    if (!$paneStore) return

    $paneStore.collapse()
  }

  export const expandRight = () => {
    if (!$rightPaneStore) return

    $rightPaneStore.expand()

    const width = percentageToPx(rightPaneSize)
    if (width < MIN_RIGHT_SIDEBAR) {
      $rightPaneStore.resize(pxToPercentage(DEFAULT_RIGHT_SIDEBAR_WIDTH))
    }
  }

  export const collapseRight = () => {
    if (!$rightPaneStore) return

    $rightPaneStore.collapse()
  }

  const paneStore = writable<PaneAPI | undefined>(undefined)
  const rightPaneStore = writable<PaneAPI | undefined>(undefined)
  const dispatch = createEventDispatcher<SidebarPaneEvents>()

  let paneSize = 0
  let rightPaneSize = 0

  $: {
    if (paneItem) {
      paneStore.set(paneItem)
    }
  }

  $: if ($paneStore) {
    dispatch('pane-update', $paneStore)
  }

  $: {
    if (rightPaneItem) {
      rightPaneStore.set(rightPaneItem)
    }
  }

  $: if ($rightPaneStore) {
    dispatch('pane-update-right', $rightPaneStore)
  }

  const pxToPercentage = (px: number, widthOrHeight: 'width' | 'height' = 'width') => {
    return (px / (widthOrHeight === 'width' ? window.innerWidth : window.innerHeight)) * 100
  }
  const percentageToPx = (percentage: number, widthOrHeight: 'width' | 'height' = 'width') => {
    return (percentage / 100) * (widthOrHeight === 'width' ? window.innerWidth : window.innerHeight)
  }

  const handleCollapse = () => {
    dispatch('collapsed-left-sidebar')
  }

  const handleExpand = () => {
    if (paneSize === 0) return

    dispatch('expanded-left-sidebar')
  }

  const handleRightCollapse = () => {
    dispatch('collapsed-right-sidebar')
  }

  const handleRightExpand = () => {
    if (rightPaneSize === 0) return

    dispatch('expanded-right-sidebar')
  }

  const handleResizePane = (paneName: string, size: number) => {
    if (paneName === 'sidebar') {
      paneSize = size
    } else {
      rightPaneSize = size
    }

    if (size === 0) return

    const width = percentageToPx(size, 'width')
    if (paneName === 'sidebar' && width < MIN_LEFT_SIDEBAR) {
      $paneStore?.collapse()
    } else if (paneName === 'right-sidebar' && width < MIN_RIGHT_SIDEBAR) {
      $rightPaneStore?.collapse()
    }

    if (paneName === 'right-sidebar') {
      localStorage.setItem(`panelSize-${paneName}`, percentageToPx(size, 'width').toString())
      return
    } else {
      localStorage.setItem(
        `panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-${paneName}`,
        percentageToPx(size, horizontalTabs ? 'height' : 'width').toString()
      )
    }
  }

  const handleResize = (e: Event) => {
    const targetSidebar = Number(
      localStorage.getItem(`panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`)
    )
    const targetRightSidebar = Number(localStorage.getItem('panelSize-right-sidebar'))

    const newPercentageSidebar = pxToPercentage(targetSidebar, horizontalTabs ? 'height' : 'width')
    const newPercentageRightSidebar = pxToPercentage(targetRightSidebar, 'width')

    if (newPercentageSidebar !== 0) $paneStore?.resize(newPercentageSidebar)
    if (newPercentageRightSidebar !== 0) $rightPaneStore?.resize(newPercentageRightSidebar)
  }

  onMount(() => {
    if (rightSidebarHidden && $rightPaneStore) {
      $rightPaneStore.collapse()
    }
  })
</script>

<svelte:window on:resize={handleResize} />

<PaneGroup direction={horizontalTabs ? 'vertical' : 'horizontal'} class="px-0.5">
  {#if horizontalTabs}
    <!-- <Pane
      defaultSize={localStorage.getItem('panelSize-horizontal-sidebar') === null
        ? 3
        : pxToPercentage(Number(localStorage.getItem('panelSize-horizontal-sidebar')), 'height')}
      collapsible={false}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={(size) => handleResizePane('sidebar', size)}
    >
      <slot name="sidebar" />
    </Pane> -->
    <div>
      <slot name="sidebar" />
    </div>
  {:else}
    <Pane
      defaultSize={localStorage.getItem('panelSize-vertical-sidebar') === null
        ? 15
        : pxToPercentage(Number(localStorage.getItem('panelSize-vertical-sidebar')))}
      collapsible={true}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={(size) => handleResizePane('sidebar', size)}
      order={1}
    >
      <slot name="sidebar" />
    </Pane>
    <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full">
      <div
        class:h-full={!horizontalTabs}
        class:w-1.5={!horizontalTabs}
        class:w-full={horizontalTabs}
        class:h-0.5={horizontalTabs}
      />
    </PaneResizer>
  {/if}
  <Pane order={2}>
    <PaneGroup direction="horizontal">
      <Pane order={1}>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full">
        <div class="h-full w-1.5" />
      </PaneResizer>
      <Pane
        order={2}
        defaultSize={localStorage.getItem('panelSize-right-sidebar') === null
          ? 15
          : pxToPercentage(Number(localStorage.getItem('panelSize-right-sidebar')))}
        collapsible={true}
        class="bg-sky-50 mb-1.5 rounded-xl {horizontalTabs ? '' : 'mt-1.5'}"
        onCollapse={handleRightCollapse}
        onExpand={handleRightExpand}
        bind:pane={$rightPaneStore}
        onResize={(size) => handleResizePane('right-sidebar', size)}
      >
        <slot name="right-sidebar" />
      </Pane>
    </PaneGroup>
  </Pane>
</PaneGroup>
