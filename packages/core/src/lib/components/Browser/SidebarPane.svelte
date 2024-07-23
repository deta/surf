<script lang="ts" context="module">
  export type SidebarPaneEvents = {
    'collapsed-left-sidebar': void
    'expanded-left-sidebar': void
    'pane-update': PaneAPI
  }
</script>

<script lang="ts">
  import { PaneGroup, Pane, PaneResizer, type PaneAPI } from 'paneforge'
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'

  export let horizontalTabs: boolean = false
  export let paneItem: PaneAPI | undefined = undefined

  const paneStore = writable<PaneAPI | undefined>(undefined)
  const dispatch = createEventDispatcher<SidebarPaneEvents>()

  $: {
    if (paneItem) {
      paneStore.set(paneItem)
    }
  }

  $: if ($paneStore) {
    dispatch('pane-update', $paneStore)
  }

  const handleCollapse = () => {
    dispatch('collapsed-left-sidebar')
  }

  const handleExpand = () => {
    dispatch('expanded-left-sidebar')
  }

  onMount(() => {
    return () => {
      // Cleanup if necessary
    }
  })
</script>

<PaneGroup direction={horizontalTabs ? 'vertical' : 'horizontal'}>
  {#if horizontalTabs}
    <Pane
      defaultSize={3}
      collapsible={true}
      minSize={2}
      maxSize={20}
      bind:pane={$paneStore}
      on:collapse={handleCollapse}
      on:expand={handleExpand}
    >
      <slot name="sidebar" />
    </Pane>
  {:else}
    <Pane
      defaultSize={10}
      collapsible
      maxSize={20}
      bind:pane={$paneStore}
      on:collapse={handleCollapse}
      on:expand={handleExpand}
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
      <Pane defaultSize={50}>
        <slot name="content" />
      </Pane>
      <PaneResizer class="hover:bg-neutral-100 z-[50001]">
        <div class="h-full w-2" />
      </PaneResizer>
      <Pane
        defaultSize={10}
        collapsedSize={1}
        collapsible={true}
        minSize={1}
        maxSize={20}
        class="bg-sky-50 mb-1.5 rounded-xl mr-1.5 {horizontalTabs ? '' : 'mt-1.5'}"
      >
        <slot name="right-sidebar" />
      </Pane>
    </PaneGroup>
  </Pane>
</PaneGroup>
