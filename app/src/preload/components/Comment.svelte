<script lang="ts">
  import './index.css'

  import { createEventDispatcher } from 'svelte'
  import { Icon, IconConfirmation } from '@deta/icons'

  import Wrapper from './Wrapper.svelte'
  import Button from './Button.svelte'
  import CopyButton from './CopyButton.svelte'
  import Editor from '@deta/editor/src/lib/components/Editor.svelte'
  import { useDebounce } from '@deta/utils/system'
  import { getEditorContentText } from '@deta/editor'
  import { slide } from 'svelte/transition'

  export let text = ''

  let openIcon: IconConfirmation
  let removeIcon: IconConfirmation
  let didSave = false

  const dispatch = createEventDispatcher<{
    close: void
    open: void
    remove: void
    updateContent: { plain: string; html: string }
  }>()

  const handleOpenOasis = () => {
    openIcon.showConfirmation()
    dispatch('open')
  }

  const handleRemove = () => {
    removeIcon.showConfirmation()
    dispatch('remove')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const shortcutCombo = (e.metaKey || e.ctrlKey) && e.shiftKey
    if (e.key === 'Escape') {
      e.preventDefault()
      dispatch('close')
    } else if (shortcutCombo && e.key === 'o') {
      e.preventDefault()
      handleOpenOasis()
    } else if (shortcutCombo && e.key === 'Backspace') {
      e.preventDefault()
      handleRemove()
    }
  }

  const handleInputKey = (e: KeyboardEvent) => {
    // check if key is letter or other visible character and stop propagation to prevent site shortcuts from firing
    if (e.key.length === 1 || e.key === ' ' || e.key === 'Backspace') {
      e.stopImmediatePropagation()
    }
  }

  const handleClose = () => {
    dispatch('close')
  }

  const handleUpdate = useDebounce((e: CustomEvent<string>) => {
    const html = e.detail
    const text = getEditorContentText(html)
    dispatch('updateContent', { plain: text, html })
    didSave = true
    setTimeout(() => {
      didSave = false
    }, 3000)
  }, 500)
</script>

<svelte:window on:keydown={handleKeyDown} />

<Wrapper expanded>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="output"
    on:keydown={handleInputKey}
    on:keyup={handleInputKey}
    on:keypress={handleInputKey}
  >
    <Editor
      bind:content={text}
      on:update={handleUpdate}
      parseHashtags
      submitOnEnter
      autofocus={false}
      placeholder="Jot down your thoughts…"
    />
  </div>

  <div class="footer">
    {#if didSave}
      <div data-tooltip="Saved!" class="success" transition:slide={{ axis: 'x' }}>
        <Icon name="check" />
        <!-- <p>Saved!</p> -->
      </div>
    {/if}

    <!-- <Button on:click={handleOpenOasis} tooltip="Open in Oasis">
      <IconConfirmation bind:this={openIcon} name="save" />
    </Button> -->

    <CopyButton {text} />

    <Button on:click={handleRemove} tooltip="Remove Comment">
      <IconConfirmation bind:this={removeIcon} name="trash" confirmationIcon="spinner" />
    </Button>

    <Button on:click={handleClose} tooltip="Close Comment" icon="close" />
  </div>
</Wrapper>

<style lang="scss">
  .output {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    font-size: 16px;
    color: #333;
    background: #f0f0f0;
    padding: 12px;
    border-radius: 8px;
    user-select: text;
    border: 2px solid #d4d4d4;
  }

  .footer {
    position: absolute;
    top: 0;
    right: -2rem;
    transform: translate(0, -50%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    padding: 0.25rem;
    background: white;
    border: 1px solid #f0f0f0;
    border-radius: calc(8px + 0.25rem);
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
  }

  :global(.deta-component-wrapper:hover .footer) {
    opacity: 1;
  }

  .success {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #4caf50;
    padding: 0 8px;
  }
</style>
