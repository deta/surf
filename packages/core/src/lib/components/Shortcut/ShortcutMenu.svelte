<script lang="ts">
  import { ResourceManager } from '../../service/resources'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { writable } from 'svelte/store'
  import type { Space } from '../../types'

  export let resourceManager: ResourceManager
  export let spaces: Space[] = []

  let selectedSpaceIndex = 0
  let isLoading = true
  let inputRef: HTMLInputElement
  let searchQuery = ''
  let filteredSpaces: Space[] = []

  const dispatch = createEventDispatcher<{
    'create-tab-from-space': Space
    'create-new-space': string
  }>()

  const isCreatingNewSpace = writable(false)
  let newSpaceName = ''

  const loadSpaces = async () => {
    try {
      const fetchedSpaces = await resourceManager.listSpaces()
      spaces = fetchedSpaces.filter((space) => !space.name.showInSidebar)

      spaces.push({
        id: 'all',
        name: {
          folderName: 'Everything',
          colors: ['#76E0FF', '#4EC9FB'],
          showInSidebar: false,
          liveModeEnabled: false,
          hideViewed: false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: 0
      })

      console.log('Spaces:', spaces)
      filteredSpaces = spaces
    } catch (error) {
      console.error('Error loading spaces:', error)
      spaces = []
      filteredSpaces = []
    } finally {
      isLoading = false
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (inputRef && inputRef === document.activeElement) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'ArrowDown') {
        selectedSpaceIndex = (selectedSpaceIndex + 1) % filteredSpaces.length
      } else if (event.key === 'ArrowUp') {
        selectedSpaceIndex =
          (selectedSpaceIndex - 1 + filteredSpaces.length) % filteredSpaces.length
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopImmediatePropagation()
      console.log('Dispatching custom event from handleKeydown')
      dispatch('create-tab-from-space', filteredSpaces[selectedSpaceIndex])
    }
  }

  const handleClick = (index: number) => {
    selectedSpaceIndex = index
    console.log('Dispatching custom event from handleClick')
    dispatch('create-tab-from-space', filteredSpaces[selectedSpaceIndex])
  }

  const focusInput = () => {
    if (inputRef) {
      inputRef.focus()
    }
  }

  const handleSearch = () => {
    filteredSpaces = spaces.filter((space) =>
      space.name.folderName.toLowerCase().includes(searchQuery.toLowerCase())
    )
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

  const confirmCreatingNewSpace = () => {
    console.log('Confirming creation of new space')
    dispatch('create-new-space', newSpaceName)
    isCreatingNewSpace.set(false)
    newSpaceName = ''
  }

  onMount(() => {
    loadSpaces()
    window.addEventListener('keydown', handleKeydown, true)
    focusInput()
    return () => {
      window.removeEventListener('keydown', handleKeydown, true)
    }
  })
</script>

<div class="shortcut-wrapper">
  {#if isLoading}
    <span>Loading...</span>
  {:else if filteredSpaces && filteredSpaces.length > 0}
    {#each filteredSpaces as space, index}
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
  <!-- <span class="label" aria-hidden="true"> Show All Spaces</span> -->
  {#if $isCreatingNewSpace}
    <div class="create-input-wrapper">
      <input
        class="search-input"
        bind:this={inputRef}
        bind:value={newSpaceName}
        on:blur={cancelCreatingNewSpace}
        on:keydown={(event) => {
          if (event.key === 'Enter') {
            confirmCreatingNewSpace()
          } else if (event.key === 'Escape') {
            cancelCreatingNewSpace()
          }
        }}
        placeholder="Name your new space"
        data-keep-open
      />
      <!-- <button on:click|stopPropagation={confirmCreatingNewSpace} data-keep-open>
        <Icon name="check" color="#7d7448" />
      </button>
      <button on:click|stopPropagation={cancelCreatingNewSpace} data-keep-open>
        <Icon name="close" color="#7d7448" />
      </button> -->
    </div>
  {:else}
    <span class="label" aria-hidden="true" on:click={startCreatingNewSpace} data-keep-open>
      <Icon name="add" color="#7d7448" />
      Create new Space
    </span>
  {/if}
</div>

<style lang="scss">
  .shortcut-wrapper {
    display: flex;
    flex-direction: column;
    width: 18rem;
    max-height: 30rem;
    overflow-y: auto;
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

  .create-input-wrapper {
    display: flex;
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
  }
</style>
