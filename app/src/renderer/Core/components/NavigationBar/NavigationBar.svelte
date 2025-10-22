<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, ResourceLoader } from '@deta/ui'
  import BreadcrumbItems from './BreadcrumbItems.svelte'
  import { writable } from 'svelte/store'
  import LocationBar from './LocationBar.svelte'
  import { type Snippet } from 'svelte'
  import NavigationBarGroup from './NavigationBarGroup.svelte'
  import SaveState from './SaveState.svelte'
  import { isInternalRendererURL, isModKeyPressed } from '@deta/utils'
  import { Resource, useResourceManager } from '@deta/services/resources'
  import { useViewManager, ViewType, type WebContentsView } from '@deta/services/views'
  import DownloadsIndicator from './DownloadsIndicator.svelte'
  import { useBrowser } from '@deta/services/browser'
  import ResourceMenu from './ResourceMenu.svelte'
  import { ResourceTypes } from '@deta/types'
  import type { TabItem } from '@deta/services/tabs'

  let {
    view,
    tab,

    // Allow changing the view location url or not
    readonlyLocation = false,

    centeredBreadcrumbs = false,
    hideNavigationControls = false,
    hideSearch = false,
    hideNotebookSidebar = false,
    onsearchinput,

    roundLeftCorner,
    roundRightCorner,

    leftChildren,
    rightChildren
  }: {
    view: WebContentsView
    tab?: TabItem
    centeredBreadcrumbs?: boolean
    hideNotebookSidebar?: boolean
    readonlyLocation?: boolean
    locationInputDisabled?: boolean
    hideNavigationControls?: boolean
    hideSearch?: boolean
    onsearchinput?: (value: string) => void
    leftChildren?: Snippet
    rightChildren?: Snippet

    // sheeeeet not timmmmeee
    roundLeftCorner?: boolean
    roundRightCorner?: boolean
  } = $props()

  export function setIsEditingLocation(v: boolean) {
    isEditingUrl = v
  }
  const resourceManager = useResourceManager()
  const viewManager = useViewManager()
  const browser = useBrowser()

  const activeViewType = $derived(view.type ?? writable(''))
  const activeViewTypeData = $derived(view.typeData ?? writable({}))

  let notebookSidebarOpen = $state(
    localStorage.getItem('notebook_treeSidebarOpen')
      ? localStorage.getItem('notebook_treeSidebarOpen') === 'true'
      : true
  )

  function toggleNotebookSidebar() {
    notebookSidebarOpen = !notebookSidebarOpen
    localStorage.setItem('notebook_treeSidebarOpen', notebookSidebarOpen.toString())

    if (window.api?.webContentsViewAction) {
      window.api
        .webContentsViewAction(view.id, 'send', {
          channel: 'toggle-notebook-sidebar',
          args: [{ open: notebookSidebarOpen }]
        })
        .catch(console.error)
    }
  }

  const activeLocation = $derived(view.url ?? writable(''))
  const navigationHistory = $derived(view.navigationHistory)
  const navigationHistoryIndex = $derived(view.navigationHistoryIndex)
  const extractedResourceId = $derived(view.extractedResourceId)
  const resourceCreatedByUser = $derived(view.resourceCreatedByUser)

  const canGoBack = $derived($navigationHistoryIndex > 0)
  const canGoForward = $derived($navigationHistoryIndex < $navigationHistory?.length - 1)
  const canReload = true

  let isEditingUrl = $state(false)

  function cloneAndOpenView(offset: number, background: boolean) {
    browser.cloneAndOpenView(view, {
      historyOffset: offset,
      target: background ? 'background_tab' : 'tab'
    })
  }

  function onGoBack(e: MouseEvent) {
    if (isModKeyPressed(e) || e.button === 1) {
      cloneAndOpenView(-1, !e.shiftKey)
      return
    }

    view.webContents.goBack()
  }
  function onGoForward(e: MouseEvent) {
    if (isModKeyPressed(e)) {
      cloneAndOpenView(1, !e.shiftKey)
      return
    }

    view.webContents.goForward()
  }
  function onReload(e: MouseEvent) {
    if (isModKeyPressed(e)) {
      cloneAndOpenView(0, !e.shiftKey)
      return
    }

    view.webContents.reload(e.shiftKey)
  }

  function onGoBackAux(e: MouseEvent) {
    if (e.button === 1) {
      cloneAndOpenView(-1, !e.shiftKey)
    }
  }

  function onGoForwardAux(e: MouseEvent) {
    if (e.button === 1) {
      cloneAndOpenView(1, !e.shiftKey)
    }
  }

  function onReloadAux(e: MouseEvent) {
    if (e.button === 1) {
      cloneAndOpenView(0, !e.shiftKey)
    }
  }

  async function handleAskInSidebar() {
    await browser.openAskInSidebar()
  }
