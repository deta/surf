<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { derived, type Writable } from 'svelte/store'
  import type { Space } from '../../types'

  export let spaces: Writable<Space[]>
  export let closePopover: () => void

  let selectedSpaceIndex = 0
  let inputRef: HTMLInputElement

  const dispatch = createEventDispatcher()

  const filteredSpaces = derived([spaces], ([spaces]) => {
    return spaces.filter((space) => space.id !== 'all')
  })

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'ArrowDown') {
        selectedSpaceIndex = (selectedSpaceIndex + 1) % $filteredSpaces.length
      } else if (event.key === 'ArrowUp') {
        selectedSpaceIndex =
          (selectedSpaceIndex - 1 + $filteredSpaces.length) % $filteredSpaces.length
      }
    } else if (event.key === 'Enter') {
      console.log('Dispatching custom event from handleKeydown')
      dispatch('save-resource-in-space', $filteredSpaces[selectedSpaceIndex])
      closePopover()
    }
  }

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    console.log('Dispatching custom event from handleClick')
    dispatch('save-resource-in-space', $filteredSpaces[selectedSpaceIndex])
    closePopover()
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown, true)
    focusInput()
    return () => {
      window.removeEventListener('keydown', handleKeydown, true)
    }
  })
</script>

<div class="shortcut-wrapper">
  {#if $filteredSpaces && $filteredSpaces.length > 0}
    {#each $filteredSpaces as space, index}
      <span
        class="label"
        class:active={index === selectedSpaceIndex}
        on:click={() => handleClick(index)}
        aria-hidden="true">{space.name.folderName}</span
      >
    {/each}
  {:else}
    <span>No spaces available</span>
  {/if}
</div>

<style lang="scss">
  .shortcut-wrapper {
    display: flex;
    overflow-y: auto;
    flex-direction: column;
    width: 18rem;
    max-height: 30rem;
    .label {
      display: flex;
      align-items: center;
      padding: 1rem 0.75rem 1rem 1rem;
      border-radius: 12px;
      cursor: pointer;
      gap: 10px;
      position: relative;
      color: #7d7448;
      font-weight: 500;
      letter-spacing: 0.0025em;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      &:hover {
        background-color: #e0e0d1;
      }

      & * {
        user-select: none;
      }

      &.pinned {
        padding: 0.75rem;
      }
    }
  }
  .search-input {
    font-family: 'Inter', sans-serif;
    border: 0;
    padding: 1rem;
    border-radius: 12px;
    background-color: #f5f5f5;
    font-size: 1.1rem;
    font-weight: 500;
    color: #585130;
    letter-spacing: 0.0025em;
    font-smooth: always;
    background: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    ::placeholder {
      color: #b8b5a4;
    }
    &:focus {
      outline: none;
    }
  }
  span {
    padding: 8px;
    font-size: 1.1rem;
    text-align: left;
    cursor: pointer;
  }
  .active {
    background-color: #ffffff;
    border-radius: 8px;
    color: white;
  }
</style>
