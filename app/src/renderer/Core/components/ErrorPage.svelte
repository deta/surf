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
    background: light-dark(#fff, #171717);
    color: light-dark(#000, #fff);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95em;
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
      color: light-dark(rgb(66, 93, 243), rgb(129, 146, 255));
      text-decoration: none;
      transition: color 0.2s;

      &:hover {
        color: light-dark(var(--color-link-dark), rgb(159, 173, 255));
      }
    }

    button {
      padding: 0.5rem 1rem;
      border: none;
      outline: none;
      border-radius: 8px;
      background: light-dark(#f73b95, #d63384);
      color: #fff;

      transition: color 0.2s;
      width: fit-content;

      &:hover {
        background: light-dark(#f92d90, #e04a94);
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
