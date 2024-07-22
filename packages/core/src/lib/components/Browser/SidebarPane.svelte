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

{#if horizontalTabs}
  <!-- <PaneGroup direction={'vertical'} autoSaveId="surf-sidebar-horizontal" class="relative flex flex-col">
    <Pane
      minSize={2}
      maxSize={6}
      defaultSize={3}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    >
      <slot name="sidebar" />
    </Pane>
    <PaneResizer class="hover:bg-neutral-100 z-[50001]">
      <div
        class:h-full={!horizontalTabs}
        class:w-0.5={!horizontalTabs}
        class:w-full={horizontalTabs}
        class:h-0.5={horizontalTabs}
      />
    </PaneResizer>
    <PaneGroup direction="horizontal">
      <Pane maxSize={10}>
        <slot name="content" />
      </Pane>
    </PaneGroup>
  </PaneGroup> -->

  <PaneGroup direction="vertical" autoSaveId="surf-sidebar-horizontal">
	<Pane
		defaultSize={10}
		collapsedSize={2}
		collapsible={true}
		minSize={2}
        maxSize={20}
        class="bg-white"
	>
        <slot name="sidebar" />
    </Pane>
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
                  class:h-full={!horizontalTabs}
                  class:w-0.5={!horizontalTabs}
                  class:w-full={horizontalTabs}
                  class:h-0.5={horizontalTabs}
                />
              </PaneResizer>
			<Pane defaultSize={20} />
		</PaneGroup>
	</Pane>
</PaneGroup>

{:else}
  <!-- <PaneGroup direction={'horizontal'} autoSaveId="surf-sidebar-vertical" class="relative flex flex-row">
    <Pane
      minSize={2}
      maxSize={20}
      defaultSize={10}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    >
      <slot name="sidebar" />
    </Pane>
    <PaneResizer class="hover:bg-neutral-100 z-[50001]">
      <div
        class:h-full={!horizontalTabs}
        class:w-0.5={!horizontalTabs}
        class:w-full={horizontalTabs}
        class:h-0.5={horizontalTabs}
      />
    </PaneResizer>
    <PaneGroup direction="horizontal">
      <Pane maxSize={50}>
        <slot name="content" />
      </Pane>
    </PaneGroup>
  </PaneGroup> -->

  <PaneGroup direction="horizontal" autoSaveId="surf-sidebar-vertical">
	<Pane
		defaultSize={10}
		collapsedSize={2}
		collapsible={true}
		minSize={2}
        maxSize={20}
	>
        <slot name="sidebar" />
    </Pane>
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
                  class:h-full={!horizontalTabs}
                  class:w-0.5={!horizontalTabs}
                  class:w-full={horizontalTabs}
                  class:h-0.5={horizontalTabs}
                />
              </PaneResizer>
			<Pane defaultSize={20} />
		</PaneGroup>
	</Pane>
</PaneGroup>

{/if}

