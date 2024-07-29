<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import { Resource, ResourceManager, useResourceManager } from '../../service/resources'
  import SpaceIcon from '@horizon/core/src/lib/components/Drawer/SpaceIcon.svelte'
  import { selectedFolder } from '../../stores/oasis'
  import type { Space, SpaceData } from '../../types'
  import { ResourceTagsBuiltInKeys, ResourceTypes } from '../../types'
  import { useLogScope } from '../../utils/log'
  import { useOasis } from '../../service/oasis'
  import { processDrop } from '../../service/mediaImporter'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'
  import { useToasts } from '../../service/toast'
  import { hover, tooltip } from '../../utils/directives'
  import { fade } from 'svelte/transition'

  export let folder: Space
  export let selected: boolean

  const log = useLogScope('Folder')
  const dispatch = createEventDispatcher<{
    delete: void
    select: void
    'add-folder-to-tabs': void
    'update-data': Partial<SpaceData>
    'open-resource': string
  }>()
  const oasis = useOasis()
  const toast = useToasts()
  const resourceManager = useResourceManager()

  const hovered = writable(false)
  const draggedOver = writable(false)

  let folderDetails = folder.name
  let inputWidth = `${folderDetails.folderName.length}ch`
  let processing = false
  let inputElement: HTMLInputElement

  const getPreviewResources = async (numberOfLatestResourcesToFetch: number) => {
    let result: Resource[]
    if (folder.id == 'all') {
      result = await resourceManager.listResourcesByTags([
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.ANNOTATION, 'ne'),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
      ])
    } else {
      const contents = await resourceManager.getSpaceContents(folder.id)
      const resources = await Promise.all(
        contents
          .slice(0, numberOfLatestResourcesToFetch)
          .map((item) => resourceManager.getResource(item.resource_id))
      )

      result = resources.filter((x) => x != null)
    }

    log.debug('Resources:', result)

    return result
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, numberOfLatestResourcesToFetch)
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

  const createFolderWithAI = async (query: string) => {
    try {
      processing = true

      const userPrompt = JSON.stringify(query)

      log.debug('Creating folder with AI', userPrompt)
      inputElement.blur()

      dispatch('update-data', { smartFilterQuery: query })

      const response = await resourceManager.getResourcesViaPrompt(userPrompt)

      log.debug(`Automatic Folder Generation request`, response)

      const results = response.embedding_search_query
        ? response.embedding_search_results
        : response.sql_query_results
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

    if (e.code === 'Space' && !e.shiftKey) {
      e.preventDefault()
      folderDetails.folderName = value + ' '
    } else if (e.code === 'Enter' && e.shiftKey) {
      e.preventDefault()
      createFolderWithAI(value)
    }
  }

  const openResource = (id: string) => {
    log.debug('Resource clicked', id)

    dispatch('open-resource', id)
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
  <div
    class="folder {selected ? 'active' : ''}"
    on:click={handleClick}
    aria-hidden="true"
    use:hover={hovered}
  >
    <div class="previews">
      {#await getPreviewResources(6)}
        <div class="folder-empty-wrapper">
          <div class="folder-empty">
            <Icon name="spinner" />
            <!-- <div>Empty Space, add it with life!</div> -->
          </div>
        </div>
      {:then resources}
        {#if resources.length > 0}
          {#each resources as resource}
            <div class="folder-preview" style="transform: rotate({getRandomRotation()});">
              <ResourcePreviewClean
                {resource}
                showTitles={false}
                showActions={false}
                on:click={() => openResource(resource.id)}
              />
            </div>
          {/each}
        {:else}
          <div class="folder-empty-wrapper">
            <div class="folder-empty">
              <Icon name="leave" />
              <!-- <div>Empty Space, add it with life!</div> -->
            </div>
          </div>
        {/if}
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
          on:keydown={handleKeyDown}
        />
      </div>

      {#if $hovered}
        <div class="actions" in:fade={{ duration: 50 }} out:fade={{ duration: 100 }}>
          <button
            on:click|stopPropagation={handleAddSpaceToTabs}
            disabled={folder.name.showInSidebar}
            class="close"
            use:tooltip={folder.name.showInSidebar ? 'Already open as Tab' : 'Open as Tab'}
          >
            <Icon name={folder.name.showInSidebar ? 'check' : 'list-add'} size="20px" />
          </button>

          <button
            on:click|stopPropagation={handleDelete}
            class="close"
            use:tooltip={'Delete Space'}
          >
            <Icon name="trash" size="20px" />
          </button>
        </div>
      {/if}
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

    .folder-empty-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;

      .folder-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: rgb(125, 147, 187);
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 0.0025em;
        font-smooth: always;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    }

    .folder-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;

      .actions {
        display: flex;
        gap: 0.75rem;
        flex-shrink: 0;
      }

      .folder-leading {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        overflow: hidden;
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

        // truncate text
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        height: min-content;
        background: none;
        color: #5c77a8;
        cursor: pointer;
        transition: color 0.2s ease;

        &:hover {
          color: #244581;
        }

        &:disabled {
          color: #7d96c5;
        }
      }
    }
  }

  .folder.active {
    color: #585130;
    z-index: 1000;
    background-color: #fff;
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
