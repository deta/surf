<script lang="ts">
  import ImporterV2, { type ImportStatus } from './Importer/ImporterV2.svelte'
  import ImportStepTitle from './Importer/ImportStepTitle.svelte'
  import ImportStepDescription from './Importer/ImportStepDescription.svelte'
  import { Icon } from '@horizon/icons'
  import type { BrowserTypeItem } from '@deta/types'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import type { TabImporter } from '@horizon/core/src/lib/types'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'

  export let tab: TabImporter

  const tabsManager = useTabsManager()
  const oasis = useOasis()

  let currentStepIdx: number = 0
  let canGoNext: boolean = false
  let selectedBrowser: BrowserTypeItem | null = null
  let importStatus: ImportStatus
  let importer: ImporterV2

  const handleDone = async () => {
    await tabsManager.delete(tab.id)

    oasis.selectedSpace.set(oasis.defaultSpaceID)
    tabsManager.showNewTabOverlay.set(2)
  }
</script>

<div class="wrapper">
  <div class="content">
    <div class="header">
      <ImportStepTitle {currentStepIdx} {selectedBrowser} {importStatus} />
      <ImportStepDescription {currentStepIdx} {selectedBrowser} {importStatus} />
    </div>

    <ImporterV2
      bind:this={importer}
      bind:currentStepIdx
      bind:canGoNext
      bind:selectedBrowser
      bind:importStatus
      on:done={handleDone}
      alternativeStyle
      showUsageInstructions
    />

    <div class="footer">
      <button
        class="button-prev"
        on:click={() => importer.previousStep()}
        disabled={currentStepIdx === 0}
      >
        <div class="browser-name">Back</div>
      </button>

      <button
        class="button-next"
        class:button-with-icon={importStatus === 'error' || currentStepIdx !== 2}
        on:click={() => importer.nextStep()}
        disabled={!canGoNext}
      >
        <div class="browser-name">
          {#if importStatus === 'error'}
            Try Again
          {:else if currentStepIdx === 3}
            Open Stuff
          {:else if currentStepIdx === 2}
            Next Steps
          {:else if currentStepIdx === 1}
            Import Data
          {:else if currentStepIdx === 0}
            Continue
          {/if}
        </div>

        {#if importStatus === 'error'}
          <Icon name="reload" />
        {:else if currentStepIdx < 2}
          <Icon name="arrow.right" />
        {/if}
      </button>
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    padding-top: 5rem;
    display: flex;
    justify-content: center;
    background-color: white;

    :global(.dark) & {
      color: #e5e5e5;
      background-color: #000000;
    }
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    max-width: 600px;
    width: 90%;
  }

  .header {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .button-prev,
  .button-next {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: 500;
    cursor: default;
  }

  .button-next {
    color: #ffffff;
    background-color: #3b82f6;

    &:disabled {
      background-color: #e5e7eb;
      color: #9ca3af;

      &:hover {
        background-color: #e5e7eb;
      }
    }

    :global(.dark) & {
      background-color: #3a3a3a;
      color: #e5e5e5;
    }

    &:hover {
      background-color: #2563eb;

      :global(.dark) & {
        background-color: #4b5563;
      }
    }
  }

  .button-prev {
    color: #000000;
    background-color: #e5e7eb;

    &:disabled {
      background-color: #e5e7eb;
      color: #9ca3af;

      &:hover {
        background-color: #e5e7eb;
      }
    }

    :global(.dark) & {
      background-color: #3a3a3a;
      color: #e5e5e5;
    }

    &:hover {
      background-color: #d1d5db;

      :global(.dark) & {
        background-color: #4b5563;
      }
    }
  }

  .button-with-icon {
    padding-right: 1rem;
  }
</style>
