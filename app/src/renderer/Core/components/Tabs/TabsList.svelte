<script lang="ts">
  import { useTabs } from '@deta/services'
  import TabItem from './TabItem.svelte'
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'

  const tabsService = useTabs()

  $inspect(tabsService.tabs)
  $inspect(tabsService.activeTab)
</script>

<div class="tabs-list">
  {#each tabsService.tabs as tab, index (tab.id)}
    <TabItem tab={tabsService.tabs[index]} active={tabsService.activeTab?.id === tab.id} />
  {/each}

  <div class="add-tab-btn-container">
    <Button onclick={() => tabsService.create('https://google.com')}>
      <Icon name="add" />
    </Button>
  </div>
</div>

<style>
  .tabs-list {
    display: flex;
    overflow-x: visible;
    padding-left: 5rem;
    gap: 0.375rem;
    padding-top: 0.33rem;
    padding-bottom: 0.33rem;
  }
  .add-tab-btn-container {
    app-region: no-drag;
  }
</style>
