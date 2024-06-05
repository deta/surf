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
  $: width = 'calc(max(30vw, 500px))'
</script>

<div class="drawer-root">
  {#if $show}
    <div transition:fly={{ x: '-100%', opacity: 1, duration: 200 }} class="drawer-wrapper">
      <div class="drawer-main">
        <slot />
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .drawer-root {
    width: 100%;
    height: 100%;
  }

  .drawer-wrapper {
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 100%;
    transition: width 0.2s ease-out;
    overflow: hidden;
  }

  .drawer-main {
    width: 100%;
    height: 100%;
    transition: width 0.2s ease-out;
    background: #f8f7f2;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    overflow: hidden;

    display: flex;
    flex-direction: column;
  }
</style>
