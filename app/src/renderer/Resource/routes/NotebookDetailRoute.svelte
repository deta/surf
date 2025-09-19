<script lang="ts">
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { type Notebook } from '@deta/services/notebook'
  import { Button, PageMention, NotebookLoader } from '@deta/ui'
  import TeletypeEntry from '../../Core/components/Teletype/TeletypeEntry.svelte'
  import { ResourceLoader } from '@deta/ui'
  import { type ResourceSearchResult } from '@deta/services/resources'
  import type { NotebookEntry, Option } from '@deta/types'
  import { ResourceTypes, SpaceEntryOrigin } from '@deta/types'
  import { SearchResourceTags, useDebounce, useLogScope, wait } from '@deta/utils'
  import { onMount } from 'svelte'
  import { get, writable } from 'svelte/store'
  import { type MessagePortClient } from '@deta/services/messagePort'
  import { handleResourceClick, openResource } from '../handlers/notebookOpenHandlers'
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { type RouteResult } from '@mateothegreat/svelte5-router'
  import { useTelemetry } from '@deta/services'
  import NotebookSidebar from '../components/notebook/NotebookSidebar.svelte'
  import NotebookLayout from '../layouts/NotebookLayout.svelte'

  let {
    route,
    messagePort,
    resourcesPanelOpen = false
  }: {
    route: RouteResult
    messagePort: MessagePortClient
    resourcesPanelOpen?: boolean
  } = $props()

  const notebookId = (route.result.path.params as any).notebookId as string

  const log = useLogScope('NotebookDetailRoute')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const telemetry = useTelemetry()

  let showAllNotes = $state(false)
  let isRenamingNote = $state(null)
  let notebook: Notebook = $state(null)
  let notebookData = $derived(notebook.data ?? writable(null))

  let title = $derived(notebook?.nameValue ?? 'Notebook')

  const handleCreateNote = async () => {
    const note = await resourceManager.createResourceNote(
      '',
      {
        name: 'Untitled Note'
      },
      undefined,
      true
    )
    await notebookManager.addResourcesToNotebook(
      notebookId,
      [note.id],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )

    openResource(note.id, { target: 'active_tab' })
  }

  const handleRenameNote = useDebounce((noteId: string, value: string) => {
    resourceManager.updateResourceMetadata(noteId, { name: value })
  }, 75)

  const handleCancelRenameNote = useDebounce(() => {
    isRenamingNote = undefined
  }, 75)

  const filterNoteResources = (
    resources: NotebookEntry[],
    searchResults: Option<ResourceSearchResult>
  ) => {
    if (searchResults) {
      return searchResults.resources.filter(
        (e) => e.resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE
      )
    } else return resources.filter((e) => e.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE)
  }

  onMount(async () => {
    if (notebookId) {
      // NOTE: Ideally messagePort events optionally get queued up until connection established
      wait(100).then(() => telemetry.trackNotebookOpen())
      notebook = await notebookManager.getNotebook(notebookId)
    } else {
      notebook = notebookId
    }
  })
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<!--<svelte:head>
  <title
    >{`${$notebookData.emoji ? $notebookData.emoji + ' ' : ''}${$notebookData.folderName ?? $notebookData.name}`}</title
  >
</svelte:head>-->

