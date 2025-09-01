<script lang="ts">
  import { onMount } from 'svelte'
  import { provideConfig } from '@deta/services'
  import { createNotebookManager, type Notebook } from '@deta/services/notebooks'
  import { setupTelemetry } from '@deta/services/helpers'
  import { useLogScope } from '@deta/utils'
  import { createResourceManager } from '@deta/services/resources'
  import { createMentionService } from '@deta/services/mentions'
  import { createTeletypeService } from '@deta/services/teletype'
  import { useTabs } from '@deta/services/tabs'
  import IndexRoute from './components/routes/IndexRoute.svelte'
  import NotebookDetailRoute from './components/routes/NotebookDetailRoute.svelte'
  import DraftsRoute from './components/routes/DraftsRoute.svelte'
  import HistoryRoute from './components/routes/HistoryRoute.svelte'
  import TeletypeEntry from '../Core/components/Teletype/TeletypeEntry.svelte'
  import { Renamable } from '@deta/ui'

  const searchParams = new URLSearchParams(window.location.search)
  const notebookId = searchParams.get('notebookId') || null

  const log = useLogScope('NotebookRenderer')
  const telemetry = setupTelemetry()
  const config = provideConfig()
  const tabsService = useTabs()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mentionService = createMentionService(tabsService)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const teletypeService = createTeletypeService()

  let notebook: Notebook = $state(null)
  let title = $state('maxus notebook')
  let isLoadingTitle = $state(true)

  async function loadTitle() {
    try {
      const loadedTitle = await notebookManager.loadTitle()
      title = loadedTitle
    } catch (error) {
      console.warn('Failed to load notebook title:', error)
    } finally {
      isLoadingTitle = false
    }
  }

  async function saveTitle(newTitle: string) {
    try {
      await notebookManager.saveTitle(newTitle)
      title = newTitle
      console.log('Title saved:', newTitle)
    } catch (error) {
      console.error('Failed to save notebook title:', error)
    }
  }

  onMount(async () => {
    await loadTitle()

    if (notebookId && !['drafts', 'history'].includes(notebookId)) {
      notebook = await notebookManager.getNotebook(notebookId)
    } else {
      notebook = notebookId
    }
  })
</script>

<div class="wrapper">
  <div class="content">
    <h1>
      {#if !isLoadingTitle}
        <Renamable value={title} onConfirm={saveTitle} placeholder="Untitled Notebook" />
      {/if}
    </h1>

    <div>
      <TeletypeEntry open={true} />
    </div>
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
</div>

<style lang="scss">
  :root {
    --page-gradient-color: #f7ebff;
    --page-background: #fbf9f7;

    -electron-corner-smoothing: 60%;
    //font-size: 11px;
    --text: #586884;
    --text-p3: color(display-p3 0.3571 0.406 0.5088);
    --text-light: #666666;
    --background-dark: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    --background-dark-p3: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      color(display-p3 0.9373 0.9569 1) 0%,
      color(display-p3 0.9321 0.9531 1) 50%,
      color(display-p3 0.8349 0.8849 0.9974) 100%
    );
    --background-accent: #eff2ff;
    --background-accent-hover: rgb(246, 247, 253);
    --background-accent-p3: color(display-p3 0.9381 0.9473 1);
    --border-color: #e0e0e088;
    --outline-color: #e0e0e080;
    --primary: #2a62f1;
    --primary-dark: #a48e8e;
    --green: #0ec463;
    --red: #f24441;
    --orange: #fa870c;
    --border-width: 0.5px;
    --color-brand: #b7065c;
    --color-brand-muted: #b7065cba;
    --color-brand-dark: #ff4fa4;
    --border-radius: 18px;
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
      bottom: 0;
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
