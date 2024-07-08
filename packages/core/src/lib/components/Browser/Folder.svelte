<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { ResourceManager } from '../../service/resources'
  import { Telemetry } from '../../service/telemetry'
  import SpaceIcon from '@horizon/core/src/lib/components/Drawer/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import type { Space, SpaceData, SFFSResourceTag, Space, SpaceName } from '../../types'
  import { ResourceTypes } from '../../types'
  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { processDrop } from '../../service/mediaImporter'
  import Archive from '@horizon/icons/src/lib/Icons/Archive.svelte'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { useToasts } from '../../service/toast'

  export let folder: Space
  export let selected: boolean

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher<{
    delete: void
    select: void
    'add-folder-to-tabs': void
    'update-data': Partial<SpaceData>
  }>()
  const oasis = useOasis()

  let folderDetails = folder.name
  let inputWidth = `${folderDetails.folderName.length}ch`

  const toast = useToasts()

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

  const getPreviewResources = async (numberOfLatestResourcesToFetch: number) => {
    let result
    if (folder.id == 'all') {
      result = await resourceManager.searchResources('', [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne')
      ])

      result.reverse()
    } else {
      result = await resourceManager.getSpaceContents(folder.id)
    }
    console.log('rrrr', result)
    const resources = await Promise.all(
      result
        .map((item) => resourceManager.getResource(folder.id == 'all' ? item.id : item.resource_id))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, numberOfLatestResourcesToFetch)
    )

    return resources
  }

  const handleClick = () => {
    dispatch('select')
  }

  const handleBlur = () => {
    dispatch('update-data', { folderName: folderDetails.folderName })
  }

  const handleDelete = () => {
    dispatch('delete')
  }

  const handleAddSpaceToTabs = () => {
    dispatch('add-folder-to-tabs')
  }

  const createFolderWithAI = async () => {
    try {
      processing = true

      const userPrompt = JSON.stringify(folderDetails.folderName)

      log.debug('Creating folder with AI', userPrompt)
      inputElement.blur()

      dispatch('update-data', { folderName: folderDetails.folderName })

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

      toast.success('Folder created with AI!')
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

      toast.success('Resources added to folder!')
    } else {
      log.debug('No resources found in drop event')
    }

    draggedOver.set(false)
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    dispatch('update-data', { colors: event.detail })
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    draggedOver.set(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    draggedOver.set(false)
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    e.stopPropagation()

    const target = e.target as HTMLInputElement
    const value = target.value

    folderDetails.folderName = value
    if (e.code === 'Space' && !e.shiftKey) {
      e.preventDefault()
      folderDetails.folderName = value + ' '
    } else if (e.code === 'Enter' && e.shiftKey) {
      e.preventDefault()
      createFolderWithAI()
    }
  }

  // onMount(() => {
  //   if (folder.id === activeFolderId) {
  //     const inputElement = document.getElementById(`folder-input-${folder.id}`) as HTMLInputElement
  //     if (inputElement) {
  //       inputElement.select()
  //     }
  //   }
  // })
  const getRandomRotation = () => {
    const maxRotation = 1.5
    const minRotation = -1.5
    return `${Math.random() * (maxRotation - minRotation) + minRotation}deg`
  }

  $: {
    inputWidth = `${folderDetails.folderName.length + 3}ch`
  }
</script>

<div
  class="folder-wrapper {processing ? 'magic-in-progress' : ''} {$draggedOver ? 'draggedOver' : ''}"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  aria-hidden="true"
>
  <div class="folder {selected ? 'active' : ''}" on:click={handleClick} aria-hidden="true">
    <div class="previews">
      {#await getPreviewResources(6) then resources}
        {#each resources as resource}
          <div class="folder-preview" style="transform: rotate({getRandomRotation()});">
            <ResourcePreviewClean {resource} showTitles={false} />
          </div>
        {/each}
      {/await}
    </div>
    <div class="folder-label">
      <div class="folder-leading">
        <SpaceIcon on:change={handleColorChange} {folder} />

        <input
          bind:this={inputElement}
          id={`folder-input-${folder.id}`}
          type="text"
          bind:value={folderDetails.folderName}
          on:blur={handleBlur}
          class="folder-input"
          style={`width: ${inputWidth}`}
          on:keydown={async (e) => {
            e.stopPropagation()
            folderDetails.folderName = e.target?.value
            if (e.code === 'Space' && !e.shiftKey) {
              e.preventDefault()
              folderDetails.folderName = e.target?.value + ' '
            } else if (e.code === 'Enter' && e.shiftKey) {
              e.preventDefault()
              createFolderWithAI()
            }
          }}
        />
      </div>
      <div class="actions">
        <button on:click|stopPropagation={handleDelete} class="close">
          <Icon name="trash" size="20px" />
        </button>

        <button on:click|stopPropagation={handleAddSpaceToTabs} class="close">
          <Icon name={!folder.name.showInSidebar ? 'add' : 'check'} size="20px" />
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .folder-wrapper {
    position: relative;
  }

  .folder {
    display: flex;
    flex-direction: column;
    align-items: end;
    justify-content: space-between;
    padding: 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    gap: 10px;
    position: relative;
    color: #244581;
    height: 24rem;
    font-weight: 500;
    letter-spacing: 0.0025em;
    font-smooth: always;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    z-index: 1000;
    background: linear-gradient(0deg, #eef8fe 0%, #e3f4fc 4.18%),
      linear-gradient(180deg, #f2fbfd 0%, #effafd 10.87%),
      radial-gradient(41.69% 35.32% at 16.92% 87.63%, rgba(205, 231, 250, 0.85) 0%, #e4f2fb 100%),
      linear-gradient(129deg, #f6fcfd 0.6%, #e6f8fe 44.83%, #e0f5fd 100%), var(--Black, #fff);

    background: linear-gradient(
        0deg,
        color(display-p3 0.9412 0.9725 0.9922) 0%,
        color(display-p3 0.902 0.9529 0.9843) 4.18%
      ),
      linear-gradient(
        180deg,
        color(display-p3 0.9569 0.9843 0.9922) 0%,
        color(display-p3 0.9451 0.9804 0.9922 / 0) 10.87%
      ),
      radial-gradient(
        41.69% 35.32% at 16.92% 87.63%,
        color(display-p3 0.8222 0.9042 0.9735 / 0.85) 0%,
        color(display-p3 0.9059 0.949 0.9804 / 0) 100%
      ),
      linear-gradient(
        129deg,
        color(display-p3 0.9686 0.9882 0.9922) 0.6%,
        color(display-p3 0.9137 0.9686 0.9922) 44.83%,
        color(display-p3 0.8941 0.9569 0.9882) 100%
      ),
      var(--Black, color(display-p3 1 1 1));

    box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);

    .previews {
      position: relative;
      height: 100%;
      width: 100%;
      overflow: hidden;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      justify-content: center;
      -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
    }

    .folder-preview {
      width: 45%;
      margin: 2%;
      position: relative;
      max-height: 16rem;
      transition: transform 0.3s ease;
    }

    .folder-preview:hover {
      transform: rotate(0deg) scale(1.025) translateY(0.025rem) !important;
    }

    .folder-label {
      display: flex;
      justify-content: space-between;
      width: 100%;
      .actions {
        display: flex;
        gap: 0.75rem;
      }

      .folder-leading {
        display: flex;
        gap: 1rem;
        width: 100%;
      }

      .folder-input {
        font-family: 'Inter', sans-serif;
        border: none;
        background: transparent;
        color: #244581;
        font-size: 1.15rem;
        font-weight: 500;
        letter-spacing: 0.0025em;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        width: 100%;
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
    }
  }

  .folder.active {
    color: #585130;
    z-index: 1000;
    background-color: #fff;
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
