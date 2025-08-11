<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import SpaceIcon from '@horizon/core/src/lib/components/Atoms/SpaceIcon.svelte'
  import type { SpaceIconChange } from '@horizon/core/src/lib/components/Oasis/IconSelector.svelte'
  import { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  // Context creation props
  export let space: OasisSpace | undefined = undefined
  export let contextName = ''
  export let contextEmoji = ''
  export let contextColors: [string, string] = ['#76E0FF', '#4EC9FB']
  export let contextImage: string | null = null

  const dispatch = createEventDispatcher()
  let inputElement: HTMLInputElement

  function focusInput(node: HTMLInputElement) {
    inputElement = node
    node.focus()
    return {}
  }

  onMount(() => {
    if (inputElement) {
      setTimeout(() => inputElement.focus(), 100)
    }
  })

  function handleSpaceIconUpdate(event: CustomEvent<SpaceIconChange>) {
    const { colors: updatedColors, emoji, imageIcon } = event.detail
    if (updatedColors) {
      contextColors = updatedColors
    } else {
      contextColors = undefined
    }

    contextEmoji = emoji ?? null
    contextImage = imageIcon ?? null

    dispatch('iconUpdate', event.detail)
  }
</script>

<div class="component-container" in:fly={{ x: 35, duration: 500, delay: 650 }}>
  <div class="context-creation-container">
    <div class="context-creation">
      <div class="icon-wrapper">
        <SpaceIcon on:update={handleSpaceIconUpdate} folder={space} size="2xl" round isCreating />
      </div>
      <input
        type="text"
        bind:value={contextName}
        placeholder="Context name"
        autofocus
        use:focusInput
      />
    </div>

    <p class="faded">Click the icon to change it.</p>
  </div>
</div>

<style lang="scss">
  .component-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    max-width: 50rem;
    margin: 0 auto;
    margin-bottom: 8rem;
    padding: 1.5rem;
  }

  .context-creation-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  p {
    &.faded {
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0.225px;
      color: rgba(255, 255, 255, 0.85);
      margin-top: 0.5rem;
    }
  }
  .context-creation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    margin-bottom: 0.5rem;

    .icon-wrapper {
      background-color: rgba(255, 255, 255, 0.95);
      padding: 4rem;
      border-radius: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      &:hover {
        background-color: rgba(255, 255, 255, 1);
      }
    }

    input {
      font-family: 'SN-Pro', sans-serif;
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-weight: bold;
      border-radius: 8px;
      font-size: 1.75rem;
      line-height: 1.5;
      background: transparent;
      border: 1.5px dashed rgba(255, 255, 255, 0.95);
      color: #fff;
      text-align: center;

      &:focus {
        outline: none;
        border-color: #3b82f6;
      }
    }
  }
</style>
