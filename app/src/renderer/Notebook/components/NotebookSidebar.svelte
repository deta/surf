<script lang="ts">
  import { Icon } from '@deta/icons'
  import {
    Button,
    contextMenu,
    LazyScroll,
    MaskedScroll,
    openDialog,
    ResourceLoader,
    SearchInput
  } from '@deta/ui'
  import SourceCard from './SourceCard.svelte'
  import { type NotebookEntry, ResourceTypes, type Option } from '@deta/types'
  import { NotebookLoader, SurfLoader } from '@deta/ui'
  import { type Notebook } from '@deta/services/notebook'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { SearchResourceTags, truncate, useDebounce, useThrottle } from '@deta/utils'
  import type { ResourceNote, ResourceSearchResult } from '@deta/services/resources'
  import NotebookCard from './NotebookCard.svelte'
  import NotebookSidebarSection from './NotebookSidebarSection.svelte'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { get, writable } from 'svelte/store'
  import { onMount } from 'svelte'
  import NotebookSidebarNoteName from './NotebookSidebarNoteName.svelte'
  import { handleNotebookClick, handleResourceClick } from '../handlers/notebookOpenHandlers'

  let {
    notebookId,
    title,
    open = $bindable(),
    query,
    onquerychange
  }: {
    notebookId?: string
    title: string
    open: boolean
    query: string | null
    onquerychange: (v: string) => void
  } = $props()

  const notebookManager = useNotebookManager()
  const notebooksList = $derived(
    notebookManager.sortedNotebooks
      .filter((e) => {
        if (!query) return true
        return e.nameValue.toLowerCase().includes(query.toLowerCase())
      })
      .sort((a, b) => (b.data.pinned === true) - (a.data.pinned === true))
  )

  // TODO: Make this conversion more sane and put it in a generalized place!
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

  // TODO: put this in lazy scroll component
  let resourceRenderCnt = $state(20)
  $effect(() => {
    if (!open) resourceRenderCnt = 20
  })
  // TODO: Put this into lazy scroll component, no need for rawdogging crude js
  const handleMediaWheel = useThrottle(() => {
    resourceRenderCnt += 4
  }, 5)

  let isRenamingNotebook: string | undefined = $state(undefined)

  const handleCreateNotebook = async () => {
    //if (newNotebookName === undefined || newNotebookName.length < 1) {
    //  isCreatingNotebook = false
    //  newNotebookName = undefined
    //  return
    //}

    await notebookManager.createNotebook(
      {
        name: 'Untitled Notebook'
      },
      true
    )

    //isCreatingNotebook = false
    //newNotebookName = undefined
    notebookManager.loadNotebooks()
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

  const handleRenameNotebook = useDebounce((notebookId: string, value: string) => {
    notebookManager.updateNotebookData(notebookId, { name: value })
  }, 175)

  const handleCancelRenameNotebook = () => {
    isRenamingNotebook = undefined
  }

  const handlePinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: true })
  }
  const handleUnPinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: false })
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
    notebookManager.removeResources(resource.id, notebookId ?? undefined, true)
  }
</script>

