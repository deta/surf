<script lang="ts" context="module">
  export type ShortcutMenuEvents = {
    'create-tab-from-space': OasisSpace
    'create-new-space': {
      name: string
      processNaturalLanguage: boolean
    }
    'update-existing-space': {
      name: string
      space: OasisSpace
      processNaturalLanguage: boolean
      userPrompt: string
      resourceIds?: string[]
    }
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@deta/icons'
  import { writable, derived, type Writable } from 'svelte/store'
  import { tooltip } from '@deta/utils'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'

  export let spaces: Writable<OasisSpace[]>
  export let closePopover: () => void

  let selectedSpaceIndex = 0
  let inputRef: HTMLInputElement
  const searchQuery = writable('')

  const dispatch = createEventDispatcher<ShortcutMenuEvents>()

  const isCreatingNewSpace = writable(false)
  let newSpaceName = ''

  const filteredSpaces = derived([spaces, searchQuery], ([spaces, searchQuery]) => {
    return spaces.filter((space) => {
      if (space.dataValue.showInSidebar) {
        return false
      }

      if (searchQuery) {
        return space.dataValue.folderName.toLowerCase().includes(searchQuery.toLowerCase())
      }

      return true
    })
  })

  const handleKeydown = (event: KeyboardEvent) => {
    if (inputRef && inputRef === document.activeElement) {
      return
    }

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
      event.preventDefault()
      event.stopImmediatePropagation()
      closePopover()
      dispatch('create-tab-from-space', $filteredSpaces[selectedSpaceIndex])
    }
  }

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    closePopover()
    dispatch('create-tab-from-space', $filteredSpaces[selectedSpaceIndex])
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  const startCreatingNewSpace = async () => {
    isCreatingNewSpace.set(true)
    await tick().then(() => {
      inputRef.focus()
    })
  }

  const cancelCreatingNewSpace = () => {
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  const confirmCreatingNewSpace = (processNaturalLanguage: boolean) => {
    dispatch('create-new-space', { name: newSpaceName, processNaturalLanguage })
    isCreatingNewSpace.set(false)
    newSpaceName = ''
    closePopover()
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
  {#if $filteredSpaces.length > 0}
    {#each $filteredSpaces as space, index}
      <span
        class="label"
        class:active={index === selectedSpaceIndex}
        on:click={() => handleClick(index)}
        role="none">{space.dataValue.folderName}</span
      >
    {/each}
  {:else}
    <span>No spaces available</span>
  {/if}
  {#if $isCreatingNewSpace}
    <div class="create-input-wrapper">
      <input
        class="search-input"
        bind:this={inputRef}
        bind:value={newSpaceName}
        on:blur={cancelCreatingNewSpace}
        on:keydown={(event) => {
          if (event.key === 'Enter') {
            confirmCreatingNewSpace(event.shiftKey)
          } else if (event.key === 'Escape') {
            cancelCreatingNewSpace()
          }
        }}
        placeholder="Name your new space"
        data-keep-open
      />
      <div class="hint" use:tooltip={{ text: 'Use shift + ↵ to use AI', position: 'left' }}>
        <span class="cmd">↵</span>
      </div>
    </div>
  {:else}
    <span class="label" role="none" on:click={startCreatingNewSpace} data-keep-open>
      <Icon name="add" color="#7d7448" />
      Create new Context
    </span>
  {/if}
</div>

<style lang="scss">
  .shortcut-wrapper {
    display: flex;
    flex-direction: column;
    width: 20rem;
    max-height: 30rem;
    overflow-y: auto;
    .label {
      display: flex;
      align-items: center;
      padding: 1rem 0.75rem 1rem 1rem;
      border-radius: 12px;

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
  }
  .active {
    background-color: #ffffff;
    border-radius: 8px;
    color: white;
  }

  .create-input-wrapper {
    display: flex;
    align-items: center;
    input {
      width: 100%;
    }
    button {
      background: none;
      border: none;
      padding: 0 0.5rem;
      border-radius: 8px;
      &:hover {
        background-color: #e0e0d1;
      }
    }

    .hint {
      font-size: 0.75rem;
      color: #7d7448;
      flex-shrink: 0;
      display: flex;
      align-items: center;

      .cmd {
        font-weight: 500;
        font-size: 1rem;
        background: #eeece0;
        padding: 0.2rem 0.35rem;
        border-radius: 5px;
      }
    }
  }
</style>
