<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, contextMenu, LazyScroll, MaskedScroll, openDialog } from '@deta/ui'
  import SourceCard from './SourceCard.svelte'
  import { ResourceTypes } from '@deta/types'
  import { type Notebook } from '@deta/services/notebook'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { SearchResourceTags, truncate, useDebounce, useThrottle } from '@deta/utils'
  import type { ResourceNote } from '@deta/services/resources'
  import NotebookCard from './NotebookCard.svelte'
  import NotebookSidebarSection from './NotebookSidebarSection.svelte'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { get, writable } from 'svelte/store'
  import { onMount } from 'svelte'
  import NotebookSidebarNoteName from './NotebookSidebarNoteName.svelte'

  let {
    notebook,
    title,
    open = $bindable(),
    query
  }: {
    notebook?: Notebook
    title: string
    open: boolean
    query: string | null
  } = $props()

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const sortedNotebooksList = $derived(notebookManager.sortedNotebooksList)
  const notebooksList = $derived(
    $sortedNotebooksList.toReversed().filter((e) => {
      if (!query) return true
      return (e.dataValue.folderName ?? e.dataValue.name)
        .toLowerCase()
        .includes(query.toLowerCase())
    })
  )

  const notebookData = $derived(notebook?.data ?? writable(null))

  let noteResources = $state([])
  let noneNotesResources = $state([])
  let resourceRenderCnt = $state(20)
  $effect(() => {
    if (!open) resourceRenderCnt = 20
  })

  let isRenamingNotebook: string | undefined = $state(undefined)

  const handleDeleteNote = async (noteId: string) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate('Note', 26)}</i>`, // note.metadata.name
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    //await notebook.removeResources(note.id)
    await resourceManager.deleteResource(noteId)
  }

  const handleCreateNotebook = async () => {
    //if (newNotebookName === undefined || newNotebookName.length < 1) {
    //  isCreatingNotebook = false
    //  newNotebookName = undefined
    //  return
    //}

    await notebookManager.createNotebook({
      name: 'Untitled Notebook'
    })

    //isCreatingNotebook = false
    //newNotebookName = undefined
    notebookManager.loadNotebooks()
  }

  const handleDeleteNotebook = async (notebook: Notebook) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(notebook.dataValue.folderName ?? notebook.dataValue.name, 26)}</i>`,
      message: `This can't be undone. <br>Your resources won't be deleted.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteNotebook(notebook.id)
  }

  const handleRenameNotebook = useDebounce((notebookId: string, value: string) => {
    notebookManager.updateNotebookData(notebookId, { name: value })
  }, 175)

  const handleCancelRenameNotebook = () => {
    isRenamingNotebook = undefined
  }

  const handlePinNotebook = (notebookId: string) => {}
  const handleUnPinNotebook = (notebookId: string) => {}

  const handleMediaWheel = useThrottle(() => {
    if (resourceRenderCnt > noneNotesResources.length) return
    resourceRenderCnt += 1
  }, 5)

  const fetchContents = async (query: string | null) => {
    if (query) {
      const resultNotes = await resourceManager.searchResources(
        query,
        [
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent'),
          SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          //...hashtags.map((x) => SearchResourceTags.Hashtag(x)),
          //...conditionalArrayItem(isNotesSpace, [
          //  SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          //])
        ],
        {
          semanticEnabled: false,
          spaceId: notebook?.id ?? undefined
        }
      )
      const resultNoneNotes = await resourceManager.searchResources(
        query,
        [
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent'),
          SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')
          //...hashtags.map((x) => SearchResourceTags.Hashtag(x)),
          //...conditionalArrayItem(isNotesSpace, [
          //  SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          //])
        ],
        {
          semanticEnabled: false,
          spaceId: notebook?.id ?? undefined
        }
      )
      noteResources = resultNotes.resources.map((e) => e.id)
      noneNotesResources = resultNoneNotes.resources.map((e) => e.id)
    } else {
      if (notebook) {
        const results = await notebook.fetchContents()

        const resultNotes = get(notebook.contents)
          .filter((e) => e.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE)
          .map((e) => e.entry_id)
        const resultNoneNotes = get(notebook.contents)
          .filter((e) => e.resource_type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
          .map((e) => e.entry_id)
        noteResources = resultNotes
        noneNotesResources = resultNoneNotes
      } else {
        const resultNotes = await resourceManager.listResourceIDsByTags([
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent'),
          SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
        ])
        const resultNoneNotes = await resourceManager.listResourceIDsByTags([
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent'),
          SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')
        ])
        noteResources = resultNotes
        noneNotesResources = resultNoneNotes
      }
    }
  }

  $effect(() => fetchContents(query))

  onMount(async () => {
    fetchContents(query)
  })
</script>

<aside class:open>
  {#if !open}
    <header class="px pt">
      <Button size="md" onclick={() => (open = true)}>
        <span class="typo-title-sm" style="opacity: 0.5;">Show Sources</span>
        <Icon name="sidebar.right" size="1.2em" />
      </Button>
    </header>
  {:else}
    <header class="px pt">
      <div class="hstack" style="gap: 0.5rem; padding-left:0.5rem;">
        <!--<NotebookCover />-->
        <h1>
          {query
            ? 'Search Results'
            : notebook
              ? ($notebookData.folderName ?? $notebookData.name)
              : title}
        </h1>
      </div>
      <Button size="md" onclick={() => (open = false)}>
        <span class="typo-title-sm" style="opacity: 0.5;">Hide Sources</span>
        <Icon name="sidebar.right" size="1.2em" />
      </Button>
    </header>

    <MaskedScroll --padding={'0.5rem 0.5rem 0rem 0.5rem'}>
      {#if !notebook}
        {#if query === null || query.length <= 0 || (query !== null && query.length > 0 && notebooksList.length > 0)}
          <NotebookSidebarSection
            title="Notebooks"
            class="notebooks"
            open={query !== null && query.length > 0}
          >
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
                    text={notebook.dataValue.folderName ?? notebook.dataValue.name}
                    size={10}
                    editing={isRenamingNotebook === notebook.id}
                    onclick={async () => {
                      await navigation.navigate(`surf://notebook/${notebook.id}`).finished
                    }}
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

      {#if query === null || query.length <= 0 || (query !== null && query.length > 0 && noteResources.length > 0)}
        <NotebookSidebarSection
          title="Notes"
          class="chapters"
          open={query !== null && query.length > 0}
        >
          <ul>
            {#each noteResources as resourceId (resourceId)}
              <li
                {@attach contextMenu({
                  canOpen: true,
                  items: [
                    {
                      type: 'action',
                      kind: 'danger',
                      text: 'Delete',
                      icon: 'trash',
                      action: () => handleDeleteNote(resourceId)
                    }
                  ]
                })}
                onclick={async () => {
                  await navigation.navigate(`surf://resource/${resourceId}`).finished
                }}
              >
                <span><NotebookSidebarNoteName {resourceId} /></span>
              </li>
            {/each}
          </ul>
        </NotebookSidebarSection>
      {/if}

      {#if query === null || query.length <= 0 || (query !== null && query.length > 0 && noneNotesResources.length > 0)}
        <NotebookSidebarSection title="Media" class="sources" open>
          {#if noneNotesResources.length <= 0}
            <div class="px py">
              <div class="empty">
                <p class="typo-title-sm">Save webpages or drop in files to add to this notebook.</p>
              </div>
            </div>
          {:else}
            <div class="sources-grid" onwheel={handleMediaWheel}>
              {#each noneNotesResources.slice(0, resourceRenderCnt) as resourceId (resourceId)}
                <SourceCard --width={'5rem'} --max-width={''} {resourceId} text />
              {/each}
            </div>
            {#if resourceRenderCnt < noneNotesResources.length}
              <div style="text-align:center;width:100%;margin-top:1rem;">
                <span class="typo-title-sm" style="opacity: 0.5;">Scroll to load more</span>
              </div>
            {/if}
          {/if}
        </NotebookSidebarSection>
      {/if}
    </MaskedScroll>
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
    ul {
      li {
        padding: 0.5em;
        border-radius: 8px;
        overflow: hidden;

        &:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        span {
          //display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
          overflow: hidden;
          leading-trim: both;
          text-edge: cap;
          text-overflow: ellipsis;
          font-family: Inter;
          font-style: normal;
          font-weight: 400;
          line-height: 0.9355rem; /* 106.916% */

          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;

          &:not(.active) {
            opacity: 0.5;
          }
        }
      }
    }
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
