<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { Button } from '@deta/ui'
  import { onMount } from 'svelte'
  import { type Notebook } from '@deta/services/notebook'
  import { MaskedScroll, openDialog, contextMenu, NotebookCover } from '@deta/ui'
  import { truncate, useDebounce } from '@deta/utils'
  import TeletypeEntry from '../../Core/components/Teletype/TeletypeEntry.svelte'
  import { openNotebook, openResource } from '../handlers/notebookOpenHandlers'
  import { type Fn, SpaceEntryOrigin } from '@deta/types'
  import { useResourceManager } from '@deta/services/resources'
  import NotebookSidebar from '../components/notebook/NotebookSidebar.svelte'
  import NotebookLayout from '../layouts/NotebookLayout.svelte'
  import NotebookEditor from '../components/notebook/NotebookEditor/NotebookEditor.svelte'
  import { useTeletypeService } from '../../../../../packages/services/src/lib'

  let {
    onopensidebar,
    resourcesPanelOpen = false
  }: { onopensidebar: Fn; resourcesPanelOpen?: boolean } = $props()

  let isCreatingNotebook = $state(false)
  let isRenamingNotebook: string | undefined = $state(undefined)
  let newNotebookName: string | undefined = $state(undefined)
  let isCustomizingNotebook = $state(null)

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const teletype = useTeletypeService()
  const ttyQuery = teletype.query
  const notebooks = $derived(notebookManager.sortedNotebooks.filter((e) => e.data.pinned))

  const handleCreateNotebook = async () => {
    //if (newNotebookName === undefined || newNotebookName.length < 1) {
    //  isCreatingNotebook = false
    //  newNotebookName = undefined
    //  return
    //}

    const nb = await notebookManager.createNotebook(
      {
        name: 'Untitled Notebook',
        pinned: true
      },
      true
    )

    isCreatingNotebook = false
    newNotebookName = undefined
    notebookManager.loadNotebooks()

    onopensidebar?.()
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

  const handleCreateNote = async () => {
    const note = await resourceManager.createResourceNote(
      '',
      {
        name: 'Untitled Note'
      },
      undefined,
      true
    )
    openResource(note.id, { target: 'active_tab' })
  }

  const handlePinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: true })
  }
  const handleUnPinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: false })
  }

  onMount(() => {
    document.title = 'Surf'
    notebookManager.loadNotebooks()
  })

  const pinnedNotebooks = $derived(notebookManager.sortedNotebooks.filter((e) => e.data.pinned))
</script>

<svelte:head>
  <title>Surf</title>
</svelte:head>

{#if isCustomizingNotebook}
  <NotebookEditor bind:notebook={isCustomizingNotebook} />
{/if}

<NotebookLayout>
  <main>
    <div class="tty-wrapper">
      <!--<h1>
        {title}
      </h1>-->
      <TeletypeEntry open={true} />
    </div>
    {#if $ttyQuery.length <= 0}
      <section>
        <div class="notebook-grid">
          {#each pinnedNotebooks as notebook, i (notebook.id + i)}
            <NotebookCover
              {notebook}
              height="17.25ch"
              fontSize="0.84rem"
              onclick={(e) => openNotebook(notebook.id, { target: 'auto' })}
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
          {/each}
        </div>
      </section>
    {/if}
  </main>

  <NotebookSidebar title="Surf" bind:open={resourcesPanelOpen} />
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

    section {
      flex-shrink: 1;
      padding-inline: 0.5rem;

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
    }
  }

  .empty {
    width: 100%;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.25);

    p {
      max-width: 40ch;
      text-align: center;
      text-wrap: pretty;
    }
  }

  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;

    display: flex;
    flex-wrap: wrap;
    //justify-content: space-between;
    justify-items: center;
  }
  .notebook-wrapper {
    opacity: 1;

    transform: translateY(0px);
    transition:
      opacity 223ms ease-out,
      transform 123ms ease-out,
      box-shadow 123ms ease-out;
    transition-delay: var(--delay, 0ms);
    @starting-style {
      transform: translateY(2px);
      opacity: 0;
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

  .notebook-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;

    display: flex;
    flex-wrap: wrap;
    //justify-content: space-between;
    justify-items: center;
  }
</style>
