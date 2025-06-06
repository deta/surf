<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'

  import { isMac, isModKeyPressed } from '@horizon/utils'
  import { Icon } from '@horizon/icons'
  import { writable } from 'svelte/store'
  import { tooltip } from '@horizon/utils'

  export let value: string = ''
  export let loading = false
  export let placeholder = 'Search'

  const expanded = writable(false)

  const dispatch = createEventDispatcher<{ search: string; chat: string; close: void }>()

  let inputEl: HTMLInputElement

  const handleFocusIn = (e: FocusEvent) => {
    handleActivate()
  }
  const handleFocusOut = (e: FocusEvent) => {
    if (value.length > 0) return
    handleDeactivate()
  }

  const handleActivate = () => {
    $expanded = true
    inputEl.focus()
  }
  const handleDeactivate = () => {
    value = ''
    $expanded = false
    inputEl.blur()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (isModKeyPressed(event)) {
        return
      }

      dispatch('search', value)
    } else if (event.key === 'Escape') {
      handleDeactivate()
      event.stopImmediatePropagation()
      event.preventDefault()
      dispatch('close')
    } else {
      dispatch('search', value)
    }
  }

  onMount(() => {
    tick()
      .then(() => inputEl.focus())
      .then(() => inputEl.blur())
  })
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.metaKey && e.key === 'f') {
      if (!$expanded) handleActivate()
      else {
        if (inputEl === window.document.activeElement) {
          handleDeactivate()
        } else {
          handleActivate()
        }
      }
      e.stopPropagation()
    } else if (e.target !== document.body) return
    else if (
      !$expanded &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      String.fromCharCode(e.keyCode).match(/(\w|\s)/g)
    ) {
      handleActivate()
      //value = e.key
      e.stopPropagation()
    }
  }}
/>

<div
  class="search-wrapper"
  class:expanded={$expanded}
  on:click={handleActivate}
  role="none"
  on:focusin={handleFocusIn}
  on:focusout={handleFocusOut}
>
  {#if loading}
    <Icon name="spinner" class="shrink-0 icon" size="1.2em" />
  {:else}
    <Icon name="search" class="shrink-0  icon" size="1.2em" />
  {/if}
  <input
    bind:this={inputEl}
    bind:value
    type="text"
    {placeholder}
    class="flex bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50"
    on:keydown={handleKeyDown}
    use:tooltip={{
      position: 'top',
      text: 'Search',
      disabled: $expanded
    }}
  />
  {#if value.length <= 0 && $expanded}
    <span class="shortcut">{isMac() ? '⌘' : 'Ctrl'} + F</span>
  {/if}
</div>

<style lang="scss">
  .search-wrapper {
    position: relative;
    width: fit-content;

    display: flex;
    align-items: center;
    padding: 0.5rem 0.6rem;
    border-radius: 0.75rem;

    text-box: trim-both cap alphabetic;

    interpolate-size: allow-keywords;
    overflow: hidden;

    input {
      color: var(--contrast-color);
      transition: width 143ms cubic-bezier(0.13, 1.02, 0.33, 1);
      interpolate-size: allow-keywords;
      padding-inline: 0.5em;

      &::placeholder {
        color: var(--contrast-color);
        opacity: 0.5;
      }
    }

    &.expanded {
      width: fit-content;
      input {
        width: 22ch;
      }
    }
    &:not(.expanded) {
      input {
        width: 0;
        padding-inline: 0;
      }
    }

    &:has(input:focus) {
      background: rgb(from var(--base-color) r g b / 0.4);
      border: 1px solid rgb(from var(--base-color) r g b / 0.9);
    }

    &:not(.expanded):hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
      opacity: 1;
    }
  }

  .shortcut {
    user-select: none;
    flex-shrink: 0;
    font-size: 0.9em;
    text-box: trim-both cap alphabetic;
    opacity: 0.7;
  }
</style>
