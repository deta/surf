<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { folderManager } from '../../service/folderManager'
  import { ResourceManager } from '../../service/resources'
  import { Telemetry } from '../../service/telemetry'

  export let folder
  export let activeFolderId
  export let reducedResources
  export let selected // New prop to determine if this folder is selected

  const dispatch = createEventDispatcher()
  let folderName = folder.name
  let inputWidth = `${folderName.length}ch`
  let processing = false // New state to track AI processing

  let telemetryAPIKey = ''
  let telemetryActive = false

  if (import.meta.env.PROD) {
    telemetryAPIKey = import.meta.env.R_VITE_TELEMETRY_API_KEY
    telemetryActive = true
  }

  const telemetry = new Telemetry({
    apiKey: telemetryAPIKey,
    active: telemetryActive,
    trackHostnames: false
  })

  const draggedOver = writable(false)
  const resourceManager = new ResourceManager(telemetry)

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
    processing = true
    const userPrompt = JSON.stringify($reducedResources, null, 2)
    const systemPrompt = `You are getting a list of resources that are in the users library as JSON. Create a JSON list of ids all the resources that are matching this folder name: ${folderName}. The format should look like this: ids: {[id1,id2,id3,...]}`

    console.log(`Automatic Folder Generation request... ${userPrompt} ${systemPrompt}`)

    let response = await window.api.createFolderBasedOnPrompt(userPrompt, systemPrompt, {})

    console.log(`Folder ${folderName} imports these ids, ${response}`)
    folderManager.addItemsFromAIResponse(folder.id, response)
    processing = false
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    const data = event.dataTransfer.getData('application/json')
    const { id } = JSON.parse(data)

    const resource = await resourceManager.getResource(id)

    // Handle the dropped resource ID (e.g., add it to the folder)
    await folderManager.addItemToFolder(folder.id, resource)
    console.log(`Resource ${id} dropped into folder ${folder.name}`)

    // Remove visual feedback class
    draggedOver.set(false)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    draggedOver.set(true)
  }

  const handleDragLeave = (event) => {
    draggedOver.set(false)
  }

  onMount(() => {
    if (folder.id === $activeFolderId) {
      const inputElement = document.getElementById(`folder-input-${folder.id}`)
      if (inputElement) {
        inputElement.select()
      }
    }
  })

  $: {
    inputWidth = `${folderName.length}ch`
  }
</script>

<div
  class="folder-wrapper {processing && selected ? 'magic-in-progress' : ''} {$draggedOver
    ? 'draggedOver'
    : ''}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  aria-hidden="true"
>
  <div class="folder {selected ? 'active' : ''}" on:click={handleClick} aria-hidden="true">
    <input
      id={`folder-input-${folder.id}`}
      type="text"
      bind:value={folderName}
      on:blur={handleBlur}
      class="folder-input"
      style={`width: ${inputWidth}`}
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
</div>

<style>
  .folder-wrapper {
    position: relative;
  }

  .folder {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    z-index: 1000;
    &:hover {
      background-color: #e0e0d1;
    }
  }

  .folder.active {
    color: #585130;
    z-index: 1000;
    background-color: #fff;
  }

  .folder-input {
    border: none;
    background: transparent;
    font-size: 1.1rem;
    color: inherit;
    font-weight: inherit;
    outline: none;
    width: fit-content; /* This is optional, as the width is dynamically set via style */
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

  .draggedOver {
    border-radius: 8px;
    background-color: #a9a9a9 !important;
  }

  .magic-in-progress {
    --magic-field-speed: 4s;
    --magic-field-colors: #30cfd0, #330867, #ff6978, #fffcf9, #330867, #30cfd0, #ff6978, #fffcf9,
      #330867;

    &::after {
      position: absolute;
      content: '';
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: -1;
      height: 100%;
      width: 100%;
      opacity: 1;
      transition: opacity 120ms ease-out;
      transform: scale(0.95) translateZ(0);
      filter: blur(25px);
      z-index: 0;
      background: linear-gradient(
        to top right,
        var(
          --magic-field-colors,
          #ff5770,
          #e4428d,
          #c42da8,
          #9e16c3,
          #6501de,
          #9e16c3,
          #c42da8,
          #e4428d,
          #ff5770
        )
      );
      background-size: 200% 200%;
      animation: animateGlow var(--magic-field-speed) linear infinite;
    }
  }

  @keyframes animateGlow {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
