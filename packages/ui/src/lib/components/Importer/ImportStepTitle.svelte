<script lang="ts">
  import type { BrowserTypeItem } from '@deta/types'
  import type { ImportStatus } from './ImporterV2.svelte'

  export let currentStepIdx: number = 0
  export let selectedBrowser: BrowserTypeItem | null = null
  export let importStatus: ImportStatus
</script>

{#if currentStepIdx === 0}
  <h1>Get Started Where You Left Off</h1>
{:else if currentStepIdx === 1}
  <h1>Import Your Data from {selectedBrowser?.name}</h1>
{:else if currentStepIdx === 2 && (importStatus === 'idle' || importStatus === 'importing')}
  <h1>Importing Your Data...</h1>
{:else if currentStepIdx === 2 && importStatus === 'done'}
  <h1>Ready to Go! 🎉</h1>
{:else if currentStepIdx === 2 && importStatus === 'error'}
  <h1>Something went wrong!</h1>
{:else if currentStepIdx === 3}
  <h1>Next Steps</h1>
{/if}

<style lang="scss">
  h1 {
    font-size: 2.5rem;
    line-height: 1.33;
    font-weight: 400;
    color: #333;
    margin-top: 0.75rem;
    margin-bottom: 2rem;
    text-wrap: balance;
    letter-spacing: -0.005rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;

    :global(.dark) & {
      color: #ffffff;
    }
  }
</style>
