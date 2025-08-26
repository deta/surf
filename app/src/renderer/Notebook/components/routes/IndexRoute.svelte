<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { Button, PageMention } from '@deta/ui'
  import { onMount } from 'svelte'

  let editorEl = $state() as HTMLElement

  const notebookManager = useNotebookManager()
  const sortedNotebooksList = $derived(notebookManager.sortedNotebooksList)

  const handleCreateContainer = async () => {
    const notebook = await notebookManager.createNotebook({
      name: 'Untitled Notebook'
    })
    console.warn(notebook)
  }

  onMount(() => {
    notebookManager.loadNotebooks()
  })
</script>

<svelte:head>
  <title>Surf</title>
</svelte:head>

<div class="content">
  <h1>Maxintosh HD</h1>
  <div class="tty">
    <div
      bind:this={editorEl}
      class="inner"
      contenteditable="true"
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          const value = editorEl.innerText
          e.preventDefault()
          // TODO: Send IPC to main?
        }
      }}
    ></div>
  </div>

  <br />
  <br />
  <!--<p><strong>Notebook ID:</strong> {notebookId}</p>-->
  <div class="container-list">
    <span class="label">Notebooks</span>
    <ul>
      <li>
        <Button size="md" onclick={handleCreateContainer}
          ><Icon name="add" size="1.1em" /> New Notebook</Button
        >
      </li>
      {#each $sortedNotebooksList.toReversed() as container, i (container.id)}
        <li>
          <PageMention
            text={`${container.dataValue.emoji ? container.dataValue.emoji + ' ' : ''}${container.dataValue.folderName ?? container.dataValue.name}`}
            onclick={async () => {
              await navigation.navigate(`surf://notebook/${container.id}`).finished
            }}
            --delay={50 + i * 50 + 'ms'}
          />
        </li>
      {/each}
    </ul>

    <br />
    <br />
    <ul class="built-in-items">
      <li>
        <PageMention
          text={`Drafts`}
          icon="file"
          onclick={async () => {
            await navigation.navigate(`surf://notebook/drafts`).finished
          }}
          --delay={10 + $sortedNotebooksList.length * 50 + 50 + 1 * 50 + 'ms'}
        />
      </li>
      <li>
        <PageMention
          text={`History`}
          icon="history"
          onclick={async () => {
            await navigation.navigate(`surf://notebook/history`).finished
          }}
          --delay={10 + $sortedNotebooksList.length * 50 + 50 + 2 * 50 + 'ms'}
        />
      </li>
    </ul>
  </div>
</div>

<style lang="scss">
  .content {
    height: 100%;
    max-width: 675px;
    margin: 0 auto;
    padding-block: 5rem;
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
        padding: 0.5rem 0.75rem;

        &:focus {
          outline: none;
        }
      }
    }
  }

  .container-list {
    width: 100%;

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

  .built-in-items {
    position: sticky;
    bottom: 0;
  }
</style>
