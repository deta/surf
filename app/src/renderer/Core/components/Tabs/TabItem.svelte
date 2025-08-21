<script lang="ts">
  import { TabItem as TabItemClass, useTabs } from '@deta/services/tabs'
  import { DynamicIcon, Icon } from '@deta/icons'

  let { tab, active }: { tab: TabItemClass; active: boolean } = $props()

  const tabsService = useTabs()

  // const title = $derived.by(() => {
  //     if (view.webContents) {
  //         return view.webContents.title || 'Untitled Tab';
  //     }

  //     return 'Untitled Tab';
  // });

  const title = tab.view.title
  const faviconURL = tab.view.faviconURL
  const url = tab.view.url

  function handleClick() {
    tabsService.setActiveTab(tab.id)
  }

  function handleClose(event: MouseEvent) {
    event.stopPropagation()
    tabsService.delete(tab.id)
  }
</script>

<div class="tab-item" class:active onclick={handleClick} aria-hidden="true">
  <!-- {#if tab.view.webContents}
        <TabItemWebContents webContents={tab.view.webContents} />
    {:else}
        <span class="tab-title">Untitled</span>
    {/if} -->

  {#if $url.startsWith('http://localhost')}
    <DynamicIcon name="icon;;file-text-ai" />
  {:else}
    <DynamicIcon name="image;;{$faviconURL}" />
  {/if}

  <span class="tab-title typo-tab-title">{$title}</span>

  <button class="close-button" onclick={handleClose}>
    <Icon name="close" />
  </button>
</div>

<style lang="scss">
  .tab-item {
    position: relative;
    padding: 0.5rem 0.75rem;
    border-radius: 11px;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    width: 100%;
    min-width: 220px;
    max-width: 292px !important;
    gap: var(--t-2);
    align-items: center;
    transition: background-color 90ms ease-out;
    app-region: no-drag;

    &.active {
      border: 0.5px solid white;
      background: linear-gradient(to top, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.77));
      .tab-title {
        color: var(--on-surface-accent);
      }
      color: var(--on-surface-accent);
    }

    &:hover:not(.active) {
      background: rgba(255, 255, 255, 0.6);
      transition: none;
    }

    /* Reveal close button on hover or keyboard focus */
    &:hover .close-button {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .tab-title {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 100%;
    -webkit-font-smoothing: subpixel-antialiased;
    text-rendering: optimizeLegibility;
    color: var(--on-app-background);
  }

  .close-button {
    position: absolute;
    right: var(--t-2);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    opacity: var(--disabled);
    pointer-events: none;
    height: fit-content;
    transition: opacity 120ms ease;
    color: var(--on-surface-muted);
    opacity: 0;

    &:hover {
      color: var(--accent);
      opacity: 1;
    }
  }
</style>
