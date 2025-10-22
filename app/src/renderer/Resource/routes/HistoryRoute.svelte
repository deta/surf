<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { Button, PageMention } from '@deta/ui'
  import { onMount } from 'svelte'

  let editorEl = $state() as HTMLElement

  const notebookManager = useNotebookManager()

  onMount(() => {
    notebookManager.loadNotebooks()
  })
</script>

<svelte:head>
  <title>History</title>
</svelte:head>

<div class="content">
  <h1>History</h1>

  <div class="container-list">
    <!--<span class="label">Notes</span>-->
    <ul>
      <!--{#each $sortedNotebooksList as container, i}
        <li>
          <PageMention
            text={`${container.data.emoji ? container.data.emoji + " " : ""}${container.data.folderName}`}
            onclick={async () => {
              await navigation.navigate(`surf://notebook/${container.id}`)
                .finished;
            }}
            --delay={50 + i * 50 + "ms"}
          />
        </li>
      {/each}-->
      <li>
        <PageMention text={`Pleacholder`} --delay={50 + 1 * 50 + 'ms'} />
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
</style>
