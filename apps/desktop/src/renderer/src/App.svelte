<script lang="ts">
  import { Browser } from '@horizon/core'
  import '../../app.css'
  import './assets/fonts/Bayshore.woff2'
  import './assets/fonts/Bayshore.woff'
  import './assets/fonts/Gambarino-Regular.woff'
  import './assets/fonts/Gambarino-Regular.woff2'
  import '../../output.css'
  import '../../../../../packages/core/src/output.css'
</script>

<div class="main relative">
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
</style>
