<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'

  import { ERRORS, type WebviewError, type WebviewErrorParsed } from '../../constants/webviewErrors'

  export let error: WebviewError

  const dispatch = createEventDispatcher<{ reload: void }>()

  $: prettyError =
    ERRORS[error.code] ||
    ({
      code: error.code,
      name: 'UNKNOWN_ERROR',
      title: 'Failed to load website',
      description: 'An error occurred while trying to load the page.'
    } as WebviewErrorParsed)

  function handleReload() {
    dispatch('reload')
  }
</script>

<div class="wrapper">
  <div class="content">
    <Icon name="alert-triangle" size="40px" />
    <h1>{prettyError.title}</h1>

    <div class="inner">
      <p>{prettyError.description}</p>
      <a href={error.url}>{error.url}</a>
    </div>

    <p class="code">{prettyError.name} ({prettyError.code})</p>

    <button on:click={handleReload}> Reload Page </button>
  </div>
</div>

<style lang="scss">
  .wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;

    :global(.dark) & {
      background: #171717;
      color: #fff;
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 600px;
    max-width: 90%;

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text);
    }

    p {
      font-size: 1.1rem;
      color: var(--color-text-muted);
    }

    a {
      font-size: 1.1rem;
      color: rgb(66, 93, 243);
      text-decoration: none;
      transition: color 0.2s;

      &:hover {
        color: var(--color-link-dark);
      }
    }

    button {
      padding: 0.5rem 1rem;
      border: none;
      outline: none;
      border-radius: 8px;
      background: #f73b95;
      color: #fff;
      cursor: pointer;
      transition: color 0.2s;
      font-size: 1.1rem;
      width: fit-content;

      &:hover {
        background: #f92d90;
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .code {
      font-size: 1.1rem;
      font-family: monospace;
      opacity: 0.5;
    }
  }

  .inner {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
