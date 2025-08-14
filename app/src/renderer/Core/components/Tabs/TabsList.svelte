<script lang="ts">
  import { useTabs } from '@deta/services/src/tabs.svelte'
  import TabItem from './TabItem.svelte'

  const tabsService = useTabs()

  const activeTab = tabsService.activeTab

  $inspect(tabsService.tabs)
</script>

<div class="tabs-list">
  {#each tabsService.tabs as tab, index (tab.id)}
    <TabItem tab={tabsService.tabs[index]} active={activeTab?.id === tab.id} />
  {/each}
</div>

<style>
  .tabs-list {
    display: flex;
    overflow-x: auto;
    padding: 0.5rem;
    gap: 0.5rem;
  }
</style>
