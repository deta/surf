<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { ResourceManager } from '../../service/resources'
  import { Telemetry } from '../../service/telemetry'
  import SpaceIcon from '@horizon/core/src/lib/components/Drawer/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'

  export let folder
  export let activeFolderId
  export let reducedResources
  export let selected

  const dispatch = createEventDispatcher()

  let folderName = folder.name
  let folderColors = folder.colors
  let inputWidth = `${folderName.length}ch`
  let processing = false

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
    console.log('handleDelete called with id:', folder.id)
    dispatch('delete', folder.id)
  }

  const createFolderWithAI = async () => {
    processing = true
    const userPrompt = JSON.stringify(folderName)

    let response = await resourceManager.getResourcesViaPrompt(userPrompt)
    console.log(`Automatic Folder Generation request... ${userPrompt}`)
    let parsed = JSON.parse(response)

    let results = parsed.embedding_search_results || parsed.sql_query_results

    console.log('Automatic Folder generated with', results)

    await resourceManager.addItemsToSpace(folder.id, results)

    selectedFolder.triggerRedraw()
    await tick()
    selectedFolder.set('all')
    await tick()
    selectedFolder.set(folder.id)

    processing = false
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    const data = event.dataTransfer.getData('application/json')
    const { id } = JSON.parse(data)

    const resource = await resourceManager.getResource(id)

    console.log('trying to drop resource', resource)

    await resourceManager.addItemsToSpace(folder.id, [id])
    console.log(`Resource ${id} dropped into folder ${folder.name}`)

    draggedOver.set(false)
  }

  const handleColorChange = async (event: CustomEvent) => {
    //DISABLED DUE TO INCONSISTEND JSON PARSE
    // const update = { name: folderName, colors: event.detail }
    // console.log('Updating Color...', update)
    // await resourceManager.updateSpace(folder.id, update)
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
    inputWidth = `${folderName.length + 3}ch`
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
    <div class="folder-leading">
      <SpaceIcon on:colorChange={handleColorChange} colors={folderColors} />
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
            createFolderWithAI()
          }
        }}
      />
    </div>

    <button on:click|stopPropagation={handleDelete} class="close">
      <Icon name="trash" size="20px" />
    </button>
  </div>
</div>

<style lang="scss">
  .folder-wrapper {
    position: relative;
  }

  .folder {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem 1rem 1rem;
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

  .folder-leading {
    display: flex;
    gap: 1rem;
  }

  .folder-input {
    border: none;
    background: transparent;
    color: #7d7448;
    font-size: 1.1rem;
    font-weight: 500;
    max-width: 15rem;
    letter-spacing: 0.025rem;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    outline: none;
    width: fit-content;
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

  .folder:hover {
    .close {
      opacity: 1;
    }

    .folder-input {
      max-width: 12rem;
    }
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
