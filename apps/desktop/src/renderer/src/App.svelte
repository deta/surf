<script lang="ts">
  import { Browser } from '@horizon/core'
  import { onMount } from 'svelte'
  import "../../app.css"

  let showDragBar = true

  onMount(() => {
    window.api.onFullscreenChange((fullscreen) => (showDragBar = !fullscreen))
  })
</script>


<div class="main relative">
  {#if showDragBar}
    <div class="drag-bar top"></div>
    <div class="drag-bar bottom"></div>
    <div class="drag-bar left"></div>
    <div class="drag-bar right"></div>
  {/if}
  <Browser />
  <div class="bg-sky-500/50 backdrop-blur-lg  w-screen h-screen"></div>
</div>

<style>
  :global(html) {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .main {
    width: 100%;
    height: 100%;
  }

  .drag-bar {
    position: fixed;
    -webkit-app-region: drag;
  }
  .drag-bar.top {
    top: 0;
    left: 0;
    right: 0;
    height: 20px;
    z-index: -1;
  }
  .drag-bar.bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 10px;
  }
  .drag-bar.left {
    top: 0;
    bottom: 0;
    left: 0;
    width: 10px;
  }
  .drag-bar.right {
    top: 0;
    bottom: 0;
    right: 0;
    width: 10px;
  }
</style>
