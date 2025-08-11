<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@horizon/icons'
  import { fade, fly } from 'svelte/transition'
  import ImporterV2, {
    type ImporterStep,
    type ImportStatus
  } from '@horizon/core/src/lib/components/Core/Importer/ImporterV2.svelte'
  import ImportStepTitle from '@horizon/core/src/lib/components/Core/Importer/ImportStepTitle.svelte'
  import ImportStepDescription from '@horizon/core/src/lib/components/Core/Importer/ImportStepDescription.svelte'

  import type { BrowserTypeItem } from '@deta/types'

  import appIcon from '../../assets/icon_512.png'

  const dispatch = createEventDispatcher()

  let showContent = false
  let showButton = false

  let currentStepIdx: number = 0
  let canGoNext: boolean = false
  let selectedBrowser: BrowserTypeItem | null = null
  let importStatus: ImportStatus
  let importer: ImporterV2

  const handleContinue = async () => {
    dispatch('viewChange', 'contexts')
  }

  const handleBack = () => {
    if (currentStepIdx > 0) {
      importer.previousStep()
    } else {
      dispatch('back')
    }
  }

  onMount(() => {
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })
</script>

<LeftPanel>
  <div class="wrapper">
    <button on:click={handleBack} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button>
    {#if showContent}
      <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
        <ImportStepTitle {currentStepIdx} {selectedBrowser} {importStatus} />
      </div>
      <div in:fly={{ x: 35, duration: 500, delay: 300 }}>
        <ImportStepDescription {currentStepIdx} {selectedBrowser} {importStatus} initialImport />
      </div>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={() => importer.nextStep()} disabled={!canGoNext}>
            {#if importStatus === 'error'}
              Try Again
            {:else if currentStepIdx === 2}
              Continue
            {:else if currentStepIdx === 1}
              Import Data
            {:else if currentStepIdx === 0}
              Continue
            {/if}
          </Button>
        </div>

        <div in:fade={{ duration: 300 }}>
          <button
            on:click={handleContinue}
            disabled={currentStepIdx === 2 && importStatus === 'done'}
            class="skip-button">Skip Import</button
          >
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>
  <div class="demo-wrapper">
    {#if currentStepIdx !== 0 && selectedBrowser}
      <div class="import-icons">
        <Icon name={selectedBrowser.icon} size="69px" />

        <Icon name="arrow.right" size="30px" />

        <img src={appIcon} alt="App Icon" width="80px" height="80px" />
      </div>
    {/if}

    <ImporterV2
      bind:this={importer}
      bind:currentStepIdx
      bind:canGoNext
      bind:selectedBrowser
      bind:importStatus
      on:done={handleContinue}
    />
  </div>
</RightPanel>

<style lang="scss">
  .back-button {
    background: none;
    border: none;

    padding: 4px;
    margin-bottom: 20px;

    &:hover {
      opacity: 0.8;
    }
  }

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
  }

  p {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    margin-bottom: 1rem;
    text-wrap: pretty;

    &.faded {
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0.225px;
      color: #888;
    }
  }

  .actions {
    margin-top: 2rem;
  }

  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .bottom {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    bottom: 0;
    width: 100%;

    button {
      width: 100% !important;
    }
  }

  .skip-button {
    background: none;
    border: none;
    color: #666666;
    font-size: 1.1rem;
    font-weight: 500;
    padding: 0.5rem 1rem;
    cursor: default;

    &:disabled {
      color: #aaaaaa;
      cursor: not-allowed;

      &:hover {
        color: #aaaaaa;
      }
    }

    &:hover {
      color: #343434;
    }
  }

  .demo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    height: 100%;
    gap: 3rem;
  }

  .import-icons {
    display: flex;
    gap: 1.25rem;
    align-items: center;
    justify-content: center;
    color: white;
  }
</style>
