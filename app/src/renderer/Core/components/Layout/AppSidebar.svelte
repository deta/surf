<script lang="ts">
  // TODO: persist size
  import { useViewManager } from '@deta/services/views'
  import { useBrowser } from '@deta/services/browser'
  import { Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import WebContentsView from '../WebContentsView.svelte'
  import NavigationBar from '../NavigationBar/NavigationBar.svelte'
  import NavigationBarGroup from '../NavigationBar/NavigationBarGroup.svelte'

  const viewManager = useViewManager()
  const browser = useBrowser()

  // NOTE: We could move the initialization into core so that it loads a bit faster on first open
  if (!viewManager.activeSidebarView) {
    viewManager.setSidebarState({
      open: false,
      view: viewManager.create({ url: 'surf://notebook', permanentlyActive: true })
    })
  }

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
  }

  $effect(() => {
    if (viewManager.sidebarViewOpen && viewManager.activeSidebarView === null) {
      viewManager.setSidebarState({
        view: viewManager.create({ url: 'surf://notebook', permanentlyActive: true })
      })
    }
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
              <Button size="md" square onclick={() => {}}>
                <Icon name="edit" size="1.2em" />
              </Button>
            </NavigationBarGroup>
          {/snippet}

          {#snippet rightChildren()}
            <NavigationBarGroup slim>
              <Button size="md" square onclick={() => browser.moveSidebarViewToTab()}>
                <Icon name="arrow.diagonal" size="1.2em" />
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
