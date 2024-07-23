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
    console.warn('resize', paneName, size)
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

    console.error('resize', newPercentageSidebar, newPercentageRightSidebar)
  }

  const pxToPercentage = (px: number) => {
    return (px / window.innerWidth) * 100
  }
  const percentageToPx = (percentage: number) => {
    return (percentage / 100) * window.innerWidth
  }

  onMount(() => {
    if (rightSidebarHidden && $rightPaneStore) {
      $rightPaneStore.collapse()
    }

    /*const targetSidebar = Number(
      localStorage.getItem(`panelSize-${horizontalTabs ? 'horizontal' : 'vertical'}-sidebar`)
    )
    const targetRightSidebar = Number(localStorage.getItem('panelSize-right-sidebar'))
    const newPercentageSidebar = (targetSidebar / window.innerHeight) * 100
    const newPercentageRightSidebar = targetRightSidebar
      ? (targetRightSidebar / window.innerHeight) * 100
      : 0

    if (newPercentageSidebar !== 0) $paneStore?.resize(newPercentageSidebar)
    if (!rightSidebarHidden) $rightPaneStore?.resize(newPercentageRightSidebar)*/
    console.warn('local', localStorage.getItem('panelSize-vertical-sidebar'))
  })

  $: console.log('paneItem', $paneStore?.isExpanded())
</script>

<svelte:window on:resize={handleResize} />

<PaneGroup direction={horizontalTabs ? 'vertical' : 'horizontal'}>
  {#if horizontalTabs}
    <Pane
      defaultSize={3}
      collapsible={true}
      minSize={2}
      maxSize={20}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    >
      <slot name="sidebar" />
    </Pane>
  {:else}
    <Pane
      defaultSize={localStorage.getItem('panelSize-vertical-sidebar') === null
        ? 15
        : pxToPercentage(Number(localStorage.getItem('panelSize-vertical-sidebar')))}
      collapsible={true}
      maxSize={50}
      minSize={10}
      bind:pane={$paneStore}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onResize={(size) => handleResizePane('sidebar', size)}
    >
      <slot name="sidebar" />
    </Pane>
  {/if}
  <PaneResizer class="hover:bg-neutral-100 z-[50001]">
    <div
      class:h-full={!horizontalTabs}
      class:w-0.5={!horizontalTabs}
      class:w-full={horizontalTabs}
      class:h-0.5={horizontalTabs}
    />
  </PaneResizer>
  <Pane maxSize={100}>
    <PaneGroup direction="horizontal">
      <Pane>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001]">
        <div class="h-full w-2" />
      </PaneResizer>
      <Pane
        defaultSize={10}
        collapsible={true}
        minSize={1}
        maxSize={20}
        class="bg-sky-50 mb-1.5 rounded-xl mr-1.5 {horizontalTabs ? '' : 'mt-1.5'}"
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
