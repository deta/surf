<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@deta/icons'
  import { fade, fly } from 'svelte/transition'

  const dispatch = createEventDispatcher()

  export let embeddingModel: UserSettings['embedding_model']

  const languageConfig = {
    english_small: 'English',
    english_large: 'English XL',
    multilingual_small: 'Multi-language',
    multilingual_large: 'Multi-language XL'
  }

  let showContent = false
  let showButton = false

  onMount(() => {
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })

  const handleLanguageSubmit = () => {
    dispatch('modelChange', embeddingModel)
    dispatch('viewChange', 'prefs')
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
        <span class="eyebrow">LANGUAGE SETTINGS</span>
      </div>

      <h1 in:fly={{ x: 35, duration: 500, delay: 250 }}>Optimize Surf's AI for Your Language</h1>
      <div in:fly={{ x: 35, duration: 500, delay: 300 }}>
        <p>
          For the best experience, we recommend choosing <strong>English</strong> if you mostly read
          and browse English websites. If you frequently use websites in multiple languages or
          languages other than English, choose the <strong>Multi-language</strong> option instead.
        </p>
      </div>
      <div in:fly={{ x: 35, duration: 500, delay: 350 }}>
        <p class="caption">Note: This language preference cannot be changed after initial setup.</p>
      </div>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={handleLanguageSubmit}>Surf with {languageConfig[embeddingModel]}</Button
          >
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>
  <div class="language-grid">
    <button
      class="language-button {embeddingModel === 'english_small' ? 'selected' : ''}"
      on:click={() => (embeddingModel = 'english_small')}
    >
      <span class="label">English</span>
      <div class="icon">
        <Icon
          name={embeddingModel === 'english_small' ? 'circle.check' : 'circle'}
          size="24"
          color={embeddingModel === 'english_small' ? '#1d8aff' : 'inherit'}
        />
      </div>
    </button>
    <button
      class="language-button {embeddingModel === 'multilingual_small' ? 'selected' : ''}"
      on:click={() => (embeddingModel = 'multilingual_small')}
    >
      <span class="label">Multi-language</span>
      <div class="icon">
        <Icon
          name={embeddingModel === 'multilingual_small' ? 'circle.check' : 'circle'}
          size="24"
          color={embeddingModel === 'multilingual_small' ? '#1d8aff' : 'inherit'}
        />
      </div>
    </button>
  </div>
</RightPanel>

<style lang="scss">
  .eyebrow {
    font-family: 'Inter', sans-serif;
    display: block;
    margin-bottom: 0.25rem;
    color: var(--color-brand);
    color: color(display-p3 0.3569 0.6078 0.9059);
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-style: normal;
    font-weight: 600;
    line-height: 150%;
    letter-spacing: 1.12px;
  }

  :global(body) {
    font-family: 'Inter', sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

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
    &.caption {
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
    gap: 0.25rem;
    bottom: 0;
    width: 100%;

    button {
      width: 100% !important;
    }
  }

  .language-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 8rem;
    max-height: 100vh;
    overflow-y: hidden;
  }

  .language-button {
    display: flex;
    padding: 14px 20px 15px 19px;
    justify-content: space-between;
    align-items: center;
    gap: 223px;
    align-self: stretch;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    border-radius: 0.825rem;
    border: 0.5px solid rgba(0, 0, 0, 0.13);
    border: 0.5px solid color(display-p3 0 0 0 / 0.13);
    background: #fdfdfd;
    background: color(display-p3 0.9902 0.9902 0.9902);
    box-shadow:
      0px 0px 1px 0px rgba(0, 0, 0, 0.09),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07),
      0px 2px 4px 0px rgba(0, 0, 0, 0.02);
    box-shadow:
      0px 0px 1px 0px color(display-p3 0 0 0 / 0.09),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.07),
      0px 2px 4px 0px color(display-p3 0 0 0 / 0.02);
    transition: all 0.2s ease-in-out;

    &:hover:not(:disabled) {
      background: #ffffff;
      outline: 4px solid rgba(255, 255, 255, 0.4);
    }

    &:disabled {
      opacity: 0.4;
    }

    &.selected {
      background: #e6f0ff;
      background: color(display-p3 0.902 0.9412 1);
      outline: 4px solid rgba(59, 130, 246, 0.4);
    }

    .label {
      font-size: 1.25rem;
      color: #5c5c5c;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
    }

    &.selected .icon {
      opacity: 0.9;
    }
  }
</style>
