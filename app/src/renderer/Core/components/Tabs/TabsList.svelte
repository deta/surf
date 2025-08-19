<script lang="ts">
  import { useTabs } from '@deta/services'
  import TabItem from './TabItem.svelte'
  import { Icon } from '@deta/icons'

  const tabsService = useTabs()

  $inspect(tabsService.tabs)
  $inspect(tabsService.activeTab)
</script>

<div class="tabs-list">
  {#each tabsService.tabs as tab, index (tab.id)}
    <TabItem tab={tabsService.tabs[index]} active={tabsService.activeTab?.id === tab.id} />
  {/each}

  <div class="add-tab-btn-container">
    <button class="add-tab-btn" onclick={() => tabsService.create('https://google.com')}>
      <Icon name="add" />
    </button>
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

  .add-tab-btn {
    height: fit-content;
    padding: 9px 14px;
    height: 100%;
    color: var(--on-app-background);
    border: none;
    border-radius: 11px;
    transition: 80ms ease-in-out;
    app-region: no-drag;

    &:hover {
      transition: none;
      background-color: var(--white-60);
    }
  }
</style>
