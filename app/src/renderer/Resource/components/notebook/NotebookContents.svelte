<script lang="ts">
  import { DynamicIcon, Icon } from '@deta/icons'
  import { Notebook, useNotebookManager } from '@deta/services/notebooks'
  import {
    Button,
    contextMenu,
    NotebookCover,
    NotebookLoader,
    openDialog,
    ResourceLoader,
    SearchInput,
    SimpleTabs,
    SourceCard,
    SurfLoader
  } from '@deta/ui'
  import {
    handleNotebookClick,
    handleResourceClick,
    openNotebook,
    openResource
  } from '../../handlers/notebookOpenHandlers'
  import NotebookEditor from './NotebookEditor/NotebookEditor.svelte'
  import { conditionalArrayItem, SearchResourceTags, truncate, useThrottle } from '@deta/utils'
  import { type OpenTarget, ResourceTypes, SpaceEntryOrigin } from '@deta/types'
  import NotebookSidebarNoteName from './NotebookSidebarNoteName.svelte'
  import { useResourceManager, Resource, getResourceCtxItems } from '@deta/services/resources'
  import { useMessagePortClient } from '@deta/services/messagePort'
  import { promptForFilesAndTurnIntoResources, useTeletypeService } from '@deta/services'
  import { tick } from 'svelte'

  let { notebookId }: { notebookId?: string } = $props()

  const teletype = useTeletypeService()
  const ttyQuery = teletype.query

  let isCustomizingNotebook = $state(undefined) as Notebook | undefined | null
  let isNewNotebook = $state(undefined) as Notebook | undefined | null
  let activeTab = $state<'notebooks' | 'notes' | 'sources'>(
    notebookId === undefined ? 'notebooks' : 'notes'
  )
  let showAll = $state(false)
  $effect(() => {
    if (activeTab) showAll = false
  })

  const query = $derived($ttyQuery)
  let searchQuery = $state('')

  let resourceRenderCnt = $state(20)
  // TODO: Put this into lazy scroll component, no need for rawdogging crude js
  const handleMediaWheel = useThrottle(() => {
    resourceRenderCnt += 4
  }, 5)

  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  const notebooksList = $derived(
    notebookManager.sortedNotebooks
      .filter((e) => {
        if (!searchQuery) return true
        return e.nameValue.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .sort((a, b) => (b.data.pinned === true) - (a.data.pinned === true))
  )

  const handleCreateNote = () => {
    useMessagePortClient().createNote.send({ isNewTabPage: true })
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

    if (!notebookId || notebookId === 'drafts') {
      activeTab = 'notes'
      await tick()
      activeTab = 'sources'
    }
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

  const filterNoteResources = (
    resources: NotebookEntry[],
    searchResults: Option<ResourceSearchResult>
  ) => {
    if (searchResults) {
      return searchResults.filter((e) => e.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE)
    } else {
      return resources.filter((e) => e.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE)
    }
  }
  const filterOtherResources = (
    resources: NotebookEntry[],
    searchResults: Option<ResourceSearchResult>
  ) => {
    if (searchResults) {
      return searchResults.filter((e) => e.resource_type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
    } else return resources.filter((e) => e.resource_type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
  }

  let showAllNotes = true
</script>

{#snippet notesList(visibleItems, allItems)}
  {#if allItems.length <= 0}
    {#if (notebookId ? $ttyQuery : searchQuery).length > 0}
      <section class="empty">
        <p>Nothing found for "{notebookId ? $ttyQuery : searchQuery}"</p>
      </section>
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

          <!-- <Button size="md" onclick={handleUploadFiles}>Import Local Files</Button> -->
        </section>
      </div>
    {/if}
  {:else}
    {#each visibleItems as resource, i (typeof resource === 'string' ? resource : resource.id + i)}
      <ResourceLoader {resource}>
        {#snippet children(resource: Resource)}
          <NotebookSidebarNoteName {resource} sourceNotebookId={notebookId} />
        {/snippet}
      </ResourceLoader>
    {/each}

    {#if allItems.length > visibleItems.length}
      <div style="margin-top: 0.75rem;" onclick={() => (showAll = !showAll)}>
        <Button size="md"
          >{#if showAll}Hide{:else}Show All{/if}</Button
        >
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet sourcesList(visibleItems, allItems)}
  {#if allItems.length <= 0}
    {#if (notebookId ? $ttyQuery : searchQuery).length > 0}
      <section class="empty">
        <p>Nothing found for "{notebookId ? $ttyQuery : searchQuery}"</p>
      </section>
    {:else}
      <div class="px py">
        <div class="empty">
          <h1>Surf Media</h1>

          <p style="max-width: 55ch;">
            Add media from across the web or your system to your notebook and to use it together
            with Surf Notes to turn them into something great.
          </p>

          <p style="max-width: 57ch;">
            Save web pages using the "Save" button while browsing, import local files or add
            existing media from other notebooks by right-clicking them.
          </p>

          <!-- <h2>
            What you can add:
          </h2> -->

          <!-- <ul>
            <li>Web pages (articles, PDFs, YouTube Videos, documents, & more)</li>
            <li>Local files (PDFs)</li>
            <li>Existing media from other notebooks</li>
          </ul> -->

          <!-- <Button size="md" onclick={handleUploadFiles}>Import Local Files</Button> -->
        </div>
      </div>
    {/if}
  {:else}
    <div class="sources-grid" onwheel={handleMediaWheel}>
      {#each visibleItems as resource, i (typeof resource === 'string' ? resource : resource.id + i)}
        <ResourceLoader {resource}>
          {#snippet children(resource: Resource)}
            <SourceCard
              --width={'5rem'}
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
    {#if resourceRenderCnt < allItems.length}
      <div style="text-align:center;width:100%;margin-top:1rem;">
        <span class="typo-title-sm" style="opacity: 0.5;">Scroll to load more</span>
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

<header class="flex items-center justify-between">
  <SimpleTabs
    bind:activeTabId={activeTab}
    onSelect={() => (showAllNotes = false)}
    tabs={[
      ...conditionalArrayItem(notebookId === undefined, {
        id: 'notebooks',
        label: 'Notebooks',
        icon: 'notebook'
      }),
      {
        id: 'notes',
        label: 'Notes',
        icon: 'note'
      },
      {
        id: 'sources',
        label: 'Media',
        icon: 'link'
      }
    ]}
  />

  <!-- {#if !notebookId}
    <SearchInput bind:value={searchQuery} placeholder="Search stuff..." />
  {/if} -->

  {#if activeTab === 'notes'}
    <Button size="md" onclick={handleCreateNote} class="add-btn">
      <Icon name="add" />
      <span> New Note </span>
    </Button>
  {:else if activeTab === 'sources'}
    <Button size="md" onclick={handleUploadFiles} class="add-btn">
      <Icon name="folder.open" />
      Import Files
    </Button>
  {/if}
</header>

{#if activeTab === 'notebooks'}
  {#if !searchQuery || (searchQuery !== null && searchQuery.length > 0)}
    <div class="notebook-grid">
      {#if !searchQuery}
        <div
          class="notebook-wrapper new"
          style="width: 100%;max-width: 11.25ch;"
          style:--delay={'100ms'}
          onclick={async (event) => {
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
          }}
        >
          <div class="notebook-create">
            <Icon name="add" size="1.75rem" />
            <!--<small style="text-align:center;font-size:0.8em;margin-top:0.2em;"
              >Create Notebook</small
            >-->
          </div>
        </div>
      {/if}

      {#if !searchQuery || 'drafts'.includes(searchQuery.trim().toLowerCase())}
        <div
          class="notebook-wrapper"
          style="width: 100%;max-width: 11.25ch;"
          style:--delay={'100ms'}
          onclick={async (event) => {
            handleNotebookClick('drafts', event)
          }}
        >
          <NotebookCover
            title="Drafts"
            height="17.25ch"
            fontSize="0.85rem"
            color={[
              ['#5d5d62', '5d5d62'],
              ['#2e2f34', '#2e2f34'],
              ['#efefef', '#efefef']
            ]}
            onclick={() => {}}
          />
        </div>
      {/if}

      {#each notebooksList.slice(0, showAll ? Infinity : notebooksList.filter((e) => e.data.pinned).length) as notebook, i (notebook.id + i)}
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
            onpin={() => handlePinNotebook(notebook.id)}
            onunpin={() => handleUnPinNotebook(notebook.id)}
            {@attach contextMenu({
              canOpen: true,
              items: [
                !notebook.data.pinned
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
                /*{
                        type: 'action',
                        text: 'Rename',
                      icon: 'edit',
                        action: () => (isRenamingNotebook = notebook.id)
                      },*/
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

    {#if notebooksList.length > notebooksList.slice(0, showAll ? Infinity : notebooksList.filter((e) => e.data.pinned).length).length}
      <div style="margin-top: 0.75rem;" onclick={() => (showAll = !showAll)}>
        <Button size="md"
          >{#if showAll}Hide{:else}Show All{/if}</Button
        >
      </div>
    {/if}
  {/if}
{:else if activeTab === 'notes'}
  <ul>
    <!-- {#if !searchQuery}
      <NotebookSidebarNoteName onclick={() => handleCreateNote()} />
    {/if} -->

    {#if !notebookId}
      <SurfLoader
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]}
        search={{
          query: searchQuery,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {@render notesList(
            (searchResult ?? resources).slice(0, showAll ? Infinity : 6),
            resources
          )}
        {/snippet}

        {#snippet loading()}
          <div class="loading">
            <Icon name="spinner" />
            <p class="typo-title-sm">Loading…</p>
          </div>
        {/snippet}
      </SurfLoader>
    {:else if notebookId === 'drafts'}
      <SurfLoader
        excludeWithinSpaces
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]}
        search={{
          query: $ttyQuery,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {@render notesList(
            (searchResult ?? resources).slice(0, showAll ? Infinity : 6),
            resources
          )}
        {/snippet}

        {#snippet loading()}
          <div class="loading">
            <Icon name="spinner" />
            <p class="typo-title-sm">Loading…</p>
          </div>
        {/snippet}
      </SurfLoader>
    {:else}
      <NotebookLoader
        {notebookId}
        search={{
          query: $ttyQuery,
          parameters: {
            semanticSearch: false
          }
        }}
        fetchContents
      >
        {#snippet children([notebook, searchResult, searching])}
          {@render notesList(
            filterNoteResources(notebook?.contents ?? [], searchResult).map((e) => e.entry_id),
            filterNoteResources(notebook?.contents ?? [], searchResult).map((e) => e.entry_id)
          )}
        {/snippet}

        {#snippet loading()}
          <div class="loading">
            <Icon name="spinner" />
            <p class="typo-title-sm">Loading…</p>
          </div>
        {/snippet}
      </NotebookLoader>
    {/if}
  </ul>
{:else if activeTab === 'sources'}
  <!-- {#if !searchQuery}
    <NotebookSidebarNoteName fallbackIcon="folder.open" fallbackText="Import Local Files" onclick={() => handleUploadFiles()} />
  {/if} -->

  {#if !notebookId}
    <SurfLoader
      tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')]}
      search={{
        query: searchQuery,
        tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')],
        parameters: {
          semanticSearch: false
        }
      }}
    >
      {#snippet children([resources, searchResult, searching])}
        {@render sourcesList(
          (searchResult ?? resources).slice(
            0,
            searchResult ? Infinity : showAll ? Infinity : resourceRenderCnt
          ),
          resources
        )}
      {/snippet}

      {#snippet loading()}
        <div class="loading">
          <Icon name="spinner" />
          <p class="typo-title-sm">Loading…</p>
        </div>
      {/snippet}
    </SurfLoader>
  {:else if notebookId === 'drafts'}
    <SurfLoader
      excludeWithinSpaces
      tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')]}
      search={{
        query: $ttyQuery,
        tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')],
        parameters: {
          semanticSearch: false
        }
      }}
    >
      {#snippet children([resources, searchResult, searching])}
        {@render sourcesList(
          (searchResult ?? resources).slice(
            0,
            searchResult ? Infinity : showAll ? Infinity : resourceRenderCnt
          ),
          resources
        )}
      {/snippet}

      {#snippet loading()}
        <div class="loading">
          <Icon name="spinner" />
          <p class="typo-title-sm">Loading…</p>
        </div>
      {/snippet}
    </SurfLoader>
  {:else}
    <NotebookLoader
      {notebookId}
      search={{
        query: $ttyQuery,
        parameters: {
          semanticSearch: false
        }
      }}
      fetchContents
    >
      {#snippet children([notebook, searchResult, searching])}
        {@render sourcesList(
          filterOtherResources(notebook?.contents ?? [], searchResult)
            .slice(0, resourceRenderCnt)
            .map((e) => e.entry_id),
          filterOtherResources(notebook?.contents ?? [], searchResult).map((e) => e.entry_id)
        )}
      {/snippet}

      {#snippet loading()}
        <div class="loading">
          <Icon name="spinner" />
          <p class="typo-title-sm">Loading…</p>
        </div>
      {/snippet}
    </NotebookLoader>
  {/if}
{/if}

<style lang="scss">
  header {
    margin-bottom: 1rem;
    margin-inline: -0.25rem;
    padding-bottom: 0.75rem;
  }

  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1rem;

    display: flex;
    flex-wrap: wrap;
    //justify-content: space-between;
    justify-items: center;
  }

  .notebook-create {
    margin-left: 0.2rem;
    height: 100%;
    --color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.3));
    border: 1px dashed var(--color);
    border-radius: 12px;
    background: light-dark(rgba(0, 0, 0, 0.015), rgba(255, 255, 255, 0.02));

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: var(--color);

    transition: transform 123ms ease-out;

    > span {
      font-size: 0.9rem;
      text-align: center;
    }

    &:hover {
      transform: scale(1.025) rotate3d(1, 2, 4, 1.5deg);
    }
  }
  .notebook-wrapper.new {
    padding: 0.5rem 0.25rem;
  }

  .sources-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .empty,
  .loading {
    width: 100%;
    border: 1px dashed light-dark(rgba(0, 0, 0, 0.2), rgba(71, 85, 105, 0.4));
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    gap: 0.5rem;
    color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.3));
    text-align: center;
    text-wrap: pretty;

    h1 {
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

  .empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .import-btn {
    --color-link: light-dark(rgba(96, 117, 241, 1), rgba(129, 146, 255, 1));
    --color-link-muted: light-dark(rgba(96, 117, 241, 0.6), rgba(129, 146, 255, 0.6));
    --color-link-hover: light-dark(rgb(125, 143, 243), rgb(150, 165, 255));

    background: none;
    border: none;
    padding: 0;

    font-weight: normal;
    letter-spacing: 0.02em;
    color: var(--color-link);
    text-decoration: underline;

    text-decoration-thickness: 1.25px;
    text-decoration-color: var(--color-link-muted);
    text-underline-offset: 2px;
    text-decoration-style: dashed;

    spellcheck: false;

    &:hover {
      color: var(--color-link-hover);
    }
  }

  :global(.add-btn[data-button-root]) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.33rem 0.25rem 0.5rem;
    font-size: 0.9rem;
    opacity: 0.5;

    &:hover {
      opacity: 0.5 !important;
    }
  }
</style>
