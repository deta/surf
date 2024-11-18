<script lang="ts">
  import { onMount } from 'svelte'
  import type { WebviewTag } from 'electron'
  import { useLogScope, isModKeyAndKeyPressed } from '@horizon/utils'

  export let webview: WebviewTag
  export let value = ''
  export let show = false
  export let getSelection: () => Promise<string>

  let matches = 0
  let activeMatchOrdinal = 0
  let requestId = 0
  let inputElem: HTMLInputElement

  const log = useLogScope('FindInPage')

  export const open = async () => {
    log.debug('open find')
    show = true
    await new Promise((resolve) => setTimeout(resolve, 0))
    const selection = await getSelection()
    if (selection) {
      value = selection
      find()
    }
    inputElem?.focus()
  }

  export const find = async (searchValue?: string) => {
    if (searchValue !== undefined) {
      value = searchValue
      await new Promise((resolve) => setTimeout(resolve, 0))
      inputElem?.focus()
      inputElem?.setSelectionRange(0, searchValue.length)
    }

    log.debug('start find', searchValue, value)

    if (value === '') {
      return
    }

    requestId = webview.findInPage(value)
  }

  export const findNext = () => {
    if (!value) return
    log.debug('find next')
    requestId = webview.findInPage(value, {
      forward: true,
      findNext: true,
      matchCase: false
    })
  }

  export const findPrevious = () => {
    if (!value) return
    log.debug('find previous')
    requestId = webview.findInPage(value, {
      forward: false,
      findNext: true,
      matchCase: false
    })
  }

  export const close = () => {
    show = false
    stopFind()
  }

  export const stopFind = () => {
    try {
      log.debug('stop find')
      value = ''
      matches = 0
      activeMatchOrdinal = 0
      webview?.stopFindInPage('clearSelection')
    } catch (_) {}
  }

  export const isOpen = () => show

  export const handleFindResult = (event: Electron.FoundInPageEvent) => {
    const result = event.result
    log.debug('result', result)

    if (result.requestId !== requestId) {
      log.warn('requestId mismatch', result.requestId, requestId)
      return
    }

    matches = result.matches
    activeMatchOrdinal = result.activeMatchOrdinal
  }

  const handleKeyDown = async (event: KeyboardEvent) => {
    log.debug('handleKeyDown', event)
    if (event.key === 'Escape') {
      close()
    } else if (isModKeyAndKeyPressed(event, 'f')) {
      event.preventDefault()
      const selection = await getSelection()
      log.debug('selection', selection)
      if (selection) {
        find(selection)
      } else {
        close()
      }
    } else if (event.key === 'ArrowUp' || (event.shiftKey && event.key === 'Enter')) {
      event.preventDefault()
      findPrevious()
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault()
      findNext()
    } else if (value === '' && event.key === 'Backspace') {
      close()
    }
  }

  const handleInput = () => {
    if (value === '') {
      stopFind()
    } else {
      find()
    }
  }

  onMount(() => {
    webview?.addEventListener('found-in-page', handleFindResult)

    return () => {
      webview?.removeEventListener('found-in-page', handleFindResult)
      stopFind()
    }
  })
</script>

{#if show}
  <div class="find-wrapper">
    <div class="find-input">
      <input
        bind:this={inputElem}
        bind:value
        on:keydown={handleKeyDown}
        on:input={handleInput}
        type="text"
        placeholder="find in page"
      />
    </div>

    <div class="find-result">
      {#if value !== ''}
        <span>
          {activeMatchOrdinal}/{matches}
        </span>
      {/if}
    </div>

    <div class="find-actions">
      <button on:click={findPrevious}> ↑ </button>
      <button on:click={findNext}> ↓ </button>
      <button on:click={close}> ✕ </button>
    </div>
  </div>
{/if}

<style lang="scss">
  .find-wrapper {
    position: fixed;
    top: 2rem;
    right: 5rem;
    z-index: 1000;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(16px);
    padding: 0.5rem;
    border-radius: calc(8px + 0.25rem);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 300px;
    max-width: 80%;
    overflow: hidden;
  }

  .find-input {
    flex: 1;
    flex-shrink: 0;
    min-width: 50px;

    input {
      width: 100%;
      appearance: none;
      outline: none;
      padding: 6px 0 6px 6px;
      border-radius: 8px;
      border: none;
      font-size: 1rem;
      background-color: rgba(255, 255, 255, 0.8);
      border: 0.5px solid rgba(0, 0, 0, 0.05);

      &:focus {
        background: #fbeaf2;
        outline: 2px solid #e173a8;
        outline-offset: 2px;
      }
    }
  }

  .find-result {
    width: fit-content;
  }

  .find-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    button {
      appearance: none;
      outline: none;
      padding: 0.25rem;
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background-color: #f3d8f2;
      }
    }
  }
</style>
