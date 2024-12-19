<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { derived, type Writable } from 'svelte/store'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let spaces: Writable<OasisSpace[]>
  export let infoText: string | undefined = undefined

  let selectedSpaceIndex = 0
  let inputRef: HTMLInputElement

  const dispatch = createEventDispatcher<{ 'save-resource-in-space': OasisSpace }>()

  const filteredSpaces = derived([spaces], ([spaces]) => {
    return spaces.filter(
      (space) =>
        space.id !== 'all' &&
        space.id !== 'inbox' &&
        space.dataValue.folderName !== '.tempspace' &&
        !space.dataValue.builtIn
    )
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
    }
  }

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    console.log('Dispatching custom event from handleClick')
    dispatch('save-resource-in-space', $filteredSpaces[selectedSpaceIndex])
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  // onMount(() => {
  //   window.addEventListener('keydown', handleKeydown, true)
  //   focusInput()
  //   return () => {
  //     window.removeEventListener('keydown', handleKeydown, true)
  //   }
  // })
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="shortcut-wrapper">
  {#if infoText}
    <span class="info">{infoText}</span>
  {/if}

  {#if $filteredSpaces && $filteredSpaces.length > 0}
    {#each $filteredSpaces as space, index}
      <span class="label" on:click={() => handleClick(index)} role="none"
        >{space.dataValue.folderName}</span
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
    width: 19rem;
    max-height: 30rem;
    .label {
      display: flex;
      align-items: center;
      padding: 1rem 0.75rem 1rem 1rem;
      border-radius: 12px;

      gap: 10px;
      position: relative;
      color: #3c371f;
      font-weight: 500;
      letter-spacing: 0.0025em;
      font-smooth: always;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      :global(.dark) & {
        color: #d1d1c2;
      }

      &:hover {
        background-color: #e0e0d1;

        :global(.dark) & {
          background-color: #374151;
        }
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

    :global(.dark) & {
      color: #d1d1c2;
      background-color: #1a1a1a;
    }

    ::placeholder {
      color: #b8b5a4;

      :global(.dark) & {
        color: #d1d1c2;
      }
    }
    &:focus {
      outline: none;
    }
  }
  span {
    padding: 8px;
    font-size: 1.1rem;
    text-align: left;
  }
  .active {
    background-color: #ffffff;
    border-radius: 8px;
    color: white;

    :global(.dark) & {
      color: #d1d1c2;
      background-color: #1a1a1a;
    }
  }

  .info {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-weight: 500;
    text-align: left;
    color: #7d7653;
    // border-bottom: 1px solid #e0e0d1;

    :global(.dark) & {
      color: #d1d1c2;
    }
  }
</style>