<NotebookLayout>
  <NotebookLoader
    {notebookId}
    search={{
      query: '',
      tags: [
        SearchResourceTags.Deleted(false),
        SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne'),
        SearchResourceTags.NotExists('silent')
      ]
    }}
    fetchContents
  >
    {#snippet loading()}
      loading
    {/snippet}

    {#snippet children([notebook, _])}
      <main>
        <div class="tty-wrapper">
          <h1>
            {notebook.nameValue}
          </h1>
          <TeletypeEntry open={true} />
        </div>

        <section class="notes">
          <header>
            <label>Latest Notes</label>

            <Button size="md" onclick={handleCreateNote}>
              <Icon name="add" size="0.95rem" />
              <span class="typo-title-sm" style="opacity: 0.75;">Create Note</span>
            </Button>
            <!--<Button size="md" onclick={handleCreateNote}>
              <span class="typo-title-sm" style="opacity: 0.75;">View all Notes</span>
            </Button>-->
          </header>
          {#if filterNoteResources(notebook.contents, undefined).length <= 0}
            <div class="empty">
              <Button size="md" onclick={handleCreateNote}>
                <span class="typo-title-sm">Create New Note</span>
              </Button>
              <p class="typo-title-sm">You can also create notes through Teletype.</p>
            </div>
          {:else}
            <ul
              class:showAllNotes={filterNoteResources(notebook.contents, undefined).length <= 5 ||
                showAllNotes}
            >
              {#each filterNoteResources(notebook.contents, undefined).slice(0, showAllNotes ? Infinity : 7) as { entry_id: resourceId } (resourceId)}
                <ResourceLoader resource={resourceId}>
                  {#snippet loading()}
                    loading
                  {/snippet}
                  {#snippet children(resource: Resource)}
                    <li>
                      <PageMention
                        sourceNotebookId={notebookId}
                        {resource}
                        editing={isRenamingNote === resourceId}
                        onchange={(v) => {
                          handleRenameNote(resourceId, v)
                          isRenamingNote = undefined
                        }}
                        oncancel={handleCancelRenameNote}
                        onclick={async (e) => {
                          if (isRenamingNote) return
                          handleResourceClick(resourceId, e)
                        }}
                        onrename={() => (isRenamingNote = resourceId)}
                      />
                    </li>
                  {/snippet}
                </ResourceLoader>
              {/each}
            </ul>
          {/if}
          {#if filterNoteResources(notebook.contents, undefined).length > 5}
            <Button size="md" onclick={() => (showAllNotes = !showAllNotes)}>
              <span class="more"
                >{#if !showAllNotes}Show {filterNoteResources(notebook.contents, undefined).length -
                    6} more{:else}Hide{/if}</span
              >
            </Button>{/if}
        </section>
      </main>
    {/snippet}
  </NotebookLoader>

  <NotebookSidebar {title} {notebookId} bind:open={resourcesPanelOpen} />
</NotebookLayout>

<style lang="scss">
  main {
    width: 100%;
    height: 100%;
    max-width: 680px;
    margin: 0 auto;

    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  section {
    padding-inline: 12px;

    opacity: 1;
    transform: translateY(0px);
    transition:
      opacity 223ms ease-out,
      transform 223ms ease-out;
    transition-delay: var(--delay, 0ms);
    @starting-style {
      transform: translateY(2px);
      opacity: 0;
    }

    > header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;

      > label {
        opacity: 0.5;
        color: var(--text-color);
        leading-trim: both;
        text-edge: cap;
        font-family: Inter;
        font-size: 0.75rem;
        font-style: normal;
        font-weight: 500;
        line-height: 0.9355rem;
      }
    }
  }

  section.notes {
    ul {
      position: relative;

      &:not(.showAllNotes) {
        mask-image: linear-gradient(to bottom, black 40%, transparent 83%);
      }
    }
    .more {
      opacity: 0.5;
      &:hover {
        opacity: 1;
      }
    }
  }

  .empty {
    width: 100%;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.25);
    text-align: center;
    text-wrap: pretty;
    p {
      max-width: 28ch;
    }

    :global(button) {
      margin-bottom: 0.5rem;
      color: var(--accent);
      background: rgb(198 206 249 / 40%);
    }
  }

  .tty-wrapper {
    width: 100%;

    h1 {
      font-size: 30px;
      margin-bottom: 0.75rem;
      font-family: 'Gambarino';
      text-align: center;
    }
  }

  //.cover.title {
  //  display: none;
  //}

  //@media screen and (width <= 1200px) {
  //  .cover.side {
  //    display: none;
  //  }
  //  .cover.title {
  //    display: block;
  //  }
  //}
</style>