</script>

<nav
  class:grey={[ViewType.Notebook, ViewType.NotebookHome].includes($activeViewType)}
  class:roundLeftCorner
  class:roundRightCorner
  class="navbar"
>
  {@render leftChildren?.()}

  {#if !hideNotebookSidebar && [ViewType.Notebook, ViewType.NotebookHome].includes($activeViewType)}
    <NavigationBarGroup slim>
      <Button size="md" square onclick={toggleNotebookSidebar}>
        <Icon name={notebookSidebarOpen ? 'sidebar.left' : 'sidebar.left'} size="1.2em" />
      </Button>
    </NavigationBarGroup>
  {:else if !hideNotebookSidebar && $activeViewType === ViewType.Resource}
    <ResourceLoader resource={$activeViewTypeData?.id} lazy={false}>
      {#snippet children(resource: Resource)}
        {#if resource.type !== ResourceTypes.PDF}
          <NavigationBarGroup slim>
            <Button size="md" square onclick={toggleNotebookSidebar}>
              <Icon name={notebookSidebarOpen ? 'sidebar.left' : 'sidebar.left'} size="1.2em" />
            </Button>
          </NavigationBarGroup>
        {/if}
      {/snippet}
    </ResourceLoader>
  {/if}

  {#if !hideNavigationControls}
    <NavigationBarGroup>
      <NavigationBarGroup slim>
        <Button size="md" square onclick={onGoBack} onauxclick={onGoBackAux} disabled={!canGoBack}>
          <Icon name="arrow.left" size="1.2em" />
        </Button>
        <Button
          size="md"
          square
          onclick={onGoForward}
          onauxclick={onGoForwardAux}
          disabled={!canGoForward}
        >
          <Icon name="arrow.right" size="1.2em" />
        </Button>
      </NavigationBarGroup>
      <Button size="md" square onclick={onReload} onauxclick={onReloadAux} disabled={!canReload}>
        <Icon name="reload" size="1.085em" />
      </Button>
    </NavigationBarGroup>
  {/if}

  <NavigationBarGroup fullWidth={!centeredBreadcrumbs} shrink>
    <BreadcrumbItems {view} />
    <LocationBar {view} readonly={readonlyLocation} bind:isEditingUrl />
    <DownloadsIndicator />

    {#if $activeViewType === ViewType.Resource}
      {#key $activeViewTypeData?.id}
        <ResourceLoader resource={$activeViewTypeData?.id}>
          {#snippet children(resource: Resource)}
            <ResourceMenu {resource} {tab} {view} />
          {/snippet}
        </ResourceLoader>
      {/key}
    {:else if $activeViewType === ViewType.Page && $extractedResourceId && $resourceCreatedByUser}
      {#key $extractedResourceId}
        <ResourceLoader resource={$extractedResourceId}>
          {#snippet children(resource: Resource)}
            <ResourceMenu {resource} {tab} {view} />
          {/snippet}
        </ResourceLoader>
      {/key}
    {:else}
      {#key $activeLocation}
        <ResourceMenu {tab} {view} />
      {/key}
    {/if}

    {#if $activeViewType === ViewType.Page}
      {#key $extractedResourceId}
        <SaveState {view} />
      {/key}
    {:else if $activeViewType === ViewType.Resource}
      <ResourceLoader resource={$activeViewTypeData?.id}>
        {#snippet children(resource: Resource)}
          {#if resource && [ResourceTypes.DOCUMENT_SPACE_NOTE, ResourceTypes.PDF].includes(resource.type)}
            {#key $activeViewTypeData.id}
              <SaveState {view} />
            {/key}
          {/if}
        {/snippet}
      </ResourceLoader>
    {/if}

    {#if !viewManager.sidebarViewOpen && ($activeViewType === ViewType.Page || ($activeViewType === ViewType.Resource && $activeViewTypeData.raw))}
      <Button
        size="md"
        onclick={handleAskInSidebar}
        style="padding-block: 6px;padding-inline: 8px;"
      >
        <Icon name="note" size="1.3rem" />
        <span>Ask</span>
      </Button>
    {/if}
  </NavigationBarGroup>

  <!--{#if false && !hideSearch}
    <NavigationBarGroup
      style={![ViewType.Notebook, ViewType.NotebookHome].includes($activeViewType)
        ? 'margin-left: -0.5rem'
        : ''}
    >
      <SearchInput
        placeholder="Search sources"
        collapsed={![ViewType.Notebook, ViewType.NotebookHome].includes($activeViewType)}
        {onsearchinput}
      />
    </NavigationBarGroup>
  {/if}-->

  {@render rightChildren?.()}
</nav>

<style lang="scss">
  nav {
    padding: 0.3rem 0.75rem;
    padding-left: 0.35rem;
    padding-right: 0.35rem;
    background: light-dark(var(--app-background), var(--app-background-dark));
    color: light-dark(var(--on-app-background), var(--on-app-background-dark));

    background: light-dark(#fff, #1a2438);
    border-top-left-radius: 1rem;
    border-top-right-radius: 1rem;

    //border-top: 1px solid var(--border-color);
    //border-left: 1px solid var(--border-color);
    //border-right: 1px solid var(--border-color);
    margin-inline: 0px;

    //&.roundRightCorner {
    //  border-top-right-radius: 1rem;
    //}
    //&.roundLeftCorner {
    //  border-top-left-radius: 1rem;
    //}

    border: 0.5px solid light-dark(#fff, rgba(71, 85, 105, 0.3));
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      light-dark(rgb(237 243 247 / 96%), rgba(27, 36, 56, 0.92)) 0%,
      light-dark(rgba(255, 255, 255, 1), rgba(26, 36, 56, 1)) 100%
    );

    box-shadow:
      0 -0.5px 1px 0 light-dark(#ffffff1f, rgba(71, 85, 105, 0.12)) inset,
      0 1px 1px 0 light-dark(#fff, rgba(71, 85, 105, 0.2)) inset,
      0 -3px 1px 0 light-dark(rgba(0, 0, 0, 0.025), rgba(0, 0, 0, 0.15)),
      0 -2px 1px 0 light-dark(rgba(9, 10, 11, 0.01), rgba(0, 0, 0, 0.08)),
      0 -1px 1px 0 light-dark(rgba(9, 10, 11, 0.03), rgba(0, 0, 0, 0.12));

    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;

    transition: background 123ms ease-out;

    &.grey {
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        light-dark(rgb(237 243 247 / 96%), rgba(27, 36, 56, 0.92)) 0%,
        light-dark(rgba(250, 250, 250, 1), rgba(30, 40, 58, 1)) 100%
      );

      box-shadow:
        0 -0.5px 1px 0 light-dark(rgba(250, 250, 250, 1), rgba(71, 85, 105, 0.2)) inset,
        0 0px 1px 0 light-dark(#fff, rgba(71, 85, 105, 0.15)) inset,
        0 -3px 1px 0 light-dark(rgba(0, 0, 0, 0.025), rgba(0, 0, 0, 0.15)),
        0 -2px 1px 0 light-dark(rgba(9, 10, 11, 0.01), rgba(0, 0, 0, 0.08)),
        0 -1px 1px 0 light-dark(rgba(9, 10, 11, 0.03), rgba(0, 0, 0, 0.12));
    }

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

    &.navbar {
      height: 42px;
    }

    .breadcrumbs {
      width: 100%;
      height: 100%;
      flex-shrink: 1;
    }
    .search {
      flex: 1;
    }
  }
</style>
