<script lang="ts">
  import { onMount } from 'svelte'
  import { writable, type Writable } from 'svelte/store'
  import { useLogScope } from '../../utils/log' // Adjust the import path as needed
  import { ResourceManager, type ResourceObject } from '../../service/resources' // Adjust the import path as needed

  const log = useLogScope('Oasis Sidebar')

  import { Icon } from '@horizon/icons'

  export let resourceManager: ResourceManager
  export let sidebarTab: Writable<'active' | 'archive' | 'oasis'>

  const resources = writable<ResourceObject[]>([])

  const fetchResources = async () => {
    try {
      const searchResults = await resourceManager.searchResources('', [
        ResourceManager.SearchTagDeleted(false)
      ])
      const result = searchResults.map((r) => r.resource)
      result.reverse()
      log.debug('Fetched resources', result)
      resources.set(result)
    } catch (error) {
      log.error('Failed to fetch resources', error)
    }
  }

  onMount(() => {
    fetchResources()
  })
</script>

<div class="spaces-sidebar">
  <button on:click={() => sidebarTab.set('active')}>
    <!-- svelte-ignore missing-declaration -->
    <Icon name="chevron.left" />
    <span>Back to Tabs</span>
  </button>

  {#each $resources as resource}
    <div>{resource.metadata.name ? resource.metadata.name : 'Unnamed Resource'}</div>
  {/each}
</div>

<style lang="scss">
  .spaces-sidebar {
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
</style>
