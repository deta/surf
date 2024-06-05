<script lang="ts">
  import { onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { useLogScope } from '../../utils/log' // Adjust the import path as needed
  import Folder from './Folder.svelte' // Import the new Folder component
  import { Icon } from '@horizon/icons'

  const log = useLogScope('Oasis Sidebar')

  const activeFolderId = writable('all')
  const example_spaces = [
    { id: 'all', label: 'Everything' },
    { id: 'images', label: 'Screenshots' },
    { id: 'articles', label: 'Read Later' },
    { id: 'archived', label: 'Archived' }
  ]

  const folders = writable(example_spaces)

  const handleFolderSelect = (event) => {
    console.log('Active Folder ID:', event.detail)
    activeFolderId.set(event.detail)
  }

  // The sidebarTab should be passed in as a prop to manage the tab view
  export let sidebarTab
</script>

<div class="folders-sidebar">
  <button class="action-back-to-tabs" on:click={() => sidebarTab.set('active')}>
    <Icon name="chevron.left" />
    <span>Back to Tabs</span>
  </button>

  <div class="folder-wrapper">
    {#each $folders as folder (folder.id)}
      <Folder {folder} {activeFolderId} on:select={handleFolderSelect} />
    {/each}
  </div>

  <button class="action-new-space" on:click={() => {}}>
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
      opcaity: 1;
    }
  }
</style>
