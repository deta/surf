<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  const handleCloseModal = () => {
    dispatch('close-modal')
  }

  const handleSubmit = () => {
    dispatch('submit')
    dispatch('close-modal')
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      handleCloseModal()
    } else if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }}
/>

<div class="dialog">
  <div class="dialog-header">
    <h2>Overlay Dialog</h2>

    <button on:click={handleCloseModal} class="close-button" aria-label="Close">
      <Icon name="close" size="20px" /></button
    >
  </div>
  <div class="dialog-body">
    <p>This is a message in the middle of the dialog.</p>
  </div>
  <div class="dialog-footer">
    <button on:click={handleCloseModal} class="cancel-button">Cancel</button>
    <button on:click={handleSubmit} class="create-button">Submit</button>
  </div>
</div>

<style lang="scss">
  .dialog {
    z-index: 1000000000;
    border: 0.5px solid #ccc;
    border-radius: 24px;
    padding: 1rem;
    width: 40rem;
    background: #f6faff;

    background: color(display-p3 0.9661 0.9801 1);

    box-shadow:
      0px 350px 98px 0px #36383a,
      0px 224px 90px 0px rgba(54, 56, 58, 0.01),
      0px 126px 76px 0px rgba(54, 56, 58, 0.05),
      0px 56px 56px 0px rgba(54, 56, 58, 0.09),
      0px 14px 31px 0px rgba(54, 56, 58, 0.1);

    box-shadow:
      0px 350px 98px 0px color(display-p3 0.2118 0.2196 0.2275 / 0),
      0px 224px 90px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.01),
      0px 126px 76px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.05),
      0px 56px 56px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.09),
      0px 14px 31px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.1);
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding: 1rem 2rem 1rem 2rem;
    color: #28568f;
    opacity: 0.4;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 4rem 0 6rem 0;
    gap: 4rem;
    margin-bottom: 16px;
  }

  .dialog-footer {
    display: flex;
  }

  .cancel-button,
  .create-button {
    font-weight: 500;
    font-size: 1.125rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    width: 50%;
    padding: 1.4rem 1.875rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .cancel-button {
    background-color: #fff;
    color: #28568f;
    margin-right: 8px;
  }

  .cancel-button:hover {
    background-color: #d1edff;
    color: #173861;
  }

  .create-button {
    background-color: #47b1f3;
    color: #fff;
  }

  .create-button:hover {
    background-color: #29a6f3;
  }
</style>
