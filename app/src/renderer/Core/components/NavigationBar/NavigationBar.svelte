<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, ResourceLoader, SearchInput } from '@deta/ui'
  import BreadcrumbItems from './BreadcrumbItems.svelte'
  import { writable } from 'svelte/store'
  import LocationBar from './LocationBar.svelte'
  import { type Snippet } from 'svelte'
  import NavigationBarGroup from './NavigationBarGroup.svelte'
  import SaveState from './SaveState.svelte'
  import { isInternalRendererURL } from '@deta/utils'
  import { Resource, useResourceManager } from '@deta/services/resources'
  import { useViewManager, ViewType, type WebContentsView } from '@deta/services/views'
  import DownloadsIndicator from './DownloadsIndicator.svelte'
  import { useBrowser } from '@deta/services/browser'
  import NoteMenu from './NoteMenu.svelte'
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
    onsearchinput,

    roundLeftCorner,
    roundRightCorner,

    leftChildren,
    rightChildren
  }: {
    view: WebContentsView
    tab?: TabItem
    centeredBreadcrumbs?: boolean
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

  const activeLocation = $derived(view.url ?? writable(''))
  const navigationHistory = $derived(view.navigationHistory)
  const navigationHistoryIndex = $derived(view.navigationHistoryIndex)
  const extractedResourceId = $derived(view.extractedResourceId)

  const canGoBack = $derived($navigationHistoryIndex > 0)
  const canGoForward = $derived($navigationHistoryIndex < $navigationHistory?.length - 1)
  const canReload = true

  let isEditingUrl = $state(false)

  function onGoBack() {
    view.webContents.goBack()
  }
  function onGoForward() {
    view.webContents.goForward()
  }
  function onReload(e: MouseEvent) {
    view.webContents.reload(e.shiftKey)
  }

  async function handleAskInSidebar() {
    await browser.openAskInSidebar()
  }
</script>

<nav
  class:grey={[ViewType.Notebook, ViewType.NotebookHome].includes($activeViewType)}
  class:roundLeftCorner
  class:roundRightCorner
>
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

  <NavigationBarGroup fullWidth={!centeredBreadcrumbs} shrink>
    <BreadcrumbItems {view} />
    <LocationBar {view} readonly={readonlyLocation} bind:isEditingUrl />
    <DownloadsIndicator />
    {#if $activeViewType === ViewType.Page}
      {#key $extractedResourceId}
        <SaveState {view} />
      {/key}
    {:else if $activeViewType === ViewType.Resource}
      <ResourceLoader resource={$activeViewTypeData?.id}>
        {#snippet children(resource: Resource)}
          {#if [ResourceTypes.DOCUMENT_SPACE_NOTE, ResourceTypes.PDF].includes(resource.type)}
            {#key $activeViewTypeData.id}
              <SaveState {view} />
            {/key}
          {/if}
        {/snippet}
      </ResourceLoader>
    {/if}

    {#if $activeViewType === ViewType.Resource}
      <ResourceLoader resource={$activeViewTypeData?.id}>
        {#snippet children(resource: Resource)}
          {#if resource?.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
            <NoteMenu {resource} {tab} {view} />
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
        <Icon name="note" size="1.085em" />
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
    background: var(--app-background);
    color: var(--on-app-background);

    background: #fff;
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

    border: 0.5px solid #fff;
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      rgb(237 243 247 / 96%) 0%,
      rgba(255, 255, 255, 1) 100%
    );

    box-shadow:
      0 -0.5px 1px 0 #ffffff1f inset,
      0 1px 1px 0 #fff inset,
      0 -3px 1px 0 rgba(0, 0, 0, 0.025),
      0 -2px 1px 0 rgba(9, 10, 11, 0.01),
      0 -1px 1px 0 rgba(9, 10, 11, 0.03);

    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;

    transition: background 123ms ease-out;

    &.grey {
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        rgb(237 243 247 / 96%) 0%,
        rgba(250, 250, 250, 1) 100%
      );

      box-shadow:
        0 -0.5px 1px 0 rgba(250, 250, 250, 1) inset,
        0 0px 1px 0 #fff inset,
        0 -3px 1px 0 rgba(0, 0, 0, 0.025),
        0 -2px 1px 0 rgba(9, 10, 11, 0.01),
        0 -1px 1px 0 rgba(9, 10, 11, 0.03);
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
