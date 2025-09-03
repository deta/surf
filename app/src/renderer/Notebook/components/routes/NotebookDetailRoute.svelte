<script lang="ts">
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { openDialog } from '@deta/ui'
  import { type Notebook } from '@deta/services/notebook'
  import { Button, PageMention } from '@deta/ui'
  import TeletypeEntry from '../../../Core/components/Teletype/TeletypeEntry.svelte'
  import { contextMenu } from '@deta/ui'
  import { truncate, useDebounce } from '@deta/utils'
  import { type ResourceNote } from '@deta/services/src/lib/resources'
  import { ResourceTypes } from '@deta/types'

  let {
    notebook,
    resources,
    query
  }: { notebook: Notebook; resources: Resource[]; query?: string } = $props()

  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()
  let showAllNotes = $state(query !== null)
  let isRenamingNote = $state(null)

  const resourcesNotes = $derived(
    resources.filter((e) => e.type === ResourceTypes.DOCUMENT_SPACE_NOTE)
  )
  // const resourcesNotNotes = $derived(
  //   resources.filter((e) => e.type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
  // )

  const notebookData = notebook.data

  //const handleCreateNote = async () => {
  //  const note = await resourceManager.createResourceNote('', {
  //    name: 'Untitled Note'
  //  })
  //  notebookManager.addResourcesToNotebook(notebook.id, [note.id], 1)
  //  await navigation.navigate(`surf://resource/${note.id}`).finished
  //}

  const handleDeleteNote = async (note: ResourceNote) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(note.metadata.name, 26)}</i>`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    await notebook.removeResources(note.id)
    await resourceManager.deleteResource(note.id)
  }

  const handleRenameNote = useDebounce((noteId: string, value: string) => {
    resourceManager.updateResourceMetadata(noteId, { name: value })
  }, 75)

  const handleCancelRenameNote = useDebounce(() => {
    isRenamingNote = undefined
  }, 75)
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
        size="md"
        onclick={() => (showAllNotes = !showAllNotes)}
        disabled={resourcesNotes.length <= 6}
      >
        <span class="typo-title-sm" style="opacity: 0.75;"
          >{showAllNotes ? 'Hide' : 'Show'} All</span
        >
      </Button>
    </header>
    {#if resourcesNotes.length <= 0}
      <div class="empty">
        <p class="typo-title-sm">
          Create notes through Teletype for them to appear in this Notebook.
        </p>
      </div>
    {:else}
      <ul class:showAllNotes={showAllNotes || resourcesNotes?.length <= 6}>
        {#each resourcesNotes.slice(0, showAllNotes ? Infinity : 7) as note}
          <li
            use:contextMenu={{
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
                  action: () => (isRenamingNote = note.id)
                },
                {
                  type: 'action',
                  kind: 'danger',
                  text: 'Delete',
                  icon: 'trash',
                  action: () => handleDeleteNote(note)
                }
              ]
            }}
          >
            <PageMention
              editing={isRenamingNote === note.id}
              text={note.metadata.name}
              onchange={(v) => {
                handleRenameNote(note.id, v)
                isRenamingNote = undefined
              }}
              oncancel={handleCancelRenameNote()}
              onclick={async () => {
                if (isRenamingNote) return
                await navigation.navigate(`surf://resource/${note.id}`).finished
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
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.25);
    text-align: center;
    text-wrap: pretty;
    p {
      max-width: 28ch;
    }
  }

  .tty-wrapper {
    //position: fixed;
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
