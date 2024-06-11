<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import { useLogScope } from '../../utils/log'
  import Folder from './Folder.svelte'
  import { folderManager } from '../../service/folderManager'
  import { Icon } from '@horizon/icons'
  import { ResourceManager } from '../../service/resources'
  import { selectedFolder } from '../../stores/oasis'

  const log = useLogScope('Oasis Sidebar')

  const folders = writable([])
  const resources = writable([])
  const reducedResources = writable([])

  export let resourceManager: any
  export let sidebarTab

  const ensureEverythingFolder = (folderList) => {
    const everythingFolder = { id: 'all', name: 'Everything' }
    if (!folderList.find((folder) => folder.id === 'all')) {
      return [everythingFolder, ...folderList]
    }
    return folderList
  }

  onMount(async () => {
    try {
      const loadedFolders = await folderManager.listFolders()
      folders.set(ensureEverythingFolder(loadedFolders))

      let loadedResources = await resourceManager.searchResources('', [
        ResourceManager.SearchTagDeleted(false)
      ])
      resources.set(loadedResources)

      const reduced = loadedResources.map((item: any) => ({
        id: item.id,
        name: item.resource.metadata.name,
        sourceURI: item.resource.metadata.sourceURI
      }))
      reducedResources.set(reduced)
    } catch (error) {
      log.error('Failed to load folders:', error)
    }
  })

  const createNewFolder = async () => {
    try {
      const newFolder = await folderManager.createFolder('New Folder', 'userContext')
      folders.update((currentFolders) => ensureEverythingFolder([...currentFolders, newFolder]))
      selectedFolder.set(newFolder.id)
      await tick()

      const inputElement = document.getElementById(`folder-input-${newFolder.id}`)
      if (inputElement) {
        inputElement.select()
      }
    } catch (error) {
      log.error('Failed to create folder:', error)
    }
  }

  const renameFolder = async (id, newName) => {
    try {
      await folderManager.updateFolder(id, { name: newName })
      const updatedFolders = await folderManager.listFolders()
      folders.set(ensureEverythingFolder(updatedFolders))
    } catch (error) {
      log.error('Failed to rename folder:', error)
    }
  }

  const deleteFolder = async (id) => {
    try {
      await folderManager.deleteFolder(id)
      const updatedFolders = await folderManager.listFolders()
      folders.set(ensureEverythingFolder(updatedFolders))
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const handleFolderSelect = (event) => {
    selectedFolder.set(event.detail)
  }
</script>

<div class="folders-sidebar">
  <button class="action-back-to-tabs" on:click={() => sidebarTab.set('active')}>
    <Icon name="chevron.left" />
    <span>Back to Tabs</span>
  </button>

  <div class="folder-wrapper">
    {#each $folders as folder (folder.id)}
      <Folder
        {folder}
        {selectedFolder}
        {reducedResources}
        on:delete={folder.id !== 'all' ? deleteFolder : null}
        on:select={folder.id === 'all' ? () => selectedFolder.set('all') : handleFolderSelect}
        on:rename={folder.id !== 'all'
          ? ({ detail }) => renameFolder(detail.id, detail.name)
          : null}
        selected={$selectedFolder === folder.id}
      />
    {/each}
  </div>

  <button class="action-new-space" on:click={createNewFolder}>
    <Icon name="add" />
    <span class="new-space-text">New Space</span>
  </button>
</div>

<style lang="scss">
  .folders-sidebar {
    position: relative;
    top: 2rem;
    padding: 0 0.5rem;
  }

  button {
    display: flex;
    align-items: center;
    margin: 0.5rem 0;
    padding: 1rem 0;
    gap: 0.5rem;
    background-color: transparent;
    color: #7d7448;
    border: 0;
    border-radius: 8px;
    cursor: pointer;

    span {
      font-size: 1rem;
      letter-spacing: 0.01em;
    }

    &:hover {
      color: #585234;
    }
  }

  .folder-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .action-new-space {
    .new-space-text {
      font-size: 1.1rem;
    }
    letter-spacing: 0.01em;
    padding: 0.75rem 1rem;
    opacity: 0.6;
    &:hover {
      opacity: 1;
    }
  }
</style>
