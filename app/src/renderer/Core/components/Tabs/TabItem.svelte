<script lang="ts">
  import { TabItem, useTabs } from '@deta/services'
  import TabItemWebContents from './TabItemWebContents.svelte'
  import { DynamicIcon, Icon } from '@deta/icons'

  let { tab = $bindable(), active = $bindable() }: { tab: TabItem; active: boolean } = $props()

  const tabsService = useTabs()

  // const title = $derived.by(() => {
  //     if (view.webContents) {
  //         return view.webContents.title || 'Untitled Tab';
  //     }

  //     return 'Untitled Tab';
  // });

  const title = tab.view.title
  const faviconURL = tab.view.faviconURL

  function handleClick() {
    tabsService.setActiveTab(tab.id)
  }

  function handleClose(event: MouseEvent) {
    event.stopPropagation()
    tabsService.delete(tab.id)
  }
</script>

<div class="tab-item" class:active onclick={handleClick}>
  <!-- {#if tab.view.webContents}
        <TabItemWebContents webContents={tab.view.webContents} />
    {:else}
        <span class="tab-title">Untitled</span>
    {/if} -->

  <DynamicIcon name="image;;{$faviconURL}" />

  <span class="tab-title">{$title}</span>

  <button onclick={handleClose}>
    <Icon name="close" />
  </button>
</div>

<style lang="scss">
  .tab-item {
    padding: 0.5rem;
    background-color: var(--color-background);
    border-radius: 4px;
    cursor: pointer;
    user-select: none;

    &.active {
      background-color: var(--color-active-background);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }

  .tab-title {
    font-weight: bold;
  }
</style>
