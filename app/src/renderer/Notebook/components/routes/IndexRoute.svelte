<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { Button } from '@deta/ui'
  import { onMount } from 'svelte'
  import { contextMenu } from '@deta/ui'
  import { type Notebook } from '@deta/services/notebook'
  import { openDialog } from '@deta/ui'
  import { MaskedScroll } from '@deta/ui'
  import { truncate, useDebounce } from '@deta/utils'
  import TeletypeEntry from '../../../Core/components/Teletype/TeletypeEntry.svelte'
  import NotebookCard from '../NotebookCard.svelte'

  let { query }: { query?: string } = $props()

  let showAllNotebooks = $state(query !== null)

  let isCreatingNotebook = $state(false)
  let isRenamingNotebook: string | undefined = $state(undefined)
  let newNotebookName: string | undefined = $state(undefined)

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

  const handleCreateNotebook = async () => {
    //if (newNotebookName === undefined || newNotebookName.length < 1) {
    //  isCreatingNotebook = false
    //  newNotebookName = undefined
    //  return
    //}

    await notebookManager.createNotebook({
      name: 'Untitled Notebook'
    })

    isCreatingNotebook = false
    newNotebookName = undefined
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

  onMount(() => {
    notebookManager.loadNotebooks()
  })
</script>

<svelte:head>
  <title>Maxintosh HD</title>
</svelte:head>

<main>
  <div class="tty-wrapper">
    <h1>
      {'Maxintosh HD'}
    </h1>
    <TeletypeEntry open={true} />
  </div>
  <section>
    <div
      style="display: flex; justify-content: space-between;align-items: center;margin-top: 0.5rem; opacity: 1;"
    >
      <Button size="md" onclick={handleCreateNotebook}
        ><Icon name="add" size="1.1em" />New Notebook</Button
      >
      <Button size="md" onclick={() => (showAllNotebooks = !showAllNotebooks)}
        >{showAllNotebooks ? 'Hide All' : 'Show All'}</Button
      >
    </div>
  </section>
  <section>
    {#if notebooksList.length <= 0}
      <div class="empty">
        <p class="typo-title-sm">
          You don't have any notebooks yet. Create your first one to organize notes, media and more.
        </p>
      </div>
    {:else}
      <MaskedScroll>
        <div class="notebook-grid">
          <div
            class="notebook-wrapper"
            style="width: 100%;max-width: 12ch;"
            style:--delay={'100ms'}
            onclick={async () => {
              await navigation.navigate(`surf://notebook/drafts`).finished
            }}
          >
            <NotebookCard title="Drafts" size={12} color={['#232323', 'green']} />
          </div>

          {#each notebooksList.slice(0, showAllNotebooks ? Infinity : 4) as notebook, i (notebook.id)}
            <div
              class="notebook-wrapper"
              style="width: 100%;max-width: 12ch;"
              style:--delay={100 + i * 10 + 'ms'}
              use:contextMenu={{
                canOpen: true,
                items: [
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
              }}
            >
              <NotebookCard
                {notebook}
                text={notebook.dataValue.folderName ?? notebook.dataValue.name}
                size={12}
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
      </MaskedScroll>
      <div
        style="display: flex; justify-content: center;align-items: center;margin-bottom: 0.5rem; opacity: 1;"
      ></div>
    {/if}
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
</style>
