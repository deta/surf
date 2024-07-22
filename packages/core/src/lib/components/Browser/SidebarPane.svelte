<script lang="ts" context="module">
  export type SidebarPaneEvents = {
      'on-collapse': void
      'on-expand': void
  }
</script>

<script lang="ts">
    import { PaneGroup, Pane, PaneResizer, type PaneAPI } from 'paneforge'


    export let horizontalTabs: boolean = false
    export let paneItem: PaneAPI

    const dispatch = createEventDispatcher<SidebarPaneEvents>()


    const handleCollapse = () => {
        dispatch('on-collapse')
    }

    const handleExpand = () => {
        dispatch('on-expand')
    }
</script>

{#if horizontalTabs}
<Pane
      collapsible
      minSize={5}
      maxSize={8}
      defaultSize={5}
      bind:pane={paneItem}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    >
    <slot />
</Pane>
{:else}
<Pane
      collapsible
      minSize={2}
      maxSize={20}
      defaultSize={10}
      bind:pane={paneItem}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    >
    <slot />
</Pane>
{/if}