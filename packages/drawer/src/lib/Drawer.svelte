<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fly } from 'svelte/transition'

  import { provideDrawer, type SearchQuery, type Drawer } from './drawer'

  const dispatch = createEventDispatcher<{ search: SearchQuery }>()

  export let drawer: Drawer = provideDrawer()
  const { show, size } = drawer

  drawer.onSearch((query) => {
    dispatch('search', query)
  })

  // $: width = $size === 'minimal' ? '200px' : $size === 'normal' ? 'calc(max(40vw, 500px))' : '100vw'
  $: width = 'calc(max(40vw, 500px))'
</script>

<div class="drawer-root">
  {#if $show}
    <div
      transition:fly={{ x: '100%', opacity: 1, duration: 200 }}
      class="drawer-wrapper"
      style="--drawer-width: {width};"
    >
      <div class="drawer-main">
        <slot />
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .drawer-wrapper {
    position: fixed;
    z-index: 1000;
    right: 0;
    top: 0;
    height: 100vh;
    padding: 1rem;
    padding-top: 25px;
    width: var(--drawer-width);
    transition: width 0.2s ease-out;
  }

  .drawer-main {
    width: 100%;
    height: 100%;
    transition: width 0.2s ease-out;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(16px);
    background: rgba(245, 245, 245, 0.92);
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    overflow: hidden;

    display: flex;
    flex-direction: column;
  }
</style>
