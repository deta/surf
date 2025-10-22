<script lang="ts">
  import Input from './Input.svelte'
  import type { Confirmation } from './types'

  let { confirmationPrompt }: { confirmationPrompt: Confirmation } = $props()
</script>

<div
  class="outer-wrapper modal modal-small"
  role="none"
  on:click|self={confirmationPrompt.cancelHandler}
>
  <div class="inner-wrapper">
    <form
      on:submit|preventDefault={() => confirmationPrompt.confirmHandler(confirmationPrompt.value)}
      class="box confirmation"
    >
      <h1>{confirmationPrompt.title}</h1>
      <p>{confirmationPrompt.message}</p>
      {#if confirmationPrompt.showInput}
        <Input
          placeholder={confirmationPrompt.placeholder}
          bind:value={confirmationPrompt.value}
          required={confirmationPrompt.inputRequired}
          type={confirmationPrompt.inputType}
          autoFocus
        />
      {/if}
      {#if confirmationPrompt.error}
        <p class="error">Error: {confirmationPrompt.error}</p>
      {/if}
      <div class="actions">
        <button
          class="no-button primary"
          class:danger-button={confirmationPrompt.danger}
          type="submit"
          on:click>{confirmationPrompt.confirmText}</button
        >
        <button
          class="no-button secondary"
          on:click|preventDefault={confirmationPrompt.cancelHandler}
          >{confirmationPrompt.cancelText}</button
        >
      </div>
    </form>
  </div>
</div>

<style lang="scss">
  .outer-wrapper {
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
  }

  .modal {
    &.outer-wrapper {
      background: rgba(123, 123, 123, 0.3);
    }

    & :global(.box) {
      overflow-y: auto;
      max-height: calc(100vh - 6rem);
    }

    & :global(.inner-wrapper) {
      max-width: 800px;
      position: unset;
      transform: none;
    }

    &.modal-small {
      & :global(.inner-wrapper) {
        max-width: 500px;
      }
    }
  }

  .inner-wrapper {
    width: 100%;
  }

  .box {
    max-height: min(calc(75vh - 6rem), 600px);
    background: var(--background-dark);
    color: var(--text);
    border: 4px solid var(--border-color);
    border-radius: var(--border-radius);
    outline: 4px solid var(--outline-color);
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .confirmation {
    padding: 1rem;

    h1 {
      font-size: 1.125rem;
      line-height: 1.75rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    p {
      font-size: 1rem;
      line-height: 1.5rem;
      margin-bottom: 1rem;
    }

    & .actions {
      display: flex;
      align-items: center;
      gap: 1rem;

      button {
        padding: 0.5rem 1.25rem;
        border-radius: 0.75rem;
        font-weight: 500;
      }

      & .primary {
        background-color: rgb(242 109 170);
        color: rgb(247 245 242);
        outline-color: #f7b6d0;
        border: solid 4px rgb(247 182 208 / 0.7);
      }

      & .secondary {
        color: var(--text);
        outline-color: #bcb6b1;
        border: solid 4px var(--border-color);
      }

      & .danger-button {
        background-color: var(--red);
        border-color: rgb(255 167 167 / 0.7);
        color: rgb(247 245 242);
      }
    }

    .error {
      color: var(--red);
    }
  }
</style>
