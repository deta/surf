<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, openDialog, PageMention, ResourceLoader, SurfLoader } from '@deta/ui'
  import { onMount } from 'svelte'
  import { MaskedScroll } from '@deta/ui'
  import { contextMenu, type CtxItem } from '@deta/ui'
  import TeletypeEntry from '../../Core/components/Teletype/TeletypeEntry.svelte'
  import { SearchResourceTags, truncate, useDebounce } from '@deta/utils'
  import {
    useResourceManager,
    type Resource,
    type ResourceNote,
    ResourceManagerEvents
  } from '@deta/services/resources'
  import { ResourceTagsBuiltInKeys, ResourceTypes } from '@deta/types'
  import { type MessagePortClient } from '@deta/services/messagePort'
  import { handleResourceClick } from '../handlers/notebookOpenHandlers'
  import NotebookSidebar from '../components/notebook/NotebookSidebar.svelte'
  import NotebookLayout from '../layouts/NotebookLayout.svelte'

  let {
    messagePort,
    resourcesPanelOpen = false
  }: { messagePort: MessagePortClient; resourcesPanelOpen?: boolean } = $props()

  const resourceManager = useResourceManager()

  let showAllNotes = $state(false)
  let isRenamingNote = $state(null)

  const handleCreateNote = async () => {
    await messagePort.createNote.send({ isNewTabPage: true })
  }

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

    await resourceManager.deleteResource(note.id)
  }

  const handleRenameNote = useDebounce((noteId: string, value: string) => {
    resourceManager.updateResourceMetadata(noteId, { name: value })
  }, 75)

  const handleCancelRenameNote = useDebounce(() => {
    isRenamingNote = undefined
  }, 75)

  onMount(async () => {
    const unsubs = [resourceManager.on(ResourceManagerEvents.Deleted, () => (refreshKey = {}))]
    return () => unsubs.forEach((f) => f())
  })
</script>

<svelte:head>
  <title>Drafts</title>
</svelte:head>

<NotebookLayout>
  <main>
    <div class="tty-wrapper">
      <h1>Drafts</h1>
      <TeletypeEntry open={true} />
    </div>
    <section class="notes">
      <SurfLoader
        excludeWithinSpaces
        tags={[SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]}
        search={{
          tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')],
          parameters: {
            semanticSearch: false
          }
        }}
      >
        {#snippet children([resources, searchResult, searching])}
          <header>
            <label>Notes</label>
            <Button
              size="md"
              onclick={() => (showAllNotes = !showAllNotes)}
              disabled={(searchResult ?? resources).length <= 6}
            >
              <span class="typo-title-sm" style="opacity: 0.75;"
                >{showAllNotes ? 'Hide' : 'Show'} All</span
              >
            </Button>
          </header>

          {#if (searchResult ?? resources).length > 0}
            <ul class:showAllNotes={showAllNotes || (searchResult ?? resources).length <= 6}>
              {#each (searchResult ?? resources).slice(0, showAllNotes ? Infinity : 7) as resource (resource.id)}
                <li>
                  <ResourceLoader {resource}>
                    {#snippet children(resource: Resource)}
                      <PageMention
                        {resource}
                        editing={isRenamingNote === resource.id}
                        onchange={(v) => {
                          handleRenameNote(resource.id, v)
                          isRenamingNote = undefined
                        }}
                        oncancel={handleCancelRenameNote}
                        onclick={async (event) => {
                          if (isRenamingNote) return
                          handleResourceClick(resource.id, event)
                        }}
                        onrename={() => (isRenamingNote = resource.id)}
                      />
                    {/snippet}
                  </ResourceLoader>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="empty">
              <Button size="md" onclick={handleCreateNote}>
                <span class="typo-title-sm">Create New Note</span>
              </Button>
              <p class="typo-title-sm"></p>
            </div>
          {/if}
        {/snippet}
      </SurfLoader>

      <!--    {#if !showAllNotes}
        <span class="more typo-title-sm">+ {(searchResult ?? resources).length - 6} more</span>
      {/if}-->
    </section>
  </main>

  <NotebookSidebar title="Drafts" notebookId="drafts" bind:open={resourcesPanelOpen} />
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
      margin-top: -3rem;
      opacity: 0.25;
    }
  }

  .empty {
    width: 100%;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    padding: 0.75rem 0.75rem;
    border-radius: 10px;
    display: flex;
    flex-direction: row;
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
      background: rgb(198 206 249 / 40%);
      color: var(--accent);
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
  .cover.title {
    display: none;
  }

  @media screen and (width <= 1024px) {
    .cover.side {
      display: none;
    }
    .cover.title {
      display: block;
    }
  }
</style>
