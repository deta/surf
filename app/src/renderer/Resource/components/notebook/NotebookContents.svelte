<svelte:options runes={true} />

<script module lang="ts">
  export function attachLoadMore(node: HTMLElement, loadMoreFn: () => void) {
    const observerOptions = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMoreFn()
        }
      })
    }, observerOptions)

    observer.observe(node)

    return {
      destroy() {
        observer.disconnect()
      }
    }
  }
</script>

<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Notebook, useNotebookManager } from '@deta/services/notebooks'
  import {
    Button,
    contextMenu,
    NotebookCover,
    openDialog,
    ResourceLoader,
    SearchInput,
    SourceCard,
    SurfLoader
  } from '@deta/ui'
  import {
    handleNotebookClick,
    handleResourceClick,
    openResource
  } from '../../handlers/notebookOpenHandlers'
  import NotebookEditor from './NotebookEditor/NotebookEditor.svelte'
  import { conditionalArrayItem, SearchResourceTags, truncate } from '@deta/utils'
  import { type OpenTarget, type Option, ResourceTypes, SpaceEntryOrigin } from '@deta/types'
  import NotebookSidebarNoteName from './NotebookSidebarNoteName.svelte'
  import {
    useResourceManager,
    Resource,
    getResourceCtxItems,
    type ResourceSearchResult
  } from '@deta/services/resources'
  import { useMessagePortClient } from '@deta/services/messagePort'
  import { promptForFilesAndTurnIntoResources } from '@deta/services'

  let { notebookId }: { notebookId?: string } = $props()

  let isCustomizingNotebook = $state(undefined) as Notebook | undefined | null
  let isNewNotebook = $state(undefined) as Notebook | undefined | null

  let searchQuery = $state('')
  let categoryScrollContainer = $state<HTMLElement>()

  let notesLoadMoreTrigger = $state<HTMLElement | null>(null)
  let sourcesLoadMoreTrigger = $state<HTMLElement | null>(null)

  // on index page, collapse notes and sources by default only showing notebooks
  // on within a notebook, collapse only sources by default
  let collapsedCategories = $derived<Set<string>>(
    notebookId ? new Set(['sources']) : new Set(['notes', 'sources'])
  )

  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  // TODO: have a sane way to manage `Drafts` in the notebook manager itself
  const notebooksList = $derived(
    (() => {
      const draftsNotebook = {
        id: 'drafts',
        nameValue: 'Drafts',
        colorValue: [
          ['#5d5d62', '5d5d62'],
          ['#2e2f34', '#2e2f34'],
          ['#efefef', '#efefef']
        ]
      }

      const filtered = notebookManager.sortedNotebooks
        .filter((e) => {
          if (!searchQuery) return true
          return e.nameValue.toLowerCase().includes(searchQuery.toLowerCase())
        })
        .sort((a, b) => (b.data.pinned === true) - (a.data.pinned === true))

      if (!searchQuery) {
        return [draftsNotebook, ...filtered]
      } else {
        if (draftsNotebook.nameValue.toLowerCase().includes(searchQuery.toLowerCase())) {
          return [draftsNotebook, ...filtered]
        }
        return filtered
      }
    })()
  )

  const handleCreateNote = () => {
    useMessagePortClient().createNote.send({ isNewTabPage: true })
  }

  const handleCreateNotebook = async () => {
    try {
      const notebook = await notebookManager.createNotebook(
        {
          name: 'Untitled Notebook'
        },
        true
      )
      isNewNotebook = notebook
    } catch (e) {
      console.error('Failed to create notebook', e)
    }
  }

  const handlePinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: true })
  }
  const handleUnPinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: false })
  }

  const handleDeleteNotebook = async (notebook: Notebook) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(notebook.nameValue, 26)}</i>`,
      message: `This can't be undone. <br>Your resources won't be deleted.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteNotebook(notebook.id, true)
  }

  const handleCancelNewNotebook = async (notebook: Notebook) => {
    notebookManager.deleteNotebook(notebook.id, true)
  }

  const onDeleteResource = async (resource: Resource) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(resource.metadata.name, 26)}</i>`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteResourcesFromSurf(resource.id, true)
  }

  const handleAddToNotebook = (notebookId: string, resourceId: string) => {
    notebookManager.addResourcesToNotebook(
      notebookId,
      [resourceId],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )
  }
  const handleRemoveFromNotebook = (notebookId: string, resourceId: string) => {
    notebookManager.removeResourcesFromNotebook(notebookId, [resourceId], true)
  }

  const handleUploadFiles = async () => {
    await promptForFilesAndTurnIntoResources(resourceManager, notebookId)
  }

  const handleOpenAsFile = (resourceId: string) => {
    // @ts-ignore
    window.api.openResourceLocally(resourceId)
  }

  const handleExport = (resourceId: string) => {
    // @ts-ignore
    window.api.exportResource(resourceId)
  }

  const getSourceCardCtxItems = (resource: Resource, sourceNotebookId?: string) =>
    getResourceCtxItems({
      resource,
      sortedNotebooks: notebookManager.sortedNotebooks,
      onAddToNotebook: (notebookId) => handleAddToNotebook(notebookId, resource.id),
      onOpen: (target: OpenTarget) => openResource(resource.id, { target, offline: false }),
      onOpenOffline: (resourceId: string) =>
        openResource(resourceId, { offline: true, target: 'tab' }),
      onDeleteResource: () => onDeleteResource(resource),
      onOpenAsFile: () => handleOpenAsFile(resource.id),
      onExport: () => handleExport(resource.id),
      onRemove:
        !sourceNotebookId || sourceNotebookId === 'drafts'
          ? undefined
          : () => handleRemoveFromNotebook(sourceNotebookId, resource.id)
    })

  const categories = $derived([
    ...conditionalArrayItem(notebookId === undefined, {
      id: 'notebooks',
      label: 'Notebooks',
      icon: {
        main: 'notebook',
        add: 'add'
      }
    }),
    {
      id: 'notes',
      label: 'Notes',
      icon: {
        main: 'note',
        add: 'add'
      }
    },
    {
      id: 'sources',
      label: 'Media',
      icon: {
        main: 'link',
        add: 'folder.open'
      }
    }
  ])

  const getAddButtonAction = (categoryId: string) => {
    if (categoryId === 'notebooks') return handleCreateNotebook
    if (categoryId === 'notes') return handleCreateNote
    if (categoryId === 'sources') return handleUploadFiles
  }

  const getAddButtonTooltip = (categoryId: string) => {
    if (categoryId === 'notebooks') return 'Create Notebook'
    if (categoryId === 'notes') return 'Create Note'
    if (categoryId === 'sources') return 'Import Media'
  }

  const toggleCategoryCollapse = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories)
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId)
    } else {
      newCollapsed.add(categoryId)
    }
    collapsedCategories = newCollapsed
  }

  const resetCollapsedCategories = () => {
    collapsedCategories = new Set()
  }

  const isCategoryCollapsed = (categoryId: string) => collapsedCategories.has(categoryId)

  $effect(() => {
    if (searchQuery.length > 0) {
      if (categoryScrollContainer) {
        categoryScrollContainer.scrollTo({ left: 0, behavior: 'smooth' })
      }
      resetCollapsedCategories()
    }
  })
</script>

{#snippet loadingSnippet()}
  <div class="loading-more">
    <Icon name="spinner" />
  </div>
{/snippet}

{#snippet noResultsSnippet(categoryLabel: string)}
  <section class="empty">
    <p>No {categoryLabel} found for "{searchQuery}"</p>
  </section>
{/snippet}

{#snippet notesList({ resources, searchResults, pagination, loadMore })}
  {#if searchQuery && searchResults?.length === 0}
    {@render noResultsSnippet('notes')}
  {:else if resources.length <= 0}
    {#if searchQuery.length > 0}
      {@render noResultsSnippet('notes')}
    {:else}
      <div class="px py">
        <section class="empty">
          <h1>What are Surf Notes?</h1>

          <p style="max-width: 50ch;">
            Surf notes are rich text documents that you can create manually or generate using Surf's
            AI from your personal media.<br />
          </p>

          <p style="max-width: 48ch;">
            Jump start a new note by asking Surf's AI something in the input box above or create a
            blank note using the button.
          </p>
        </section>
      </div>
    {/if}
  {:else}
    <div class="sources-grid">
      {#each searchResults ?? resources as resource, i (typeof resource === 'string' ? resource : resource.id + i)}
        <ResourceLoader {resource}>
          {#snippet children(resource: Resource)}
            <NotebookSidebarNoteName {resource} sourceNotebookId={notebookId} />
          {/snippet}
        </ResourceLoader>
      {/each}
    </div>

    {#if pagination.hasMore && !searchQuery}
      <div
        class="load-more-trigger"
        bind:this={notesLoadMoreTrigger}
        data-load-more="notes"
        use:attachLoadMore={loadMore}
      >
        {#if pagination.isLoadingMore}
          {@render loadingSnippet()}
        {/if}
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet sourcesList({ resources, searchResults, pagination, loadMore })}
  {#if searchQuery && searchResults?.length === 0}
    {@render noResultsSnippet('media')}
  {:else if resources.length === 0}
    <div class="px py">
      <div class="empty">
        <h1>Surf Media</h1>

        <p style="max-width: 55ch;">
          Add media from across the web or your system to your notebook and to use it together with
          Surf Notes to turn them into something great.
        </p>

        <p style="max-width: 57ch;">
          Save web pages using the "Save" button while browsing, import local files or add existing
          media from other notebooks by right-clicking them.
        </p>
      </div>
    </div>
  {:else}
    <div class="sources-grid">
      {#each searchResults ?? resources as resource, i (typeof resource === 'string' ? resource : resource.id + i)}
        <ResourceLoader {resource}>
          {#snippet children(resource: Resource)}
            <SourceCard
              --width={'34px'}
              --height={'41px'}
              --max-width={''}
              {resource}
              text
              {onDeleteResource}
              onclick={(e) => handleResourceClick(resource.id, e)}
              {@attach contextMenu({
                canOpen: true,
                items: getSourceCardCtxItems(resource, notebookId)
              })}
            />
          {/snippet}
        </ResourceLoader>
      {/each}
    </div>

    {#if pagination.hasMore && !searchQuery}
      <div
        class="load-more-trigger"
        bind:this={sourcesLoadMoreTrigger}
        data-load-more="sources"
        use:attachLoadMore={loadMore}
      >
        {#if pagination.isLoadingMore}
          {@render loadingSnippet()}
        {/if}
      </div>
    {/if}
  {/if}
{/snippet}

{#if isCustomizingNotebook}
  <NotebookEditor bind:notebook={isCustomizingNotebook} />
{:else if isCustomizingNotebook === null}
  <NotebookEditor />
{/if}

{#if isNewNotebook}
  <NotebookEditor
    bind:notebook={isNewNotebook}
    mode="create"
    oncreate={() => {
      handlePinNotebook(isNewNotebook!.id)
      isNewNotebook = null
    }}
    oncancel={() => {
      handleCancelNewNotebook(isNewNotebook!)
      isNewNotebook = null
    }}
  />
{/if}

<div class="library-container">
  <header class="library-header">
    <h3 class="library-title">
      {notebookId ? 'Your Notebook' : 'Your Library'}
    </h3>
    <SearchInput bind:value={searchQuery} />
  </header>

  <div class="categories-scroll-container" bind:this={categoryScrollContainer}>
    <div class="categories-scroll-content">
      {#each categories as category}
        <div class="category-section">
          <div class="category-header">
            <button class="category-tab" onclick={() => toggleCategoryCollapse(category.id)}>
              <Icon name={category.icon.main} />
              <span>{category.label}</span>
              <Icon
                name={isCategoryCollapsed(category.id) ? 'chevron.down' : 'chevron.up'}
                style="margin-left: auto; font-size: 0.8rem; opacity: 0.5;"
              />
            </button>
            {#if !isCategoryCollapsed(category.id)}
              <Button
                size="sm"
                tooltip={getAddButtonTooltip(category.id)}
                onclick={getAddButtonAction(category.id)}
                class="category-add-btn"
              >
                <Icon name={category.icon.add} />
              </Button>
            {/if}
          </div>

          {#if !isCategoryCollapsed(category.id)}
            <div class={'category-content'}>
              {#if category.id === 'notebooks'}
                {#if notebooksList.length <= 0 && searchQuery.length > 0}
                  {@render noResultsSnippet('notebooks')}
                {/if}
                <div class="notebook-grid">
                  {#each notebooksList as notebook, i (notebook.id + i)}
                    <div
                      class="notebook-wrapper"
                      style="width: 100%;max-width: 11.25ch;"
                      style:--delay={100 + i * 10 + 'ms'}
                    >
                      <NotebookCover
                        {notebook}
                        height="17.25ch"
                        fontSize="0.85rem"
                        onclick={(e) => handleNotebookClick(notebook.id, e)}
                        canPin={notebook.id !== 'drafts'}
                        onpin={() => handlePinNotebook(notebook.id)}
                        onunpin={() => handleUnPinNotebook(notebook.id)}
                        {@attach contextMenu({
                          canOpen: notebook.id !== 'drafts',
                          items: [
                            !notebook.data?.pinned
                              ? {
                                  type: 'action',
                                  text: 'Add to Favorites',
                                  icon: 'heart',
                                  action: () => handlePinNotebook(notebook.id)
                                }
                              : {
                                  type: 'action',
                                  text: 'Remove from Favorites',
                                  icon: 'heart.off',
                                  action: () => handleUnPinNotebook(notebook.id)
                                },
                            {
                              type: 'action',
                              text: 'Customize',
                              icon: 'edit',
                              action: () => (isCustomizingNotebook = notebook)
                            },
                            {
                              type: 'action',
                              kind: 'danger',
                              text: 'Delete',
                              icon: 'trash',
                              action: () => handleDeleteNotebook(notebook)
                            }
                          ]
                        })}
                      />
                    </div>
                  {/each}
                </div>
              {:else if category.id === 'notes'}
                <ul>
                  <SurfLoader
                    pageSize={20}
                    {notebookId}
                    tags={[
                      SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')
                    ]}
                    search={{
                      query: searchQuery,
                      tags: [
                        SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')
                      ],
                      parameters: {
                        semanticSearch: false
                      }
                    }}
                  >
                    {#snippet children(loaderData)}
                      {@render notesList(loaderData)}
                    {/snippet}
                    {#snippet loading()}
                      {@render loadingSnippet()}
                    {/snippet}
                  </SurfLoader>
                </ul>
              {:else if category.id === 'sources'}
                <SurfLoader
                  pageSize={20}
                  {notebookId}
                  tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')]}
                  search={{
                    query: searchQuery,
                    tags: [
                      SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')
                    ],
                    parameters: {
                      semanticSearch: false
                    }
                  }}
                >
                  {#snippet children(loaderData)}
                    {@render sourcesList(loaderData)}
                  {/snippet}
                  {#snippet loading()}
                    {@render loadingSnippet()}
                  {/snippet}
                </SurfLoader>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style lang="scss">
  .library-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-right: 10px !important;
  }

  .library-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
    gap: 0.75rem;

    :global(input) {
      transition: all 0.2s ease;
    }
  }

  .library-title-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
    }

    :global([data-icon]) {
      transition: transform 0.2s ease;
    }
  }

  .library-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
  }

  .categories-scroll-container {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2)) transparent;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2));
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.3));
    }
  }

  .categories-scroll-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 1rem;
  }

  .category-section {
    flex-shrink: 0;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 0.5rem;
  }

  .category-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    color: light-dark(rgba(0, 0, 0, 0.8), rgba(255, 255, 255, 0.8));
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
    }

    :global([data-icon]) {
      transition: transform 0.2s ease;
    }
  }

  :global(.category-add-btn[data-button-root]) {
    padding: 0.35rem 0.5rem;
    opacity: 0.6;
    flex-shrink: 0;

    &:hover {
      opacity: 1;
    }
  }

  .category-content {
    max-height: min(360px, 40vh);
    overflow-y: auto;
    transform-origin: top;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.15)) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.15));
      border-radius: 3px;
      transition: background-color 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.25));
    }

    @media screen and (min-width: 1440px) {
      max-height: 50vh;
    }

    @media screen and (min-width: 1920px) {
      max-height: 60vh;
    }
  }

  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11.3ch, 1fr));
    gap: 0.5rem;
  }

  .sources-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    grid-auto-rows: 60px;
  }

  .load-more-trigger {
    text-align: center;
    width: 100%;
    margin-top: 1rem;
    padding: 0.5rem;
  }

  .loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
  }

  .empty {
    width: 100%;
    border: 1px dashed light-dark(rgba(0, 0, 0, 0.2), rgba(71, 85, 105, 0.4));
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    gap: 0.5rem;
    color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.3));
    text-align: center;
    text-wrap: pretty;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    h3 {
      color: light-dark(rgba(0, 0, 0, 0.75), rgba(255, 255, 255, 0.8));
    }

    p {
      font-size: var(--title-sm-fontSize);
      line-height: var(--title-sm-lineHeight);
      letter-spacing: 0.015em;
      font-weight: 400;
      color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
      max-width: 60ch;
    }
  }
</style>
