<script lang="ts">
  import { Browser } from '@horizon/core'
  import '../../app.css'
  import './assets/fonts/Bayshore.woff2'
  import './assets/fonts/Bayshore.woff'
  import './assets/fonts/Gambarino-Regular.woff'
  import './assets/fonts/Gambarino-Regular.woff2'
  import '../../output.css'
  import '../../../../../packages/core/src/output.css'
  import { isMac, isWindows } from '@horizon/utils'
</script>

<div class="main" class:os__windows={isWindows()} class:os__mac={isMac()}>
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
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
