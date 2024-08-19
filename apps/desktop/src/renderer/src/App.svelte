<script lang="ts">
  import { Browser } from '@horizon/core'
  import { onMount } from 'svelte'
  import '../../app.css'
  import '../../output.css'
  import '../../../../../packages/core/src/output.css'
  import browserBackground from './assets/bg.webp'
  import DevOverlay from './DevOverlay.svelte'

  const isDevMode = import.meta.env.DEV

  onMount(() => {
    window.api.onFullscreenChange((fullscreen) => (showDragBar = !fullscreen))
  })
</script>

<div class="main relative">
  <img
    class="w-screen h-screen absolute object-cover opacity-60 select-none pointer-events-none"
    src={browserBackground}
    alt="background"
  />
  <Browser />
  {#if isDevMode}
    <DevOverlay />
  {/if}
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
</style>
