<script lang="ts">
  import { Icon } from '@deta/icons'
  import { createEventDispatcher } from 'svelte'

  import {
    WEB_CONTENTS_ERRORS,
    type WebContentsError,
    type WebContentsErrorParsed
  } from '@deta/types'

  export let error: WebContentsError

  const dispatch = createEventDispatcher<{ reload: void }>()

  $: prettyError =
    WEB_CONTENTS_ERRORS[error.code] ||
    ({
      code: error.code,
      name: 'UNKNOWN_ERROR',
      title: 'Failed to load website',
      description: 'An error occurred while trying to load the page.'
    } as WebContentsErrorParsed)

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
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95em;

    :global(.dark) & {
      background: #171717;
      color: #fff;
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 600px;
    max-width: 90%;

    h1 {
      font-size: 1.2em;
      font-weight: 700;
      color: var(--color-text);
    }

    p {
      color: var(--color-text-muted);
    }

    a {
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

      transition: color 0.2s;
      width: fit-content;

      &:hover {
        background: #f92d90;
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .code {
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
