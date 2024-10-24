<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@horizon/icons'
  import { fade, fly } from 'svelte/transition'

  const dispatch = createEventDispatcher()

  let showContent = false
  let showButton = false

  onMount(() => {
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })

  const handleAcceptAIFeatures = () => {
    dispatch('viewChange', 'persona')
  }

  const handleBack = () => {
    dispatch('back')
  }
</script>

<LeftPanel>
  <div class="wrapper">
    <button on:click={handleBack} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button>
    {#if showContent}
      <h1 in:fly={{ x: 35, duration: 500, delay: 250 }}>
        Choose Apps or Websites you use the most.
      </h1>
      <p in:fly={{ x: 35, duration: 500, delay: 300 }}>
        Select all the Apps to pin them in your bar.
      </p>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={handleAcceptAIFeatures}>I understand</Button>
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>DEMO</RightPanel>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .bottom {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    bottom: 0;
    width: 100%;

    button {
      width: 100% !important;
    }
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #333;
    margin-bottom: 1rem;
    text-wrap: balance;
    margin-top: 2rem;
  }

  p {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    margin-bottom: 1rem;
    text-wrap: pretty;
    &.caption {
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0.225px;
      color: #888;
    }
  }
</style>
