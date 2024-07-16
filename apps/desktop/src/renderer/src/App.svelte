<script lang="ts">
  import { Browser } from '@horizon/core'
  import { onMount } from 'svelte'
  import "../../app.css"
  import "../../output.css"
  import '../../../../../packages/core/src/output.css'
    import browserBackground from './assets/seatrain-upscaled-hightrain.webp'
  

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
  <img class="w-screen h-screen absolute object-cover opacity-60" src={browserBackground} alt="background" />
  <Browser />
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
