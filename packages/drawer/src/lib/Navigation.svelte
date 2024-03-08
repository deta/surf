<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  import { Icon } from '@horizon/icons'

  import Tabs, { type Tab } from './Tabs.svelte'
  import { useDrawer } from './drawer'

  export let tabs: Tab[] = []

  const drawer = useDrawer()
  const { selectedTab, size } = drawer

  const dispatch = createEventDispatcher<{ select: string }>()

  const handleTabSelect = (event: CustomEvent<string>) => {
    const key = event.detail

    dispatch('select', key)

    console.log('Tab changed, triggering search')
    drawer.search({ tab: key })
  }
</script>

<div class="drawer-top">
  <div class="drawer-controls">
    {#if $size === 'normal'}
      <button on:click={() => drawer.setSize('full')}>
        <Icon name="arrowHorizontal" size="22px" />
      </button>
    {:else}
      <button on:click={() => drawer.setSize('normal')} style="transform: rotate(-45deg);">
        <Icon name="arrowDiagonalMinimize" size="22px" />
      </button>
    {/if}
    <button on:click={() => drawer.close()}>
      <Icon name="close" size="22px" />
    </button>
  </div>
</div>
<div class="drawer-bottom">
  <div>
    <Tabs bind:selected={$selectedTab} {tabs} on:select={handleTabSelect} />
  </div>
</div>

<style lang="scss">
  .drawer-top {
    position: fixed;
    top: 1rem;
    right: 1rem;
  }
  .drawer-bottom {
    position: relative;
    padding: 1rem 0.5rem 0.5rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    z-index: 10;
  }

  .drawer-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-right: 0.5rem;

    button {
      appearance: none;
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      transition: color 0.2s ease;

      &:hover {
        color: var(--color-text);
      }
    }
  }
</style>
