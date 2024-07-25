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

  export let horizontalTabs: boolean = false
  export let paneItem: PaneAPI | undefined = undefined
  export let rightPaneItem: PaneAPI | undefined = undefined
  export let rightSidebarHidden: boolean = true

  const paneStore = writable<PaneAPI | undefined>(undefined)
  const rightPaneStore = writable<PaneAPI | undefined>(undefined)
  const dispatch = createEventDispatcher<SidebarPaneEvents>()

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

  const handleCollapse = () => {
    dispatch('collapsed-left-sidebar')
  }

  const handleExpand = () => {
    dispatch('expanded-left-sidebar')
  }

  const handleRightCollapse = () => {
    dispatch('collapsed-right-sidebar')
  }

  const handleRightExpand = () => {
    dispatch('expanded-right-sidebar')
  }

  const handleResizePane = (paneName: string, size: number) => {
    if (size === 0) return
    if (paneName === 'right-sidebar') {
      localStorage.setItem(`panelSize-${paneName}`, `${(size / 100) * window.innerHeight}`)
      return
    } else {
      localStorage.setItem(
        `panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-${paneName}`,
        `${(size / 100) * window.innerWidth}`
      )
    }
  }

  const handleResize = (e: Event) => {
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    const targetSidebar = Number(
      localStorage.getItem(`panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`)
    )
    const targetRightSidebar = Number(localStorage.getItem('panelSize-right-sidebar'))
    const newPercentageSidebar =
      (targetSidebar / (horizontalTabs ? windowHeight : windowWidth)) * 100
    const newPercentageRightSidebar = (targetRightSidebar / windowHeight) * 100

    if (newPercentageSidebar !== 0) $paneStore?.resize(newPercentageSidebar)
    if (!rightSidebarHidden) $rightPaneStore?.resize(newPercentageRightSidebar)
  }

  const pxToPercentage = (px: number, widthOrHeight: 'width' | 'height' = 'width') => {
    return (px / (widthOrHeight === 'width' ? window.innerWidth : window.innerHeight)) * 100
  }
  const percentageToPx = (percentage: number, widthOrHeight: 'width' | 'height' = 'width') => {
    return (percentage / 100) * (widthOrHeight === 'width' ? window.innerWidth : window.innerHeight)
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
    <Pane
      defaultSize={localStorage.getItem('panelSize-horizontal-sidebar') === null
        ? 3
        : pxToPercentage(Number(localStorage.getItem('panelSize-horizontal-sidebar')), 'height')}
      collapsible={true}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={(size) => handleResizePane('sidebar', size)}
    >
      <slot name="sidebar" />
    </Pane>
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
    >
      <slot name="sidebar" />
    </Pane>
  {/if}
  <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full">
    <div
      class:h-full={!horizontalTabs}
      class:w-1.5={!horizontalTabs}
      class:w-full={horizontalTabs}
      class:h-0.5={horizontalTabs}
    />
  </PaneResizer>
  <Pane>
    <PaneGroup direction="horizontal">
      <Pane>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001] my-1.5 rounded-full">
        <div class="h-full w-1.5" />
      </PaneResizer>
      <Pane
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
