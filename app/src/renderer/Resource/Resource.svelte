<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as router from '@mateothegreat/svelte5-router'
  import { Router, type RouteConfig } from '@mateothegreat/svelte5-router'

  import { prepareContextMenu } from '@deta/ui'
  import { provideConfig } from '@deta/services'
  import { createNotebookManager } from '@deta/services/notebooks'
  import { createResourceManager } from '@deta/services/resources'
  import { createTeletypeService } from '@deta/services/teletype'
  import { useMessagePortClient } from '@deta/services/messagePort'

  import IndexRoute from './routes/IndexRoute.svelte'
  import NotebookDetailRoute from './routes/NotebookDetailRoute.svelte'
  import DraftsRoute from './routes/DraftsRoute.svelte'
  import Resource from './routes/ResourceRoute.svelte'
  import NotebookTreeView from './components/notebook/NotebookTreeView.svelte'
  import { ViewLocation } from '@deta/types'
  import NotebookEditor from './components/notebook/NotebookEditor/NotebookEditor.svelte'
  import { Notebook } from '@deta/services/notebooks'

  const notebookId = window.location.pathname.slice(1) || null

  const messagePort = useMessagePortClient()
  const config = provideConfig()
  const resourceManager = createResourceManager(config)
  const notebookManager = createNotebookManager(resourceManager, config, messagePort)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const teletypeService = createTeletypeService()

  let isCustomizingNotebook = $state(undefined) as Notebook | undefined | null

  let resourcesPanelOpen = $state(
    false /*
    localStorage.getItem('notebook_resourcePanelOpen')
      ? localStorage.getItem('notebook_resourcePanelOpen') === 'true'
      : false*/
  )

  let treeSidebarOpen = $state(
    localStorage.getItem('notebook_treeSidebarOpen')
      ? localStorage.getItem('notebook_treeSidebarOpen') === 'true'
      : true
  )

  const MIN_SIDEBAR_WIDTH = 200
  const MAX_SIDEBAR_WIDTH = 350
  const DEFAULT_SIDEBAR_WIDTH = 250

  const stored = parseInt(
    localStorage.getItem('notebook_sidebarWidth') || String(DEFAULT_SIDEBAR_WIDTH)
  )
  // Clamp stored value to current MIN/MAX range
  let sidebarWidth = $state(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, stored)))

  let isResizing = $state(false)
  let rafId: number | null = null
  let saveWidthTimeout: number | null = null

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    isResizing = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return

    // Use RAF for smooth 60fps UI updates
    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX))
      sidebarWidth = newWidth

      // Debounce localStorage update (only save after resize stops)
      if (saveWidthTimeout) clearTimeout(saveWidthTimeout)
      saveWidthTimeout = setTimeout(() => {
        localStorage.setItem('notebook_sidebarWidth', String(sidebarWidth))
      }, 500) as unknown as number
    })
  }

  const stopResize = () => {
    if (!isResizing) return

    isResizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Force final save on mouseup
    if (saveWidthTimeout) clearTimeout(saveWidthTimeout)
    localStorage.setItem('notebook_sidebarWidth', String(sidebarWidth))
  }

  onMount(() => {
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
  })

  onDestroy(() => {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)

    if (rafId) cancelAnimationFrame(rafId)
    if (saveWidthTimeout) clearTimeout(saveWidthTimeout)
  })

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
  $effect(() => localStorage.setItem('notebook_treeSidebarOpen', treeSidebarOpen.toString()))

  onMount(prepareContextMenu)
  onMount(() => {
    // Listen for toggle requests from Core renderer via IPC
    const handleToggleRequest = (data: { open: boolean }) => {
      treeSidebarOpen = !treeSidebarOpen //data.open
    }

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
          if (location === ViewLocation.Sidebar) treeSidebarOpen = false
        } catch (error) {
          console.error('Error handling viewMounted message:', error)
        }
      }),

      window.api?.onToggleNotebookSidebar?.(handleToggleRequest)
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
        messagePort: messagePort,
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

  const onCustomizeNotebook = (notebook: Notebook) => {
    isCustomizingNotebook = notebook
  }
</script>