<aside class:open>
  {#if !open}
    <header class="px pt">
      <Button size="md" onclick={() => (open = true)}>
        <span class="typo-title-sm" style="opacity: 0.5;">Show Sources</span>
      </Button>
    </header>
  {:else if notebookId === 'drafts'}
    <header class="px pt">
      <div class="hstack" style="gap: 0.5rem; padding-left:0.5rem;">
        <h1>
          {query ? 'Search Results' : 'Drafts'}
        </h1>
      </div>
      <div class="hstack" style="gap: 0.5rem;">
        <SearchInput onsearchinput={(v) => onquerychange(v)} autofocus />
        <Button size="md" onclick={() => (open = false)}>
          <span class="typo-title-sm" style="opacity: 0.5;">Hide Sources</span>
        </Button>
      </div>
    </header>

    <MaskedScroll --padding={'0.5rem 0.5rem 0rem 0.5rem'}>
      <SurfLoader
        excludeWithinSpaces
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]}
        search={{
          query,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {#if !query || (searchResult ?? resources).length > 0}
            <NotebookSidebarSection title="Notes" class="chapters" open={query}>
              <ul>
                {#each searchResult ?? resources as resource (resource.id)}
                  <ResourceLoader {resource}>
                    {#snippet children(resource: Resource)}
                      <NotebookSidebarNoteName {resource} />
                    {/snippet}
                  </ResourceLoader>
                {/each}
              </ul>
            </NotebookSidebarSection>
          {/if}
        {/snippet}
      </SurfLoader>

      <SurfLoader
        excludeWithinSpaces
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')]}
        search={{
          query,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {#if !query || (searchResult ?? resources).length > 0}
            <NotebookSidebarSection title="Media" class="sources" open>
              {#if (searchResult ?? resources).length <= 0}
                <div class="px py">
                  <div class="empty">
                    <p class="typo-title-sm">
                      Save webpages or drop in files to add to this notebook.
                    </p>
                  </div>
                </div>
              {:else}
                <div class="sources-grid" onwheel={handleMediaWheel}>
                  {#each (searchResult ?? resources).slice(0, searchResult ? Infinity : resourceRenderCnt) as resource (resource.id)}
                    <ResourceLoader {resource}>
                      {#snippet children(resource: Resource)}
                        <SourceCard
                          --width={'5rem'}
                          --max-width={''}
                          {resource}
                          text
                          {onDeleteResource}
                        />
                      {/snippet}
                    </ResourceLoader>
                  {/each}
                </div>
                {#if resourceRenderCnt < (searchResult ?? resources).length}
                  <div style="text-align:center;width:100%;margin-top:1rem;">
                    <span class="typo-title-sm" style="opacity: 0.5;">Scroll to load more</span>
                  </div>
                {/if}
              {/if}
            </NotebookSidebarSection>
          {/if}
        {/snippet}
      </SurfLoader>
    </MaskedScroll>
  {:else if !notebookId}
    <header class="px pt">
      <div class="hstack" style="gap: 0.5rem; padding-left:0.5rem;">
        <!--<NotebookCover />-->

        <h1>
          {query ? 'Search Results' : 'Surf'}
        </h1>
      </div>
      <div class="hstack" style="gap: 0.5rem;">
        <SearchInput onsearchinput={(v) => onquerychange(v)} autofocus />
        <Button size="md" onclick={() => (open = false)}>
          <span class="typo-title-sm" style="opacity: 0.5;">Hide Sources</span>
        </Button>
      </div>
    </header>

    <MaskedScroll --padding={'0.5rem 0.5rem 0rem 0.5rem'}>
      {#if !query || (query !== null && query.length > 0 && notebooksList.length > 0)}
        <NotebookSidebarSection title="Notebooks" class="notebooks" open={query}>
          <div class="notebook-grid">
            <div
              class="notebook-wrapper"
              style="width: 100%;max-width: 12ch;"
              style:--delay={'100ms'}
              onclick={async (event) => {
                open = false
                handleNotebookClick('drafts', event)
              }}
            >
              <NotebookCard title="Drafts" size={12} color={['#232323', 'green']} />
            </div>
            {#each notebooksList as notebook, i (notebook.id)}
              <div
                class="notebook-wrapper"
                style="width: 100%;max-width: 12ch;"
                style:--delay={100 + i * 10 + 'ms'}
                {@attach contextMenu({
                  canOpen: true,
                  items: [
                    !notebook.data.pinned
                      ? {
                          type: 'action',
                          text: 'Pin',
                          icon: 'pin',
                          action: () => handlePinNotebook(notebook.id)
                        }
                      : {
                          type: 'action',
                          text: 'Unpin',
                          icon: 'pin',
                          action: () => handleUnPinNotebook(notebook.id)
                        },
                    {
                      type: 'action',
                      text: 'Rename',
                      icon: 'edit',
                      action: () => (isRenamingNotebook = notebook.id)
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
              >
                <NotebookCard
                  {notebook}
                  text={notebook.nameValue}
                  size={12}
                  editing={isRenamingNotebook === notebook.id}
                  onclick={(e) => handleNotebookClick(notebook.id, e)}
                  onchange={(v) => {
                    handleRenameNotebook(notebook.id, v)
                    isRenamingNotebook = undefined
                  }}
                  oncancel={handleCancelRenameNotebook}
                />
              </div>
            {/each}
          </div>
        </NotebookSidebarSection>
      {/if}

      <SurfLoader
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]}
        search={{
          query,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {#if !query || (searchResult ?? resources).length > 0}
            <NotebookSidebarSection title="Notes" class="chapters" open={query}>
              <ul>
                {#each searchResult ?? resources as resource (resource.id)}
                  <ResourceLoader {resource}>
                    {#snippet children(resource: Resource)}
                      <NotebookSidebarNoteName {resource} />
                    {/snippet}
                  </ResourceLoader>
                {/each}
              </ul>
            </NotebookSidebarSection>
          {/if}
        {/snippet}
      </SurfLoader>

      <SurfLoader
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')]}
        search={{
          query,
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          {#if !query || (searchResult ?? resources).length > 0}
            <NotebookSidebarSection title="Media" class="sources" open>
              {#if (searchResult ?? resources).length <= 0}
                <div class="px py">
                  <div class="empty">
                    <p class="typo-title-sm">
                      Save webpages or drop in files to add to this notebook.
                    </p>
                  </div>
                </div>
              {:else}
                <div class="sources-grid" onwheel={handleMediaWheel}>
                  {#each (searchResult ?? resources).slice(0, searchResult ? Infinity : resourceRenderCnt) as resource (resource.id)}
                    <ResourceLoader {resource}>
                      {#snippet children(resource: Resource)}
                        <SourceCard
                          --width={'5rem'}
                          --max-width={''}
                          {resource}
                          text
                          {onDeleteResource}
                        />
                      {/snippet}
                    </ResourceLoader>
                  {/each}
                </div>
                {#if resourceRenderCnt < (searchResult ?? resources).length}
                  <div style="text-align:center;width:100%;margin-top:1rem;">
                    <span class="typo-title-sm" style="opacity: 0.5;">Scroll to load more</span>
                  </div>
                {/if}
              {/if}
            </NotebookSidebarSection>
          {/if}
        {/snippet}
      </SurfLoader>
    </MaskedScroll>
  {:else}
    <NotebookLoader
      {notebookId}
      search={{
        query,
        parameters: {
          semanticSearch: false
        }
      }}
      fetchContents
    >
      {#snippet children([notebook, searchResult, searching])}
        <header class="px pt">
          <div class="hstack" style="gap: 0.5rem; padding-left:0.5rem;">
            <!--<NotebookCover />-->

            <h1>
              {query ? 'Search Results' : notebook ? notebook.nameValue : title}
            </h1>
          </div>
          <div class="hstack" style="gap: 0.5rem;">
            <SearchInput onsearchinput={(v) => onquerychange(v)} autofocus />
            <Button size="md" onclick={() => (open = false)}>
              <span class="typo-title-sm" style="opacity: 0.5;">Hide Sources</span>
            </Button>
          </div>
        </header>

        <MaskedScroll --padding={'0.5rem 0.5rem 0rem 0.5rem'}>
          {#if !notebookId}
            {#if !query || (query !== null && query.length > 0 && notebooksList.length > 0)}
              <NotebookSidebarSection title="Notebooks" class="notebooks" open={query}>
                <div class="notebook-grid">
                  {#each notebooksList as notebook, i (notebook.id)}
                    <div
                      class="notebook-wrapper"
                      style="width: 100%;max-width: 10ch;"
                      style:--delay={100 + i * 10 + 'ms'}
                      {@attach contextMenu({
                        canOpen: true,
                        items: [
                          {
                            type: 'action',
                            text: 'Pin',
                            icon: 'pin',
                            action: () => handlePinNotebook(notebook.id)
                          },
                          {
                            type: 'action',
                            text: 'Rename',
                            icon: 'edit',
                            action: () => (isRenamingNotebook = notebook.id)
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
                    >
                      <NotebookCard
                        {notebook}
                        text={notebook.nameValue}
                        size={10}
                        editing={isRenamingNotebook === notebook.id}
                        onclick={(e) => handleNotebookClick(notebook.id, e)}
                        onchange={(v) => {
                          handleRenameNotebook(notebook.id, v)
                          isRenamingNotebook = undefined
                        }}
                        oncancel={handleCancelRenameNotebook}
                      />
                    </div>
                  {/each}
                </div>
              </NotebookSidebarSection>
            {/if}
          {/if}

          {#if !query || filterNoteResources(notebook.contents, searchResult).length > 0}
            <NotebookSidebarSection title="Notes" class="chapters" open={query}>
              <ul>
                {#each filterNoteResources(notebook.contents, searchResult) as { entry_id: resourceId } (resourceId)}
                  <ResourceLoader resource={resourceId}>
                    {#snippet children(resource: Resource)}
                      <NotebookSidebarNoteName {resource} sourceNotebookId={notebook.id} />
                    {/snippet}
                  </ResourceLoader>
                {/each}
              </ul>
            </NotebookSidebarSection>
          {/if}

          {#if !query || filterOtherResources(notebook.contents, searchResult).length > 0}
            <NotebookSidebarSection title="Media" class="sources" open>
              {#if filterOtherResources(notebook.contents, searchResult).length <= 0}
                <div class="px py">
                  <div class="empty">
                    <p class="typo-title-sm">
                      Save webpages or drop in files to add to this notebook.
                    </p>
                  </div>
                </div>
              {:else}
                <div class="sources-grid" onwheel={handleMediaWheel}>
                  {#each filterOtherResources(notebook.contents, searchResult).slice(0, resourceRenderCnt) as { entry_id: resourceId } (resourceId)}
                    <ResourceLoader resource={resourceId}>
                      {#snippet children(resource: Resource)}
                        <SourceCard
                          --width={'5rem'}
                          --max-width={''}
                          {resource}
                          text
                          {onDeleteResource}
                          sourceNotebookId={notebook.id}
                        />
                      {/snippet}
                    </ResourceLoader>
                  {/each}
                </div>
                {#if resourceRenderCnt < filterOtherResources(notebook.contents, searchResult).length}
                  <div style="text-align:center;width:100%;margin-top:1rem;">
                    <span class="typo-title-sm" style="opacity: 0.5;">Scroll to load more</span>
                  </div>
                {/if}
              {/if}
            </NotebookSidebarSection>
          {/if}
        </MaskedScroll>
      {/snippet}
    </NotebookLoader>
  {/if}
</aside>

<style lang="scss">
  @media screen and (max-width: 850px) {
    aside.open {
      width: 100% !important;
    }
  }
  aside {
    position: fixed;
    right: 0;
    top: 0;
    z-index: 100;

    &.open {
      bottom: 0;
      width: var(--sidebar-width);
      background: rgba(250, 250, 250, 1);
      border-left: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: rgba(99, 99, 99, 0.1) 0px 2px 8px 0px;
    }

    display: flex;
    flex-direction: column;

    transition-property: background, border-color;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    > header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h1 {
        font-family: 'Gambarino';
        font-size: 1.1rem;
        letter-spacing: 0.01em;
        line-height: 1.3;

        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
      }
    }

    section {
      display: flex;
      flex-direction: column;
      flex-shrink: 1;
      flex-grow: 1;

      width: 100%;
      height: 100%;

      > header {
        margin-bottom: 0.25rem;

        > label {
          color: var(--text-color);
          leading-trim: both;
          text-edge: cap;
          font-family: Inter;
          font-size: 0.75rem;
          font-style: normal;
          font-weight: 600;
          line-height: 0.9355rem; /* 124.736% */
          opacity: 0.75;
        }
      }

      > details {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;

        > summary {
          list-style: none;
          border-radius: 8px;
          padding: 0.4rem 0.5rem;

          display: flex;
          align-items: center;
          gap: 1rem;
          > hr {
            width: 100%;
          }

          &:hover {
            background: rgba(0, 0, 0, 0.05);
          }

          transition: background 123ms ease-out;

          > label {
            color: var(--text-color);
            leading-trim: both;
            text-edge: cap;
            font-family: Inter;
            font-size: 0.75rem;
            font-style: normal;
            font-weight: 600;
            line-height: 0.9355rem; /* 124.736% */
            opacity: 0.75;
            pointer-events: none;
          }
        }
      }
    }

    section.notebooks {
      .notebook-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
    }

    .hstack {
      display: flex;
      align-items: center;
    }
    .px {
      padding-inline: 12px;
    }
    .py {
      padding-block: 12px;
    }
    .pt {
      padding-top: 12px;
    }
  }

  :global(aside section.notebooks) {
    .notebook-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;

      display: flex;
      flex-wrap: wrap;
      //justify-content: space-between;
      justify-items: center;
    }
  }

  :global(aside section.sources) {
    .sources-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }
  }

  :global(aside section.chapters) {
    font-size: 0.9rem;
  }

  .empty {
    width: 100%;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.25);
    text-align: center;
    text-wrap: pretty;
    p {
      max-width: 28ch;
    }
  }
</style>
