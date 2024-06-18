<script lang="ts">
  import { tick } from 'svelte'
  import { useLogScope } from '../../utils/log'
  import Folder from '../Browser/Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { useOasis } from '../../service/oasis'
  import { derived } from 'svelte/store'

  const log = useLogScope('Oasis Sidebar')
  const oasis = useOasis()

  const spaces = oasis.spaces
  const selectedSpace = oasis.selectedSpace

  // const displaySpaces = derived(spaces, ($spaces) => {
  //   return [
  //     // { id: 'all', name: 'Everything', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted: 0 },
  //     ...$spaces
  //   ]
  // })

  const createNewFolder = async () => {
    try {
      const newSpace = await oasis.createSpace('New Folder')
      log.debug('New Folder:', newSpace)

      selectedSpace.set(newSpace.id)

      await tick()

      const inputElement = document.getElementById(
        `folder-input-${newSpace.id}`
      ) as HTMLInputElement
      if (inputElement) {
        inputElement.select()
      }
    } catch (error) {
      log.error('Failed to create folder:', error)
    }
  }

  const renameFolder = async (id: string, newName: string) => {
    try {
      await oasis.renameSpace(id, newName)
    } catch (error) {
      log.error('Failed to rename folder:', error)
    }
  }

  const deleteFolder = async (id: CustomEvent) => {
    try {
      console.log('trying to delete folder...', id.detail)
      await oasis.deleteSpace(id.detail)
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const handleFolderSelect = (event: CustomEvent) => {
    selectedSpace.set(event.detail)
  }
</script>

<div class="folders-sidebar">
  <!-- <button class="action-back-to-tabs" on:click={() => sidebarTab.set('active')}>
    <Icon name="chevron.left" />
    <span class="label">Back to Tabs</span>
  </button> -->

  <div class="folder-wrapper">
    {#each $spaces as folder (folder.id)}
      <Folder
        {folder}
        on:delete={folder.id !== 'all' ? deleteFolder : null}
        on:select={folder.id === 'all' ? () => selectedSpace.set('all') : handleFolderSelect}
        on:rename={folder.id !== 'all'
          ? ({ detail }) => renameFolder(detail.id, detail.name)
          : null}
        selected={$selectedSpace === folder.id}
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

  .action-back-to-tabs {
    .label {
      letter-spacing: 0.04rem;
    }
  }
</style>
