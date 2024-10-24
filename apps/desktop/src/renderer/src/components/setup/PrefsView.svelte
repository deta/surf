<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@horizon/icons'
  import contentStructure from './config'
  import { type Role } from './config'
  import { fade, fly } from 'svelte/transition'
  import LayoutPicker from '../LayoutPicker.svelte'

  const dispatch = createEventDispatcher()

  export let tabsOrientation: 'horizontal' | 'vertical'
  let showContent = false
  let showButton = false

  onMount(() => {
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })

  const handleAcceptPrefs = () => {
    dispatch('orientationChange', tabsOrientation)
    dispatch('viewChange', 'done')
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
      <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
        <h1>Surf Layout</h1>
      </div>
      <div in:fly={{ x: 35, duration: 500, delay: 300 }}>
        <p>
          You can change this behavior later at <br /> <span class="pill">View</span> →
          <span class="pill">Toggle Tabs Orientation</span>
        </p>
      </div>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={handleAcceptPrefs}>Surf {tabsOrientation}</Button>
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel gradient={false}>
  <div class="layout-wrapper">
    <LayoutPicker bind:orientation={tabsOrientation} />
  </div>
</RightPanel>

<style lang="scss">
  .back-button {
    background: none;
    border: none;
    cursor: pointer;
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
  }

  .actions {
    margin-top: 2rem;
  }

  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .layout-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
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
</style>
