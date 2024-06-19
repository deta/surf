<script lang="ts">
  import './index.css'

  import { createEventDispatcher } from 'svelte'
  import { IconConfirmation } from '@horizon/icons'

  import Wrapper from './Wrapper.svelte'
  import Button from './Button.svelte'
  import CopyButton from './CopyButton.svelte'

  export let text = ''

  let openIcon: IconConfirmation
  let removeIcon: IconConfirmation

  const dispatch = createEventDispatcher<{
    close: void
    open: void
    remove: void
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

  const handleClose = () => {
    dispatch('close')
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<Wrapper expanded>
  <div class="output">
    <p>{@html text}</p>
  </div>

  <div class="footer">
    <div class="actions">
      <!-- <Button on:click={handleOpenOasis} tooltip="Open in Oasis">
        <IconConfirmation bind:this={openIcon} name="leave" />
      </Button> -->

      <CopyButton {text} />

      <Button on:click={handleRemove} tooltip="Remove Comment">
        <IconConfirmation bind:this={removeIcon} name="trash" />
      </Button>
    </div>

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

    p {
      margin: 0;
    }
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .actions {
    display: flex;
    align-items: stretch;
  }
</style>
