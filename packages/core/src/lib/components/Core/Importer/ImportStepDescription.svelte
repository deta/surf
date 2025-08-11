<script lang="ts">
  import type { BrowserTypeItem } from '@deta/types'
  import type { ImportStatus } from './ImporterV2.svelte'

  export let currentStepIdx: number = 0
  export let selectedBrowser: BrowserTypeItem | null = null
  export let importStatus: ImportStatus
  export let initialImport: boolean = false
</script>

{#if currentStepIdx === 0}
  <p>
    Surf can import your browser history and bookmarks from your old browser so you can continue
    where you left off.
  </p>
  {#if initialImport}
    <p>Which browser did you use before Surf?</p>
  {/if}
{:else if currentStepIdx === 1}
  <p>Choose what data you want to import from {selectedBrowser?.name} into Surf.</p>
{:else if currentStepIdx === 2 && (importStatus === 'idle' || importStatus === 'importing')}
  <p>
    We are importing your data from {selectedBrowser?.name} into Surf. This may take a couple seconds.
  </p>
{:else if currentStepIdx === 2 && importStatus === 'done'}
  <p>Your data from {selectedBrowser?.name} has been imported to Surf successfully!</p>
{:else if currentStepIdx === 2 && importStatus === 'error'}
  <p>
    Failed to import from {selectedBrowser?.name}. Please make sure it is installed and closed, then
    try again.
  </p>
  <p>If the problem persists, contact us: <a href="mailto:hello@deta.surf">hello@deta.surf</a></p>
{:else if currentStepIdx === 3}
  <p>
    Your imported data is now saved in Stuff, Surf's central place for anything you save from the
    web.
  </p>

  <p>Open Stuff or use one of the shortcuts to explore your imported data:</p>
{/if}

<style lang="scss">
  p {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    text-wrap: pretty;

    :global(.dark) & {
      color: #ebebeb;
    }
  }
</style>
