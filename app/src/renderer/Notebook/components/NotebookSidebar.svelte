<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button, contextMenu, MaskedScroll, openDialog } from '@deta/ui'
  import SourceCard from './SourceCard.svelte'
  import { ResourceTypes } from '@deta/types'
  import { type Notebook } from '@deta/services/notebook'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { truncate } from '@deta/utils'
  import type { ResourceNote } from '@deta/services/resources'

  let {
    notebook,
    title,
    open = $bindable(),
    resources
  }: { notebook?: Notebook; title: string; open: boolean; resources: Resource[] } = $props()

  const resourceManager = useResourceManager()

  const resourcesNotes = $derived(
    resources.filter((e) => e.type === ResourceTypes.DOCUMENT_SPACE_NOTE)
  )
  const resourcesNotNotes = $derived(
    resources.filter((e) => e.type !== ResourceTypes.DOCUMENT_SPACE_NOTE)
  )

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
</script>

<aside class:open>
  {#if !open}
    <header class="px pt">
      <Button size="md" onclick={() => (open = true)}>
        <span class="typo-title-sm" style="opacity: 0.5;">Show Sources</span>
        <Icon name="sidebar.left" size="1.2em" />
      </Button>
    </header>
  {:else}
    <header class="px pt">
      <div class="hstack" style="gap: 0.5rem;">
        <!--<NotebookCover />-->
        <h1>Sources</h1>
      </div>
      <Button size="md" onclick={() => (open = false)}>
        <span class="typo-title-sm" style="opacity: 0.5;">Hide Sources</span>
        <Icon name="sidebar.left" size="1.2em" />
      </Button>
    </header>

    <!--<section class="px py" style="display: flex; justify-content: start;">
      <NotebookCover --width="60%" />
    </section>-->

    <!--<section class="chapters px py">
      <header>
        <label>Notes</label>
      </header>
      <ul>
        <li><span>Design Fundamentals</span></li>
        <li><span>How to find the perfect ratio?</span></li>
        <li><span>Fractured Chain of Thought</span></li>
        <li><span class="active">Design in 2024 vs 1987</span></li>
        <li><span>Why frontend design succs</span></li>
        <li><span>Why frontend length trimming is so fucking stupid</span></li>
        <li><span>Finding purpose in flowers</span></li>
      </ul>
    </section>-->

    <!--<section class="chapters px">
      <details open>
        <summary>
          <label>Notes </label>
          <hr />
        </summary>
        <ul>
          {#each resourcesNotes as note}
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
                  /*{
            type: 'action',
            text: 'Rename',
            icon: 'edit',
            action: () => (isRenamingNotebook = notebook.id)
          },*/
                  {
                    type: 'action',
                    kind: 'danger',
                    text: 'Delete',
                    icon: 'trash',
                    action: () => handleDeleteNote(note)
                  }
                ]
              }}
              onclick={async () => {
                await navigation.navigate(`surf://resource/${note.id}`).finished
              }}
            >
              <span>{note.metadata.name}</span>
            </li>
          {/each}

        </ul>
      </details>
    </section>-->

    <section class="sources">
      <!--<details open>
        <summary>
          <label>Sources</label>
          <hr />
        </summary>-->
      {#if resourcesNotNotes.length <= 0}
        <div class="px py">
          <div class="empty">
            <p class="typo-title-sm">Save webpages or drop in files to add to this notebook.</p>
          </div>
        </div>
      {:else}
        <MaskedScroll --padding={'1.5rem 1rem 5rem 1rem'}>
          <div class="sources-grid">
            {#each resourcesNotNotes as resource}
              <SourceCard --width={'5rem'} --max-width={''} {resource} text />
            {/each}
          </div>
        </MaskedScroll>
      {/if}
      <!-- </details>-->
    </section>
  {/if}
</aside>

<style lang="scss">
  aside {
    position: fixed;
    right: 0;
    top: 0;
    z-index: 100;

    &.open {
      bottom: 0;
      width: 500px;
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

    section.sources {
      // flex-grow: 1;
      .sources-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
      }
    }

    section.chapters {
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
