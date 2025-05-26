<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import DemoStuff from './DemoStuff.svelte'
  import { Icon } from '@horizon/icons'
  import contentStructure from './config'
  import { type Role } from './config'
  import { fade, fly } from 'svelte/transition'

  export let persona: string[]
  const dispatch = createEventDispatcher()

  let resolvedPersona: Role[] = []
  let currentContent: typeof contentStructure.Other.stuff
  let showContent = false
  let showButton = false
  let expanded = true

  function mapToContentRole(role: Role): keyof typeof contentStructure {
    const contentRoles: (keyof typeof contentStructure)[] = ['Student', 'Designer', 'Other']
    return contentRoles.includes(role as any) ? (role as keyof typeof contentStructure) : 'Other'
  }

  function updateContent() {
    const contentRole = mapToContentRole(resolvedPersona[0] || 'Other')
    currentContent = contentStructure[contentRole].stuff
  }

  onMount(() => {
    resolvedPersona = persona.filter((role): role is Role =>
      Object.keys(contentStructure).includes(role)
    )
    resolvedPersona = [...new Set(resolvedPersona)]
    if (resolvedPersona.length === 0) {
      resolvedPersona = ['Other']
    }
    updateContent()
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })

  const handleSubmit = () => {
    expanded = false
  }

  const handleContinueToDemo = () => {
    dispatch('viewChange', 'contexts')
  }

  const handleBack = () => {
    expanded = true
  }

  const handleBackFromDemo = () => {
    dispatch('back')
  }
</script>

<LeftPanel {expanded}>
  <div class="wrapper">
    <button on:click={handleBack} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button>
    {#if currentContent && showContent}
      <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
        {#if currentContent.eyebrow}
          <span class="eyebrow">{currentContent.eyebrow}</span>
        {/if}
      </div>

      <h1 in:fly={{ x: 35, duration: 500, delay: 250 }}>{currentContent.headline}</h1>
      <div in:fly={{ x: 35, duration: 500, delay: 300 }}>
        {#each currentContent.description as paragraph}
          <p>{paragraph}</p>
        {/each}
      </div>
      <div in:fly={{ x: 35, duration: 500, delay: 350 }}>
        {#if currentContent.caption}
          <p
            class="caption"
            in:fly={{ x: 35, duration: 500, delay: 600 + currentContent.description.length * 200 }}
          >
            {currentContent.caption}
          </p>
        {/if}
      </div>
    {:else if !currentContent}
      <h1 in:fly={{ x: 50, duration: 500, delay: 0 }}>Content Not Available</h1>
      <p in:fly={{ x: 50, duration: 500, delay: 200 }}>
        We're sorry, but the content for your selected role is not available at the moment.
      </p>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <div in:fade={{ duration: 300 }}>
          <Button on:click={expanded ? handleSubmit : handleContinueToDemo} disabled={false}
            >Continue</Button
          >
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel {expanded}>
  {#if expanded}
    <button on:click={handleBackFromDemo} class="back-button" aria-label="Go back">
      <Icon name="arrow.left" size="28" color="#3B82F6" />
    </button>
  {/if}
  <DemoStuff running={expanded} on:finish={handleSubmit} />
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
    letter-spacing: 0.02rem;
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

  :global(.persona-grid) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  :global(.persona-button) {
    display: flex;
    padding: 14px 20px 15px 19px;
    justify-content: space-between;
    align-items: center;
    gap: 223px;
    align-self: stretch;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    border-radius: 9px;
    border: 0.5px solid rgba(0, 0, 0, 0.13);
    background: #fdfdfd;
    box-shadow:
      0px 0px 1px 0px rgba(0, 0, 0, 0.09),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07),
      0px 2px 4px 0px rgba(0, 0, 0, 0.02);
    transition: all 0.2s ease-in-out;

    &:hover:not(:disabled) {
      background: #f0f0f0;
    }

    &.selected {
      background: #e6f0ff;
      border-color: #3b82f6;
    }

    .label {
      font-size: 1.25rem;
      color: #5c5c5c;
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
</style>
