<script lang="ts">
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useViewManager, ViewType } from '@deta/services/views'
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
  import { NotebookDefaults, ViewLocation } from '@deta/types'

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
    e.preventDefault()
    e.stopPropagation()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    window.addEventListener('mousemove', handleResizingMouseMove, { capture: true })
    window.addEventListener('mouseup', handleResizingMouseUp, { capture: true, once: true })
    isResizing = true
  }
  const handleResizingMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    targetSidebarWidth = Math.max(
      500,
      Math.min(targetSidebarWidth - e.movementX, window.innerWidth - 500)
    )
    if (raf === null) requestAnimationFrame(rafCbk)
  }
  const handleResizingMouseUp = (e: MouseEvent) => {
    e.preventDefault()
    window.removeEventListener('mousemove', handleResizingMouseMove, { capture: true })
    isResizing = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    sidebarStore.update('cfg', { siderbar_width: targetSidebarWidth })
  }

  const handleNewNote = async () => {
    let notebookId: string | undefined = undefined
    const { type, id } = activeSidebarView.typeDataValue
    if (type === ViewType.Notebook && id) {
      notebookId = id
    }

    await browser.createAndOpenNote(undefined, { target: 'sidebar', notebookId })
  }

  const handleSearchInput = useDebounce((value: string) => {
    viewManager.activeSidebarView?.webContents.updatePageQuery(value)
  }, 100)

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
  <div class="container" style:--sidebarWidth={sidebarWidth + 'px'}>
    <div class="resize-handle" onmousedown={handleResizeMouseDown} data-resizing={isResizing}></div>
    <aside class:open={viewManager.sidebarViewOpen}>
      <div class="sidebar-content">
        {#if viewManager.activeSidebarView}
          <NavigationBar
            view={viewManager.activeSidebarView}
            readonlyLocation
            hideNavigationControls
            onsearchinput={handleSearchInput}
            roundRightCorner
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
                <Button
                  size="md"
                  square
                  onclick={() => viewManager.setSidebarState({ open: false })}
                >
                  <Icon name="close" size="1.2em" />
                </Button>
              </NavigationBarGroup>
            {/snippet}
          </NavigationBar>
          <div style="position:relative;height:100%;">
            {#key viewManager.activeSidebarView.id}
              <WebContentsView
                view={viewManager.activeSidebarView}
                location={ViewLocation.Sidebar}
                active
              />
            {/key}
          </div>
        {/if}
      </div>
    </aside>
  </div>
{/if}

<style lang="scss">
  .container {
    display: flex;
    position: relative;
    width: var(--sidebarWidth);
    flex-shrink: 0;
    --fold-width: 0.5rem;

    //&::before {
    //  content: '';
    //  position: absolute;
    //  z-index: 3;
    //  pointer-events: none;
    //  top: 0;
    //  left: 0;
    //  bottom: 0;
    //  width: var(--fold-width);
    //  background: linear-gradient(to bottom, rgba(250, 250, 250, 1) 0%, #fff 10%);

    //  --darkness: 240;
    //  background: linear-gradient(
    //    to right,
    //    rgba(255, 255, 255, 1) 0%,
    //    rgba(var(--darkness), var(--darkness), var(--darkness), 1) 50%,
    //    rgba(255, 255, 255, 1) 100%
    //  );
    //  background: linear-gradient(
    //    to right,
    //    rgba(255, 255, 255, 0) 20%,
    //    rgba(var(--darkness), var(--darkness), var(--darkness), 1) 50%,
    //    rgba(255, 255, 255, 0) 80%
    //  );
    //}
    //&::after {
    //  content: '';
    //  position: absolute;
    //  z-index: 0;
    //  pointer-events: none;
    //  top: 0;
    //  left: 0;
    //  bottom: 0;
    //  width: var(--fold-width);

    //  background: rgba(255, 255, 255, 1);
    //  box-shadow:
    //    //0 -0.5px 1px 0 rgba(250, 250, 250, 1) inset,
    //    //0 1px 1px 0 #fff inset,
    //    0 -3px 1px 0 rgba(0, 0, 0, 0.025),
    //    0 -2px 1px 0 rgba(9, 10, 11, 0.01),
    //    0 -1px 1px 0 rgba(9, 10, 11, 0.03);
    //}
  }
  .resize-handle {
    flex-shrink: 0;
    position: relative;
    width: var(--fold-width);
    cursor: ew-resize;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;

    &::before {
      content: '';
      z-index: 5;
      position: absolute;
      left: calc(50%);
      top: 50%;
      height: 30%;
      width: 3px;
      transform: translate(-50%, -50%);
      background: transparent;
      border-radius: 20px;
      transition: background 123ms ease-out;
    }

    &:hover::before {
      background: light-dark(
        var(--overlay-strong, rgba(0, 0, 0, 0.25)),
        var(--overlay-strong-dark, rgba(15, 23, 42, 0.6))
      );
    }

    &:active::before,
    &[data-resizing='true']::before {
      background: light-dark(
        var(--overlay-modal, rgba(0, 0, 0, 0.5)),
        var(--overlay-modal-dark, rgba(15, 23, 42, 0.7))
      );
      width: 4px;
    }
  }
  aside {
    display: flex;
    width: 100%;

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
