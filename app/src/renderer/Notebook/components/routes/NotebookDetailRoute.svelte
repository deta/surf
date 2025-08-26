<script lang="ts">
  import { onMount } from 'svelte'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { writable } from 'svelte/store'
  import { type Notebook } from '@deta/services/notebook'
  import { Button, PageMention } from '@deta/ui'
  import { Icon } from '@deta/icons'

  let { notebook }: { notebook: Notebook } = $props()

  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  const contents = notebook.contents
  const contentsNotes = $derived(
    $contents.filter((e) => e.resource_type === 'application/vnd.space.document.space-note')
  )

  const handleCreateNote = async () => {
    const note = await resourceManager.createResourceNote('kekw', {
      name: 'Untitled Note'
    })
    notebookManager.addResourcesToNotebook(notebook.id, [note.id], 1)
  }

  onMount(() => {
    container.fetchContents()
  })
</script>

<svelte:head>
  <title
    >{`${notebook.dataValue.emoji ? notebook.dataValue.emoji + ' ' : ''}${notebook.dataValue.folderName ?? notebook.dataValue.name}`}</title
  >
</svelte:head>

<div class="content">
  <h1>
    {`${notebook.dataValue.emoji ? notebook.dataValue.emoji + ' ' : ''}${notebook.dataValue.folderName ?? notebook.dataValue.name}`}
  </h1>
  <div class="tty"><div class="inner"></div></div>

  <br />
  <br />
  <div class="notes-list">
    <span class="label">Notes</span>
    <ul>
      <li>
        <Button size="md" onclick={handleCreateNote}
          ><Icon name="add" size="1.1em" /> New Note</Button
        >
      </li>
      {#each contentsNotes as entry, i (entry.id)}
        <li>
          <!-- text={`${entry}`} -->
          <PageMention
            resourceId={entry.entry_id}
            onclick={async () => {
              await navigation.navigate(`surf://resource/${entry.entry_id}`).finished
            }}
            --delay={50 + i * 5 + 'ms'}
          />
        </li>
      {/each}
    </ul>
  </div>
</div>

<style lang="scss">
  .content {
    height: 100%;
    max-width: 675px;
    margin: 0 auto;
    padding-block: 5rem;
    padding-bottom: 10rem;
    position: relative;

    h1 {
      font-size: 28px;
      margin-inline: 0.5rem;
      margin-bottom: 5px;
      font-family: 'Gambarino';
    }

    // TODO: ONLY PLACEHOLDER UI
    .tty {
      margin: 0 auto;
      height: 240px;
      background: FBFBFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      padding: 0.40094rem;
      border-radius: 1.17425rem;
      box-shadow:
        0 5px 27px 0 #c4ddfb1a,
        0 52px 25px 0 rgba(196, 221, 251, 0.03),
        0 25px 21px 0 rgba(196, 221, 251, 0.1),
        0 6px 16px 0 rgba(196, 221, 251, 0.16),
        0 4px 9px 0 rgba(196, 221, 251, 0.19);
      .inner {
        width: 100%;
        height: 100%;
        border-radius: 0.80194rem;
        background: #fff;
        box-shadow:
          0 0 0.47px 0 rgba(0, 0, 0, 0.18),
          0 0.941px 2.823px 0 rgba(0, 0, 0, 0.1);
      }
    }
  }

  .notes-list {
    > .label {
      font-size: 0.9rem;
      font-weight: 500;
      opacity: 0.4;
    }

    :global(.mention-page) {
      opacity: 1;
      transform: translateY(0px);

      transition-property: opacity, transform;
      transition-duration: 234ms;
      transition-timing-function: ease-out;
      transition-delay: var(--delay, 0ms);

      @starting-style {
        opacity: 0;
        transform: translate(-3px, 2px);
      }
    }
  }
</style>
