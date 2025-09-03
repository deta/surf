<script lang="ts">
  import { onMount } from 'svelte'
  import { provideConfig } from '@deta/services'
  import { createNotebookManager, type Notebook } from '@deta/services/notebooks'
  import { setupTelemetry } from '@deta/services/helpers'
  import { SearchResourceTags } from '@deta/utils'
  import { createResourceManager } from '@deta/services/resources'
  import { createTeletypeService } from '@deta/services/teletype'
  import { useTabs } from '@deta/services/tabs'
  import { prepareContextMenu } from '@deta/ui'
  import IndexRoute from './components/routes/IndexRoute.svelte'
  import NotebookDetailRoute from './components/routes/NotebookDetailRoute.svelte'
  import DraftsRoute from './components/routes/DraftsRoute.svelte'
  import HistoryRoute from './components/routes/HistoryRoute.svelte'
  import { ResourceTypes } from '../../../../packages/types/src'
  import { Resource } from '../../../../packages/services/src/lib/resources'
  import NotebookSidebar from './components/NotebookSidebar.svelte'
  import { writable } from 'svelte/store'
  import BackgroundImage from './assets/greenfield.png?url'

  const searchParams = new URLSearchParams(window.location.search)
  const notebookId = searchParams.get('notebookId') || null
  const query = searchParams.get('query') || null

  const telemetry = setupTelemetry()
  const config = provideConfig()
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const teletypeService = createTeletypeService()

  let notebook: Notebook = $state(null)
  let notebookData = $derived(notebook.data ?? writable(null))
  const notebookContents = $derived(notebook ? notebook.contents : writable([]))
  let notebookResources = $state([])

  $effect(() => {
    Promise.all(
      $notebookContents
        //.filter((e) => e.resource_type !== 'application/vnd.space.document.space-note')
        .map((e) => resourceManager.getResource(e.entry_id))
    ).then((v) => {
      notebookResources = v
    })
  })

  let title = $derived(
    !notebook ? 'Maxintosh HD' : ($notebookData?.folderName ?? $notebookData?.name ?? '')
  )

  let resourcesPanelOpen = $state(false)
  let resources: Resource[] = $state([])

  onMount(async () => {
    prepareContextMenu()

    if (notebookId && !['drafts', 'history'].includes(notebookId)) {
      notebook = await notebookManager.getNotebook(notebookId)
    } else {
      notebook = notebookId
    }

    let resourceIds = []

    if (!query) {
      if (notebook) notebook.fetchContents()
      else {
        resourceIds = await resourceManager.listResourceIDsByTags([
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent')
        ])
      }
    } else {
      console.warn('DBG ', query)
      const result = await resourceManager.searchResources(
        query,
        [
          SearchResourceTags.Deleted(false),
          SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          SearchResourceTags.NotExists('silent')
          //...hashtags.map((x) => SearchResourceTags.Hashtag(x)),
          //...conditionalArrayItem(isNotesSpace, [
          //  SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
          //])
        ],
        {
          semanticEnabled: false,
          spaceId: notebookId ?? undefined
        }
      )
      resourceIds = result.resources.map((e) => e.id)
    }
    resources = (await Promise.all(resourceIds.map((id) => resourceManager.getResource(id)))).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    console.warn('DBG', resources, query, resourceIds)

    if (query !== null && query?.length > 0) resourcesPanelOpen = true
  })
</script>

<div class="notebook">
  <div class="bg"></div>

  {#if notebookId === null}
    <IndexRoute {query} />
  {:else if notebook === 'drafts'}
    <DraftsRoute />
  {:else if notebook === 'history'}
    <HistoryRoute />
  {:else if notebook}
    <NotebookDetailRoute
      {notebook}
      resources={notebook && query === null ? notebookResources : resources}
      {query}
    />
  {/if}

  <NotebookSidebar
    {title}
    {notebook}
    bind:open={resourcesPanelOpen}
    resources={notebook && query === null ? notebookResources : resources}
  />
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
    user-select: none;
  }
  :global(#app *) {
    -electron-corner-smoothing: 60%;
  }
  :global(html, body) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    // overflow: hidden;
  }

  :global(body) {
    background: linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 1)),
      url('./assets/greenfield.png');
    background-repeat: no-repeat;
    background-size: cover;
    background-position: 50% 30%;
  }

  .notebook {
    position: relative;
    overflow-x: hidden;

    //.bg {
    //  content: '';
    //  position: absolute;
    //  inset: -4px;
    //  background:
    //    linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 1)),
    //    url('https://i.imgur.com/7XbyivJ.png');
    //  background-repeat: no-repeat;
    //  background-size: cover;
    //  background-position: 50% 30%;
    //  //background: #fff;
    //  z-index: -1;
    //  filter: blur(2px);
    //  pointer-events: none;
    //}

    height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;

    padding-inline: 1.5rem;
    padding-block: 4.5rem;

    //&::before {
    //  content: '';
    //  position: absolute;
    //  top: 0;
    //  left: 0;
    //  right: 0;
    //  height: 2rem;
    //  z-index: 0;
    //  pointer-events: none;
    //  background: linear-gradient(to bottom, var(--page-gradient-color), transparent);
    //}
  }
</style>
