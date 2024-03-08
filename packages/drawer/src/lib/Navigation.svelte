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
    <button on:click={() => drawer.close()}>
      <Icon name="close" size="22px" />
    </button>
    {#if $size === 'normal'}
      <button on:click={() => drawer.setSize('full')}>
        <Icon name="arrowHorizontal" size="22px" />
      </button>
    {:else}
      <button on:click={() => drawer.setSize('normal')} style="transform: rotate(-45deg);">
        <Icon name="arrowDiagonalMinimize" size="22px" />
      </button>
    {/if}
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
    width: 100%;
    top: 0;
    left: 0;
    padding: 1rem 1.5rem;
    z-index: 0;
    background: rgba(255, 255, 255, 0.2);
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
    gap: 1rem;
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
      border-radius: 3px;

      &:hover {
        color: var(--color-text);
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
