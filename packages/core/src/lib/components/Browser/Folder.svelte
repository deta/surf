<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { onMount } from 'svelte'
  import { Icon } from '@horizon/icons'

  export let folder
  export let activeFolderId

  const dispatch = createEventDispatcher()
  let folderName = folder.name

  const handleClick = () => {
    dispatch('select', folder.id)
  }

  const handleBlur = () => {
    dispatch('rename', { id: folder.id, name: folderName })
  }

  const handleDelete = () => {
    console.log('handleDelete called with id:', folder.id) // Debugging log
    dispatch('delete', folder.id) // Ensure the folder ID is being passed as a string
  }

  onMount(() => {
    if (folder.id === $activeFolderId) {
      const inputElement = document.getElementById(`folder-input-${folder.id}`)
      if (inputElement) {
        inputElement.select()
      }
    }
  })
</script>

<div
  class="folder"
  class:active={folder.id === $activeFolderId}
  on:click={handleClick}
  aria-hidden="true"
>
  <input
    id={`folder-input-${folder.id}`}
    type="text"
    bind:value={folderName}
    on:blur={handleBlur}
    class="folder-input"
    on:keydown={(e) => {
      folderName = e.target?.value
      if (e.code === 'Space') {
        e.preventDefault()
        folderName = e.target?.value + ' '
      }
    }}
  />

  <button on:click|stopPropagation={handleDelete} class="close">
    <Icon name="trash" size="20px" />
  </button>
</div>

<style>
  .folder {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-radius: 8px;
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
  }

  .folder.active {
    color: #585130;
    background-color: #fff;
  }

  .folder-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 1.1rem;
    color: inherit;
    font-weight: inherit;
    outline: none;
  }

  .folder-input:focus {
    background-color: transparent;
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: none;
    padding: 0;
    margin: 0;
    opacity: 0;
    height: min-content;
    background: none;
    color: #a9a9a9;
    cursor: pointer;
  }

  .folder:hover .close {
    opacity: 1;
  }
</style>