<div class="resource-container">
  {#if isCustomizingNotebook}
    <NotebookEditor bind:notebook={isCustomizingNotebook} />
  {/if}

  {#if treeSidebarOpen}
    <aside class="left-tree-sidebar" style="width: {sidebarWidth}px;">
      <NotebookTreeView bind:isVisible={treeSidebarOpen} {onCustomizeNotebook} />
      <div
        class="resize-handle"
        class:resizing={isResizing}
        onmousedown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      ></div>
    </aside>
  {/if}
  <div class="router-content">
    <Router {routes} />
  </div>
</div>

<style lang="scss">
  :root {
    --page-gradient-color: #f7ebff;
    --page-background: #fbf9f7;

    -electron-corner-smoothing: 60%;
    //font-size: 11px;
    --text: light-dark(#586884, #c7d2ff);
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
    --background-accent-dark: #1e2433;
    --background-accent-p3-dark: color(display-p3 0.118 0.141 0.2);
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
    background:
      light-dark(
        linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 1)),
        linear-gradient(rgba(13, 20, 33, 0.85), rgba(13, 20, 33, 0.95))
      ),
      url('./assets/greenfield.png');
    background: light-dark(rgba(250, 250, 250, 1), #0d1421);
    background:
      light-dark(
        linear-gradient(to bottom, rgba(250, 250, 250, 1) 0%, rgba(255, 255, 255, 0.9) 10%),
        linear-gradient(to bottom, rgba(13, 20, 33, 0.95) 0%, rgba(13, 20, 33, 0.98) 12%)
      ),
      light-dark(
        radial-gradient(at bottom right, transparent, rgba(255, 255, 255, 0.8) 90%),
        radial-gradient(at bottom right, transparent, rgba(12, 23, 41, 0.6) 90%)
      ),
      url('./assets/greenfield.png');
    background-repeat: no-repeat;
    background-size: cover;
    background-position: 50% 30%;
  }

  .resource-container {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100%;
    overflow: hidden;
  }

  .left-tree-sidebar {
    position: relative;
    left: 0;
    top: 0;
    z-index: 1000000;
    flex-shrink: 0;
    padding-top: 1rem;
    border-right: 0.5px solid
      light-dark(var(--border-color, rgba(0, 0, 0, 0.1)), rgba(71, 85, 105, 0.3));
    border-top: 0.5px solid
      light-dark(var(--border-color, rgba(0, 0, 0, 0.1)), rgba(71, 85, 105, 0.3));
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100vh;
    padding-bottom: 0;

    // it should be fixed if the screen size is above 800px wide
    @media (max-width: 1440px) {
      position: relative;
    }
  }

  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: col-resize;
    z-index: 101;
    transition: background-color 0.15s ease;

    &::before {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: transparent;
      transition: background-color 0.15s ease;
    }

    &:hover::before,
    &.resizing::before {
      background: var(--primary);
      opacity: 0.4;
    }

    &:active::before,
    &.resizing::before {
      opacity: 0.6;
    }
  }

  .router-content {
    position: fixed;
    inset: 0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    height: 100vh;

    @media (max-width: 1440px) {
      position: relative;
    }
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 3%;
    background: var(--color);
    transition:
      top 100ms cubic-bezier(0.2, 0, 0, 1),
      left 100ms cubic-bezier(0.2, 0, 0, 1);
  }

  :global(.dragcula-drop-indicator.dragcula-axis-vertical) {
    left: var(--inset);
    right: var(--inset);
    height: 2px;
    transform: translateY(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal) {
    top: var(--inset);
    bottom: var(--inset);
    width: 2px;
    transform: translateX(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both) {
    left: 0;
    top: 0;
    width: 2px;
    height: 3rem;
    transform: translateY(-50%);
  }

  :global(.dragcula-drop-indicator.dragcula-axis-vertical::before) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::after) {
    content: '';
    position: absolute;
    top: 0;
    right: -6px;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::before) {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both::before) {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }

  :global([data-drag-zone][axis='vertical']) {
    // This is needed to prevent margin collapse when the first child has margin-top. Without this, it will move the container element instead.
    padding-top: 1px;
    //margin-top: -1px;
  }
</style>
