<script lang="ts">
  import { onMount } from 'svelte'
  import * as router from '@mateothegreat/svelte5-router'
  import { Router, type RouteConfig } from '@mateothegreat/svelte5-router'

  import { prepareContextMenu } from '@deta/ui'
  import { provideConfig } from '@deta/services'
  import { createNotebookManager } from '@deta/services/notebooks'
  import { setupTelemetry } from '@deta/services/helpers'
  import { createResourceManager } from '@deta/services/resources'
  import { createTeletypeService } from '@deta/services/teletype'
  import { useMessagePortClient } from '@deta/services/messagePort'

  import IndexRoute from './routes/IndexRoute.svelte'
  import NotebookDetailRoute from './routes/NotebookDetailRoute.svelte'
  import DraftsRoute from './routes/DraftsRoute.svelte'
  import Resource from './routes/ResourceRoute.svelte'

  const notebookId = window.location.pathname.slice(1) || null

  const messagePort = useMessagePortClient()
  const config = provideConfig()
  const telemetry = setupTelemetry(config.getConfig().api_key)
  const resourceManager = createResourceManager(telemetry, config)
  const notebookManager = createNotebookManager(resourceManager, config, messagePort)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const teletypeService = createTeletypeService()

  let resourcesPanelOpen = $state(
    false /*
    localStorage.getItem('notebook_resourcePanelOpen')
      ? localStorage.getItem('notebook_resourcePanelOpen') === 'true'
      : false*/
  )

  let title = $derived(
    notebookId === 'drafts'
      ? 'Drafts'
      : notebookId === 'history'
        ? 'History'
        : !notebookId
          ? 'Surf'
          : 'Notebook'
  )

  $effect(() => localStorage.setItem('notebook_resourcePanelOpen', resourcesPanelOpen.toString()))

  onMount(prepareContextMenu)
  onMount(async () => {
    await telemetry.init({ messagePort })
  })

  onMount(() => {
    const unsubs = [
      messagePort.navigateURL.handle(({ url }) => {
        try {
          router.goto(url)
        } catch (error) {
          console.error('Error navigating to URL:', error)
        }
      }),

      messagePort.viewMounted.handle(({ location }) => {
        try {
        } catch (error) {
          console.error('Error handling viewMounted message:', error)
        }
      })
    ]

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  })

  const routes: RouteConfig[] = [
    {
      path: '/notebook',
      component: IndexRoute,
      props: {
        resourcesPanelOpen: resourcesPanelOpen,
        onopensidebar: () => (resourcesPanelOpen = true)
      }
    },
    {
      path: '/notebook/drafts',
      component: DraftsRoute,
      props: {
        resourcesPanelOpen: resourcesPanelOpen
      }
    },
    {
      path: '/notebook/(?!drafts)(?<notebookId>[^/]+)',
      component: NotebookDetailRoute,
      props: {
        messagePort: messagePort,
        resourcesPanelOpen: resourcesPanelOpen
      }
    },
    {
      path: '/resource/(?<resourceId>[^/]+)',
      component: Resource
    }
  ]
</script>

<Router {routes} />

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

    --sidebar-width: 600px;
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
    background: rgba(250, 250, 250, 1);
    background: linear-gradient(to bottom, rgba(250, 250, 250, 1) 0%, rgba(255, 255, 255, 0.9) 10%),
      radial-gradient(at bottom right, transparent, rgba(255, 255, 255, 0.8) 90%),
      url('./assets/greenfield.png');
    background-repeat: no-repeat;
    background-size: cover;
    background-position: 50% 30%;
  }
</style>
