<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { ResourceManager } from '../../service/resources'
  import { Telemetry } from '../../service/telemetry'
  import SpaceIcon from '@horizon/core/src/lib/components/Drawer/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import type { Space } from '../../types'
  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { processDrop } from '../../service/mediaImporter'

  export let folder: Space
  export let selected: boolean

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher()
  const oasis = useOasis()

  let folderName = folder.name
  let inputWidth = `${folderName.length}ch`
  let processing = false

  let telemetryAPIKey = ''
  let telemetryActive = false

  let inputElement: HTMLInputElement

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
    try {
      processing = true
      const userPrompt = JSON.stringify(folderName)

      log.debug('Creating folder with AI', userPrompt)
      inputElement.blur()
      dispatch('rename', { id: folder.id, name: folderName })

      let response = await resourceManager.getResourcesViaPrompt(userPrompt)
      if (typeof response === 'string') {
        response = JSON.parse(response)
      }

      log.debug(`Automatic Folder Generation request`, response)

      const results = response.embedding_search_results || response.sql_query_results
      log.debug('Automatic Folder generated with', results)

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        processing = false
        return
      }

      await oasis.addResourcesToSpace(folder.id, results)
      selectedFolder.set(folder.id)
    } catch (err) {
      log.error('Failed to create folder with AI', err)
    } finally {
      processing = false
    }
  }

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()

    const mediaResults = await processDrop(event)

    const resourceItems = mediaResults.filter((r) => r.type === 'resource')
    if (resourceItems.length > 0) {
      await resourceManager.addItemsToSpace(
        folder.id,
        resourceItems.map((r) => r.data as string)
      )
      log.debug(`Resources dropped into folder ${folder.name}`)
    } else {
      log.debug('No resources found in drop event')
    }

    draggedOver.set(false)
  }

  const handleColorChange = async (event: CustomEvent) => {
    //DISABLED DUE TO INCONSISTEND JSON PARSE
    // const update = { name: folderName, colors: event.detail }
    // console.log('Updating Color...', update)
    // await resourceManager.updateSpace(folder.id, update)
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    draggedOver.set(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    draggedOver.set(false)
  }

  // onMount(() => {
  //   if (folder.id === activeFolderId) {
  //     const inputElement = document.getElementById(`folder-input-${folder.id}`) as HTMLInputElement
  //     if (inputElement) {
  //       inputElement.select()
  //     }
  //   }
  // })

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
      <SpaceIcon on:colorChange={handleColorChange} />
      <input
        bind:this={inputElement}
        id={`folder-input-${folder.id}`}
        type="text"
        bind:value={folderName}
        on:blur={handleBlur}
        class="folder-input"
        style={`width: ${inputWidth}`}
        on:keydown={async (e) => {
          e.stopPropagation()
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
