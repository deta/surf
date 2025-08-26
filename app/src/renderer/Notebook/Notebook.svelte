<script lang="ts">
  import { onMount } from 'svelte'
  import { provideConfig } from '@deta/services'
  import { createNotebookManager, type Notebook } from '@deta/services/notebooks'
  import { setupTelemetry } from '@deta/services/helpers'
  import { useLogScope } from '@deta/utils'
  import { createResourceManager } from '@deta/services/resources'
  import IndexRoute from './components/routes/IndexRoute.svelte'
  import NotebookDetailRoute from './components/routes/NotebookDetailRoute.svelte'
  import DraftsRoute from './components/routes/DraftsRoute.svelte'
  import HistoryRoute from './components/routes/HistoryRoute.svelte'

  const searchParams = new URLSearchParams(window.location.search)
  const notebookId = searchParams.get('notebookId') || null

  const log = useLogScope('NotebookRenderer')
  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)

  let notebook: Notebook = $state(null)

  onMount(async () => {
    if (notebookId && !['drafts', 'history'].includes(notebookId)) {
      notebook = await notebookManager.getNotebook(notebookId)
    } else {
      notebook = notebookId
    }
  })

  // TODO: Load by pattern match array -> component directly
</script>

<div class="wrapper">
  {#if notebookId === null}
    <IndexRoute />
  {:else if notebook === 'drafts'}
    <DraftsRoute />
  {:else if notebook === 'history'}
    <HistoryRoute />
  {:else if notebook}
    <NotebookDetailRoute {notebook} />
  {/if}
</div>

<style lang="scss">
  :root {
    --page-gradient-color: #f7ebff;
    --page-background: #fbf9f7;
  }
  :global(#app) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  :global(html, body) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    background: var(--page-gradient-color); // Gradient here to make scrolled page look nice
  }

  .wrapper {
    position: relative;
    background: var(--page-background);

    min-height: 100%;
    width: 100%;
    margin: 0;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4rem;
      z-index: 0;
      pointer-events: none;
      background: linear-gradient(to bottom, var(--page-gradient-color), transparent);
    }
    &::after {
      content: '';
      position: fixed;
      bottom: 4.5rem;
      left: 0;
      right: 0;
      height: 6rem;
      z-index: 0;
      pointer-events: none;
      background: linear-gradient(to top, var(--page-background), transparent);
    }

    h1 {
      font-size: 28px;
      margin-bottom: 5px;
      font-family: 'Gambarino';
    }
  }
</style>
