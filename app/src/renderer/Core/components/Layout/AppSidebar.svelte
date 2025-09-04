<script lang="ts">
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useViewManager } from '@deta/services/views'
  import { useBrowser } from '@deta/services/browser'
  import { Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import WebContentsView from '../WebContentsView.svelte'
  import NavigationBar from '../NavigationBar/NavigationBar.svelte'
  import NavigationBarGroup from '../NavigationBar/NavigationBarGroup.svelte'
  import { useKVTable, type BaseKVItem } from '@deta/services'
  import { onMount } from 'svelte'
  import { isInternalRendererURL, useDebounce } from '@deta/utils'
  import { useResourceManager } from '@deta/services/resources'
  import { writable } from 'svelte/store'

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const browser = useBrowser()
  const viewManager = useViewManager()
  const sidebarStore = useKVTable<
    {
      siderbar_width: number
      sidebar_location: string
    } & BaseKVItem
  >('notebook_sidebar')

  const activeSidebarView = $derived(viewManager.activeSidebarView)
  const activeSidebarLocation = $derived(activeSidebarView?.url ?? writable(null))

  let isResizing = $state(false)
  let targetSidebarWidth = 670
  let sidebarWidth = $state(670)
  let raf = null

  const rafCbk = () => {
    sidebarWidth = targetSidebarWidth
    raf = null
  }

  const handleResizeMouseDown = (e: MouseEvent) => {
    window.addEventListener('mousemove', handleResizingMouseMove, { capture: true })
    window.addEventListener('mouseup', handleResizingMouseUp, { capture: true, once: true })
    isResizing = true
  }
  const handleResizingMouseMove = (e: MouseEvent) => {
    targetSidebarWidth -= e.movementX
    if (raf === null) requestAnimationFrame(rafCbk)
  }
  const handleResizingMouseUp = (e: MouseEvent) => {
    window.removeEventListener('mousemove', handleResizingMouseMove, { capture: true })
    isResizing = false
    sidebarStore.update('cfg', { siderbar_width: targetSidebarWidth })
  }

  const handleNewNote = async () => {
    const note = await resourceManager.createResourceNote('', {
      name: 'Untitled Note'
    })

    if (isInternalRendererURL($activeSidebarLocation ?? '')) {
      const url = isInternalRendererURL($activeSidebarLocation)
      if (url.hostname === 'notebook' && url.pathname?.length > 0) {
        const notebookId = url.pathname.slice(1)
        notebookManager.addResourcesToNotebook(notebookId, [note.id], 1)
      }
    }

    activeSidebarView?.webContents.loadURL(`surf://resource/${note.id}`)
  }
  const debouncedSaveLocation = useDebounce((location: string) => {
    if (location === undefined || location === null || location.length <= 0) return
    sidebarStore.update('cfg', { sidebar_location: location })
  }, 250)

  $effect(() => {
    debouncedSaveLocation($activeSidebarLocation)
  })

  $effect(() => {
    if (viewManager.sidebarViewOpen && viewManager.activeSidebarView === null) {
      viewManager.setSidebarState({
        view: viewManager.create({ url: 'surf://notebook', permanentlyActive: true })
      })
    }
  })

  onMount(async () => {
    if ((await sidebarStore.read('cfg')) === undefined) {
      await sidebarStore.create({ id: 'cfg', siderbar_width: 670, sidebar_location: 'surf://new' })
    }

    const cfg = await sidebarStore.read('cfg')

    // NOTE: We could move the initialization into core so that it loads a bit faster on first open
    if (viewManager.activeSidebarView === undefined) {
      viewManager.setSidebarState({
        open: false,
        view: viewManager.create({ url: cfg.sidebar_location, permanentlyActive: true })
      })
    }

    targetSidebarWidth = cfg.siderbar_width ?? 670
    rafCbk()
  })
</script>

{#if viewManager.sidebarViewOpen && viewManager.activeSidebarView}
  <div class="resize-handle" onmousedown={handleResizeMouseDown}></div>
  <aside class:open={viewManager.sidebarViewOpen} style:--sidebarWidth={sidebarWidth + 'px'}>
    <div class="sidebar-content">
      {#if viewManager.activeSidebarView}
        <NavigationBar
          view={viewManager.activeSidebarView}
          readonlyLocation
          hideNavigationControls
          centeredBreadcrumbs
          hideSearch
        >
          {#snippet leftChildren()}
            <NavigationBarGroup slim>
              <!-- TODO: Implement sth like surf://new -->
              <Button size="md" square onclick={handleNewNote}>
                <Icon name="edit" size="1.2em" />
              </Button>
            </NavigationBarGroup>
          {/snippet}

          {#snippet rightChildren()}
            <NavigationBarGroup slim>
              <Button size="md" square onclick={() => browser.moveSidebarViewToTab()}>
                <Icon name="arrow.diagonal" size="1.15em" />
              </Button>

              <Button size="md" square onclick={() => viewManager.setSidebarState({ open: false })}>
                <Icon name="close" size="1.2em" />
              </Button>
            </NavigationBarGroup>
          {/snippet}
        </NavigationBar>
        <div
          style="position:relative;height:100%;border-inline: 1px solid var(--border-color);margin-inline: -1px;"
        >
          <WebContentsView view={viewManager.activeSidebarView} active />
        </div>
      {/if}
    </div>
  </aside>
{/if}

<style lang="scss">
  .resize-handle {
    position: relative;
    width: 1.25rem;
    cursor: col-resize;
    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      height: 30%;
      width: 4px;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.08);
      border-radius: 20px;

      transition: background 123ms ease-out;
    }
    &:hover::before {
      background: rgba(0, 0, 0, 0.15);
    }
  }
  aside {
    display: flex;
    width: var(--sidebarWidth);

    .sidebar-content {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    //transition: width 20034ms ease-out;
    transition-property: width, display;
    transition-duration: 123ms;
    transition-timing-function: ease-out;
    interpolate-size: allow-keywords;
  }
</style>
