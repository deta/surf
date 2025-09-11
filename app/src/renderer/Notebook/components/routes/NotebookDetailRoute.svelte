<script lang="ts">
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { openDialog } from '@deta/ui'
  import { type Notebook } from '@deta/services/notebook'
  import { Button, PageMention } from '@deta/ui'
  import TeletypeEntry from '../../../Core/components/Teletype/TeletypeEntry.svelte'
  import { contextMenu } from '@deta/ui'
  import { SearchResourceTags, truncate, useDebounce } from '@deta/utils'
  import { type ResourceNote } from '@deta/services/src/lib/resources'
  import { ResourceTypes } from '@deta/types'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { type MessagePortClient } from '@deta/services/messagePort'

  let {
    notebook,
    messagePort,
    query
  }: { notebook: Notebook; messagePort: MessagePortClient; query?: string } = $props()

  const resourceManager = useResourceManager()
  const telemetry = resourceManager.telemetry
  let showAllNotes = $state(query !== null)
  let isRenamingNote = $state(null)

  const notebookData = notebook.data

  let noteResources = $state([])
  let noneNotesResources = $state([])

  const handleCreateNote = async () => {
    await messagePort.createNote.send({ notebookId: notebook.id, isNewTabPage: true })
  }

  const handleDeleteNote = async (noteId: string) => {
    const { closeType: confirmed } = await openDialog({
      //title: `Delete <i>${truncate(note.metadata.name, 26)}</i>`,
      title: `Delete <i>${truncate('Note', 26)}</i>`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    await notebook.removeResources(noteId, true)
    await resourceManager.deleteResource(noteId)
  }

  const handleRenameNote = useDebounce((noteId: string, value: string) => {
    resourceManager.updateResourceMetadata(noteId, { name: value })
  }, 75)

  const handleCancelRenameNote = useDebounce(() => {
    isRenamingNote = undefined
  }, 75)

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
      const results = await notebook.fetchContents()
      const resultNotes = results
        .filter((e) => e.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE)
        .map((e) => e.entry_id)

      const resultNoneNotes = results
        .filter((e) => e.resource_type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
        .map((e) => e.entry_id)

      noteResources = resultNotes
      noneNotesResources = resultNoneNotes
    }
  }

  $effect(() => fetchContents(query))

  onMount(async () => {
    fetchContents(query)
  })
</script>

<svelte:head>
  <title
    >{`${$notebookData.emoji ? $notebookData.emoji + ' ' : ''}${$notebookData.folderName ?? $notebookData.name}`}</title
  >
</svelte:head>

<main>
  <div class="tty-wrapper">
    <h1>
      {`${$notebookData.emoji ? $notebookData.emoji + ' ' : ''}${$notebookData.folderName ?? $notebookData.name}`}
    </h1>
    <TeletypeEntry open={true} />
  </div>
  <section class="notes">
    <header>
      <label>Notes</label>
      <Button
        size="xs"
        onclick={() => (showAllNotes = !showAllNotes)}
        disabled={noteResources.length <= 6}
      >
        <span class="typo-title-sm" style="opacity: 0.75;"
          >{showAllNotes ? 'Hide' : 'Show'} All</span
        >
      </Button>
    </header>
    {#if noteResources.length <= 0}
      <div class="empty">
        <Button size="md" onclick={handleCreateNote}>
          <span class="typo-title-sm">Create New Note</span>
        </Button>
        <p class="typo-title-sm">You can also create notes through Teletype.</p>
      </div>
    {:else}
      <ul class:showAllNotes={showAllNotes || noteResources?.length <= 6}>
        {#each noteResources.slice(0, showAllNotes ? Infinity : 7) as resourceId}
          <li
            {@attach contextMenu({
              canOpen: true,
              items: [
                /*{
            type: 'action',
            text: 'Pin',
            icon: 'pin',
            action: () => {}
          },*/
                {
                  type: 'action',
                  text: 'Rename',
                  icon: 'edit',
                  action: () => (isRenamingNote = resourceId)
                },
                {
                  type: 'action',
                  kind: 'danger',
                  text: 'Delete',
                  icon: 'trash',
                  action: () => handleDeleteNote(resourceId)
                }
              ]
            })}
          >
            <PageMention
              editing={isRenamingNote === resourceId}
              {resourceId}
              onchange={(v) => {
                handleRenameNote(resourceId, v)
                isRenamingNote = undefined
              }}
              oncancel={handleCancelRenameNote()}
              onclick={async () => {
                if (isRenamingNote) return
                await navigation.navigate(`surf://resource/${resourceId}`).finished
              }}
            />
          </li>
        {/each}
      </ul>
    {/if}
    <!--    {#if !showAllNotes}
      <span class="more typo-title-sm">+ {resourcesNotes.length - 6} more</span>
    {/if}-->
  </section>
</main>

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
    //.more {
    //  margin-top: -3rem;
    //  opacity: 0.25;
    //}
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
