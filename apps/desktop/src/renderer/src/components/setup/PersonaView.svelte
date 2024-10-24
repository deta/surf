<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import Box from './Box.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@horizon/icons'
  import { fade, fly } from 'svelte/transition'

  const dispatch = createEventDispatcher()

  export let selectedPersonas: string[]

  const personas = [
    'Student',
    'Software Engineer',
    'Designer',
    'Entrepreneur',
    'Marketing',
    'Artist',
    'Researcher',
    'Product Manager',
    'Writer',
    'Other'
  ]

  let showContent = false
  let showButton = false

  function togglePersona(persona: string) {
    if (selectedPersonas.includes(persona)) {
      selectedPersonas = selectedPersonas.filter((p) => p !== persona)
    } else if (selectedPersonas.length < 3) {
      selectedPersonas = [...selectedPersonas, persona]
    }
    dispatch('personasChange', selectedPersonas)
  }

  const handlePersonaSubmit = () => {
    if (selectedPersonas.length === 0) {
      selectedPersonas = ['Other']
    }
    dispatch('personasChange', selectedPersonas)
    dispatch('viewChange', 'explainer.stuff')
  }

  const handleBack = () => {
    dispatch('back')
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
    <!-- <button on:click={handleBack} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button> -->
    <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
      <span class="eyebrow">TELL US ABOUT YOURSELF</span>
    </div>
    {#if showContent}
      <h1 in:fly={{ x: 35, duration: 500, delay: 250 }}>Select up to 3 that best describe you</h1>
      <p in:fly={{ x: 35, duration: 500, delay: 300 }}>
        This will help us to provide a better onboarding experience.
      </p>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        {#if selectedPersonas.length === 0}
          <button
            class="skip-button"
            on:click={() => handlePersonaSubmit()}
            in:fly={{ x: 35, duration: 500, delay: 350 }}>Skip</button
          >
        {/if}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={handlePersonaSubmit} disabled={selectedPersonas.length === 0}
            >Show Surf's Features</Button
          >
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>
  <div class="persona-grid">
    {#if selectedPersonas.length > 0}
      <p class="selected-count">
        Selected: {selectedPersonas.length}/3
      </p>
    {/if}
    <div class="grid-container">
      {#each personas as persona}
        <button
          class="persona-button {selectedPersonas.includes(persona) ? 'selected' : ''}"
          on:click={() => togglePersona(persona)}
          disabled={selectedPersonas.length >= 3 && !selectedPersonas.includes(persona)}
        >
          <span class="label">{persona}</span>
          <div class="icon">
            <Icon
              name={selectedPersonas.includes(persona) ? 'circle.check' : 'circle'}
              size="24"
              color={selectedPersonas.includes(persona) ? '#1d8aff' : 'inherit'}
            />
          </div>
        </button>
      {/each}
    </div>
  </div>
</RightPanel>

<Box></Box>

<style lang="scss">
  .persona-grid {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    height: 100vh;
    padding-bottom: 5.5rem;
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(2, minmax(150px, 1fr));
    gap: 1.5rem;
    width: 100%;
  }

  .persona-button {
    display: flex;
    gap: 0;
    padding: 14px 20px;
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
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
      white-space: nowrap;
      text-align: left;
      flex-grow: 1;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      margin-left: auto;
    }

    &.selected .icon {
      opacity: 0.9;
    }
  }

  .selected-count {
    position: absolute;
    top: 5rem;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;
  }

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
    margin-top: 2rem;
    letter-spacing: 1.12px;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 400;
    color: #333;
    margin-bottom: 1rem;
    text-wrap: balance;
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

  .skip-button {
    border: 0;
    background: none;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    padding: 1rem;
    font-size: 1rem;
    color: #888;
    transition: color 0.2s ease-in-out;

    &:hover {
      color: #666;
    }
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
    bottom: 2rem;
    width: 100%;

    button {
      width: 100% !important;
    }
  }
</style>
