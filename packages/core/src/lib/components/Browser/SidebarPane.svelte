<script lang="ts" context="module">
  export type SidebarPaneEvents = {
    collapse: void
    expand: void
  }
</script>

<script lang="ts">
  import { PaneGroup, Pane, PaneResizer, type PaneAPI } from 'paneforge'
  import { createEventDispatcher } from 'svelte'

  export let horizontalTabs: boolean = false
  export let paneItem: PaneAPI

  const dispatch = createEventDispatcher<SidebarPaneEvents>()

  const handleCollapse = () => {
    dispatch('collapse')
  }

  const handleExpand = () => {
    dispatch('expand')
  }
</script>

<PaneGroup direction={horizontalTabs ? 'vertical' : 'horizontal'}>
  {#if horizontalTabs}
    <Pane
      defaultSize={3}
      collapsedSize={2}
      collapsible={true}
      minSize={2}
      maxSize={20}
    >
      <slot name="sidebar" />
    </Pane>
  {:else}
    <Pane defaultSize={10} collapsedSize={2} collapsible={true} minSize={2} maxSize={20}>
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
      <Pane defaultSize={50}>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001]">
        <div
            class="h-full w-2"
        />
      </PaneResizer>
      <Pane defaultSize={10} collapsedSize={1} collapsible={true} minSize={1} maxSize={20} class="bg-sky-50 mb-1.5 rounded-xl mr-1.5 {horizontalTabs ? '' : 'mt-1.5'}">
        <slot name="right-sidebar" />
        </Pane>
    </PaneGroup>
  </Pane>
</PaneGroup>
