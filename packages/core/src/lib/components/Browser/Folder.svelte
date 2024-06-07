<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { folderManager } from '../../service/folderManager'

  export let folder
  export let activeFolderId
  export let reducedResources
  export let selected // New prop to determine if this folder is selected

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

  const createFolderWithOpenAI = async () => {
    const userPrompt = JSON.stringify($reducedResources, null, 2)
    const systemPrompt = `You are getting a list of resources that are in the users library as JSON. Create a JSON list of ids all the resources that are matching this folder name: ${folderName}. The format should look like this: ids: {[id1,id2,id3,...]}`

    console.log(`Automatic Folder Generation request... ${userPrompt} ${systemPrompt}`)

    let response = await window.api.createFolderBasedOnPrompt(userPrompt, systemPrompt, {})

    console.log(`Folder ${folderName} imports these ids, ${response}`)
    folderManager.addItemsFromAIResponse(folder.id, response)
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

<div class="folder {selected ? 'active' : ''}" on:click={handleClick} aria-hidden="true">
  <input
    id={`folder-input-${folder.id}`}
    type="text"
    bind:value={folderName}
    on:blur={handleBlur}
    class="folder-input"
    on:keydown={async (e) => {
      folderName = e.target?.value
      if (e.code === 'Space' && !e.shiftKey) {
        e.preventDefault()
        folderName = e.target?.value + ' '
      } else if (e.code === 'Enter' && e.shiftKey) {
        e.preventDefault()
        createFolderWithOpenAI()
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
