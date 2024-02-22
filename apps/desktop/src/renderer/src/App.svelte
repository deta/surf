<script lang="ts">
  import { HorizonManager } from '@horizon/core'
  import { onMount } from 'svelte'

  let showDragBar = true

  onMount(() => {
    window.api.onFullscreenChange((fullscreen) => (showDragBar = !fullscreen))
  })
</script>

<div class="main">
  {#if showDragBar}
    <div class="drag-bar"></div>
  {/if}
  <HorizonManager />
</div>

<style>
  .main {
    height: 100vh;
    width: 100vw;
  }

  .drag-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 25px;
    -webkit-app-region: drag;
  }
</style>
