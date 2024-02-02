<script lang="ts">
  import { HorizonManager } from '@horizon/core'
</script>

<div class="main">
  <div class="drag-bar"></div>
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
