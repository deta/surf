<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'
  import BreadcrumbItems from './BreadcrumbItems.svelte'
  import SearchInput from './SearchInput.svelte'
  import { writable } from 'svelte/store'
  import LocationBar from './LocationBar.svelte'
  import WebContentsView from '../WebContentsView.svelte'
  import { type Snippet } from 'svelte'
  import NavigationBarGroup from './NavigationBarGroup.svelte'
  import SaveState from './SaveState.svelte'
  import { isInternalRendererURL } from '@deta/utils'

  let {
    view,

    // Allow changing the view location url or not
    readonlyLocation = false,

    centeredBreadcrumbs = false,
    hideNavigationControls = false,
    hideSearch = false,

    leftChildren,
    rightChildren
  }: {
    view: WebContentsView
    centeredBreadcrumbs?: boolean
    readonlyLocation?: boolean
    locationInputDisabled?: boolean
    hideNavigationControls?: boolean
    hideSearch?: boolean
    leftChildren?: Snippet
    rightChildren?: Snippet
  } = $props()

  const activeLocation = $derived(view.url ?? writable(''))
  const navigationHistory = $derived(view.navigationHistory)
  const navigationHistoryIndex = $derived(view.navigationHistoryIndex)
  const extractedResourceId = $derived(view.extractedResourceId)

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
  {@render leftChildren?.()}

  {#if !hideNavigationControls}
    <NavigationBarGroup>
      <NavigationBarGroup slim>
        <Button size="md" square onclick={onGoBack} disabled={!canGoBack}>
          <Icon name="arrow.left" size="1.2em" />
        </Button>
        <Button size="md" square onclick={onGoForward} disabled={!canGoForward}>
          <Icon name="arrow.right" size="1.2em" />
        </Button>
      </NavigationBarGroup>
      <Button size="md" square onclick={onReload} disabled={!canReload}>
        <Icon name="reload" size="1.085em" />
      </Button>
    </NavigationBarGroup>
  {/if}
  <NavigationBarGroup fullWidth={!centeredBreadcrumbs}>
    <BreadcrumbItems {view} />
    <LocationBar {view} readonly={readonlyLocation} />
    {#if !isInternalRendererURL($activeLocation)}
      {#key $extractedResourceId}
        <SaveState {view} />
      {/key}
    {/if}
  </NavigationBarGroup>

  {#if !hideSearch}
    <NavigationBarGroup>
      <!-- TODO: (maxu): Make better check -->
      <SearchInput collapsed={!$activeLocation?.includes('notebook.html')} />
    </NavigationBarGroup>
  {/if}

  {@render rightChildren?.()}
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
    justify-content: space-between;
  }
</style>
