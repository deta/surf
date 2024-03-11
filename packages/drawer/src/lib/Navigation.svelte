<script lang="ts">
  import { createEventDispatcher, getContext } from 'svelte'

  import { Icon } from '@horizon/icons'

  import Tabs, { type Tab } from './Tabs.svelte'
  import { useDrawer } from './drawer'

  export let tabs: Tab[] = []

  const drawer = useDrawer()
  const { selectedTab, size } = drawer

  const dispatch = createEventDispatcher<{ select: string }>()
  const viewState: any = getContext('drawer.viewState')

  const handleTabSelect = (event: CustomEvent<string>) => {
    const key = event.detail

    dispatch('select', key)

    console.log('Tab changed, triggering search')
    drawer.search({ tab: key })
  }
</script>

{#if $viewState !== 'details'}
  <div class="drawer-navigation">
    <div class="navigation-wrapper">
      <Tabs bind:selected={$selectedTab} {tabs} on:select={handleTabSelect} />
    </div>
  </div>
{/if}

<style lang="scss">
  .drawer-top {
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
    padding: 1rem 1.5rem;
    z-index: 1000;

    background: rgba(255, 255, 255, 0.2);
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
      border-radius: 3px;

      &:hover {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
