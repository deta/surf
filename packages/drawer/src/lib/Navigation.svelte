<script lang="ts">
  import { createEventDispatcher, getContext, onMount } from 'svelte'
  import Tabs, { type Tab } from './Tabs.svelte'
  import { useDrawer } from './drawer'

  export let tabs: Tab[] = []

  const drawer = useDrawer()
  const { selectedTab } = drawer

  const dispatch = createEventDispatcher<{ select: string }>()

  let navigationRef: any

  const handleTabSelect = (event: CustomEvent<string>) => {
    const key = event.detail

    dispatch('select', key)

    drawer.search({ tab: key })
  }

  // Function to handle the horizontal scrolling
  function enableHorizontalScrolling(event: WheelEvent) {
    if (event.deltaY == 0) return // If there's no vertical scrolling, exit
    event.preventDefault() // Prevent the default vertical scrolling
    navigationRef.scrollLeft += event.deltaY + event.deltaX // Apply horizontal scrolling
  }
</script>

<div class="drawer-navigation">
  <div class="navigation-wrapper" bind:this={navigationRef} on:wheel={enableHorizontalScrolling}>
    <Tabs bind:selected={$selectedTab} {tabs} on:select={handleTabSelect} />
  </div>
</div>

<style lang="scss">
  .drawer-top {
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
    padding: 1rem 1.5rem;
    z-index: 1000;

    background: rgba(255, 255, 255, 0.3);
  }
  .drawer-bottom {
    position: relative;
    padding: 1rem 0.5rem 0.5rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 0.5rem;
    z-index: 1000;
  }

  .drawer-navigation,
  .navigation-wrapper {
    overflow-x: auto;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .drawer-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-right: 0.5rem;

    button {
      appearance: none;
      background: none;
      border: none;
      cursor: cursor;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      transition: color 0.2s ease;
      border-radius: 9px;

      &:hover {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
