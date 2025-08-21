<script>
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'
  import { useTabs } from '@deta/services/tabs'

  const tabsService = useTabs()
  const activeTab = $derived(tabsService.activeTab)

  const navigationHistory = $derived(activeTab?.view.navigationHistory)
  const navigationHistoryIndex = $derived(activeTab?.view.navigationHistoryIndex)

  const canGoBack = $derived($navigationHistoryIndex > 0)
  const canGoForward = $derived($navigationHistoryIndex < $navigationHistory?.length - 1)
  const canReload = true

  function onGoBack() {
    if (!tabsService.activeTab) return
    tabsService.activeTab.view.webContents.goBack()
  }
  function onGoForward() {
    if (!tabsService.activeTab) return
    tabsService.activeTab.view.webContents.goForward()
  }
  function onReload() {
    if (!tabsService.activeTab) return
    tabsService.activeTab.view.webContents.reload()
  }
</script>

<nav>
  <div class="group">
    <div class="group slim">
      <Button onclick={onGoBack} disabled={!canGoBack}>
        <Icon name="arrow.left" />
      </Button>
      <Button onclick={onGoForward} disabled={!canGoForward}>
        <Icon name="arrow.right" />
      </Button>
    </div>
    <Button onclick={onReload} disabled={!canReload}>
      <Icon name="reload" size="1.085rem" />
    </Button>
  </div>
</nav>

<style lang="scss">
  nav {
    padding: 0.25rem 0.75rem;
    background: var(--app-background);
    color: var(--on-app-background);

    display: flex;
    align-items: center;

    .group {
      display: flex;
      align-items: center;

      // Smol trick to make the back & forwards buttons visually more balanced
      &.slim {
        :global([data-button-root]:first-child) {
          margin-right: -1.5px;
        }
        :global([data-button-root]:last-child) {
          margin-left: -1.5px;
        }
      }
    }
  }
</style>
