<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'

  import { useLogScope } from '../../utils/log'
  import Folder from '../Browser/Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { useOasis } from '../../service/oasis'

  import { useToasts } from '../../service/toast'
  import type { TabSpace } from '@horizon/core/src/lib/components/Browser/types'
  import type { SpaceData, SpaceSource } from '../../types'
  import type { Writable } from 'svelte/store'
  import type { Space } from '@horizon/core/src/lib/types'

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const dispatch = createEventDispatcher<{ createTab: TabSpace }>()

  export let spaces: Writable<Space[]>
  const selectedSpace = oasis.selectedSpace

  export let onBack = () => {}
  $: log.debug('Spaces:', $spaces)

  const handleCreateSpace = async (_e: MouseEvent) => {
    try {
      const newSpace = await oasis.createSpace({
        folderName: 'New Space',
        colors: ['#FFBA76', '#FB8E4E']
      })

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

  const addItemToTabs = async (id: string) => {
    try {
      log.debug('Adding folder to tabs:', id)
      const space = $spaces.find((space) => space.id === id)
      if (space) {
        space.name.showInSidebar = true

        await oasis.updateSpaceData(id, {
          showInSidebar: true
        })

        dispatch('createTab', {
          title: space.name.folderName,
          icon: '',
          spaceId: id,
          type: 'space',
          index: 0,
          pinned: false,
          archived: false
        } as TabSpace)

        await tick()
      }
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const deleteFolder = async (id: string) => {
    try {
      await oasis.deleteSpace(id)
      toast.success('Space deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const handleSpaceUpdate = async (id: string, updates: Partial<SpaceData>) => {
    try {
      log.debug('Updating space:', id, updates)
      if (id === 'everything') {
        log.debug('Cannot update the Everything folder')
        return
      }

      const space = $spaces.find((space) => space.id === id)
      if (!space) {
        log.error('Space not found:', id)
        return
      }

      await oasis.updateSpaceData(id, updates)
    } catch (error) {
      log.error('Failed to update folder:', error)
    }
  }

  onMount(() => {
    log.debug('Mounted SpacesView')
  })
</script>

<div class="folders-sidebar">
  <div class="top-bar">
    <button class="action-new-space" on:click={onBack}>
      <Icon name="chevron.left" />
      <span class="new-space-text">Back</span>
    </button>
    <button class="action-new-space" on:click={handleCreateSpace}>
      <Icon name="add" />
      <span class="new-space-text">New Space</span>
    </button>
  </div>
  <div class="folder-wrapper">
    {#each $spaces.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as folder (folder.id)}
      {#key folder.name.colors}
        <Folder
          {folder}
          on:delete={folder.id !== 'all' ? () => deleteFolder(folder.id) : null}
          on:add-folder-to-tabs={() => addItemToTabs(folder.id)}
          on:select={() => selectedSpace.set(folder.id)}
          on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
          on:open-resource
          selected={$selectedSpace === folder.id}
        />
      {/key}
    {/each}
  </div>
</div>

<style lang="scss">
  .top-bar {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    gap: 1rem;
    width: fit-content;
  }
  .folders-sidebar {
    position: relative;
    padding: 2rem 0.5rem;
    padding-top: 0;
    flex: 1;
    overflow-y: auto;
  }

  button {
    display: flex;
    align-items: center;
    margin: 0.5rem 0;
    padding: 1rem 0;
    gap: 0.5rem;
    background-color: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    border-radius: 16px;
    background: var(--Black, #fff);
    background: var(--Black, color(display-p3 1 1 1));
    box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);

    span {
      font-size: 1rem;
      letter-spacing: 0.01em;
    }
  }

  .folder-wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
    width: 100%;
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
