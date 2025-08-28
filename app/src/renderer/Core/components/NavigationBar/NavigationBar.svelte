<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'
  import BreadcrumbItems from './BreadcrumbItems.svelte'
  import SearchInput from './SearchInput.svelte'
  import { writable } from 'svelte/store'
  import LocationBar from './LocationBar.svelte'
  import WebContentsView from '../WebContentsView.svelte'
  import SaveState from './SaveState.svelte';

  let { view }: { view: WebContentsView } = $props()

  const activeLocation = $derived(view.url ?? writable(''))
  const navigationHistory = $derived(view.navigationHistory)
  const navigationHistoryIndex = $derived(view.navigationHistoryIndex)

  const canGoBack = $derived($navigationHistoryIndex > 0)
  const canGoForward = $derived($navigationHistoryIndex < $navigationHistory?.length - 1)
  const canReload = true

  function onGoBack() {
    view.webContents.goBack()
  }
  function onGoForward() {
    view.webContents.goForward()
  }
  function onReload(e: MouseEvent) {
    view.webContents.reload(e.shiftKey)
  }
</script>

<nav>
  <div class="group">
    <div class="group slim">
      <Button size="md" square onclick={onGoBack} disabled={!canGoBack}>
        <Icon name="arrow.left" size="1.2em" />
      </Button>
      <Button size="md" square onclick={onGoForward} disabled={!canGoForward}>
        <Icon name="arrow.right" size="1.2em" />
      </Button>
    </div>
    <Button size="md" square onclick={onReload} disabled={!canReload}>
      <Icon name="reload" size="1.085em" />
    </Button>
  </div>
  <div class="group breadcrumbs">
    <BreadcrumbItems {view} />
    <LocationBar {view} />
    <SaveState {view} />
  </div>
  <div class="group search">
    <!-- TODO: (maxu): Make better check -->
    <SearchInput collapsed={!$activeLocation?.includes('notebook.html')} />
  </div>
</nav>

<style lang="scss">
  nav {
    padding: 0.3rem 0.75rem;
    padding-left: 0.35rem;
    padding-right: 0.3rem;
    background: var(--app-background);
    color: var(--on-app-background);

    background: #fff;
    border-top-left-radius: 1rem;
    border-top-right-radius: 1rem;
    border-top: 1px solid var(--border-color);
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    margin-inline: -1px;

    display: flex;
    gap: 0.5rem;
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

    .breadcrumbs {
      width: 100%;
      flex-shrink: 1;
    }
    .search {
      flex: 1;
    }
  }
</style>
