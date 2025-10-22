<script lang="ts">
  import { useTabs, TabItem } from '@deta/services/tabs'
  import { Favicon, Button, type CtxItem, contextMenu } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { HTMLDragItem, DragData } from '@deta/dragcula'
  import { DragTypeNames } from '@deta/types'
  import { getCleanHostname } from '@deta/utils'
  import { useBrowser } from '@deta/services/browser'
  import { spawnBoxSmoke } from '@deta/ui/src/lib/components/Effects/index'
  import { ViewType } from '@deta/services/views'

  let {
    tab,
    active,
    height,
    showCloseButton = true,
    isResizing = false
  }: {
    tab: TabItem
    active: boolean
    height?: number
    showCloseButton?: boolean
    isResizing?: boolean
  } = $props()

  const tabsService = useTabs()
  const browser = useBrowser()

  const title = tab.view.title
  const url = tab.view.url
  const faviconURL = tab.view.faviconURL
  const type = tab.view.type
  const stateIndicator = $derived(tab?.stateIndicator)

  const hostname = $derived(getCleanHostname($url))

  function closeTab(userAction = false) {
    tabsService.delete(tab.id, userAction)
  }

  function handleClick() {
    tabsService.setActiveTab(tab.id, true)
  }

  function handleClose(event: MouseEvent) {
    event.stopPropagation()

    const rect = document.getElementById(`tab-${tab.id}`)?.getBoundingClientRect()
    if (rect) {
      spawnBoxSmoke(rect, {
        densityN: 30,
        size: 13,
        //velocityScale: 0.5,
        cloudPointN: 7
      })
    }

    tabsService.delete(tab.id, true, false)
  }

  function handleDragStart() {
    tabsService.setActiveTab(tab.id, false)
  }

  function handleDragEnd() {
    // no-op
  }

  const items = [
    {
      type: 'action',
      icon: 'reload',
      text: 'Reload Tab',
      action: () => tab.view.webContents?.reload()
    },
    {
      type: 'action',
      icon: 'copy',
      text: 'Copy URL',
      action: () => tab.copyURL()
    },
    {
      type: 'action',
      icon: 'sidebar.right',
      text: 'Open in Sidebar',
      action: () => browser.moveTabToSidebar(tab)
    },
    {
      type: 'action',
      icon: 'close',
      text: 'Close Tab',
      action: () => closeTab(true)
    }
  ] satisfies CtxItem[]
</script>

<div
  id="tab-{tab.id}"
  data-tab-id="tab-{tab.id}"
  class="vertical-tab-item"
  class:active
  class:state-visible={stateIndicator !== 'none'}
  class:no-transition={isResizing}
  style:--height={`${height ?? '40'}px`}
  style:--tab-id={`tab-${tab.id}`}
  onclick={handleClick}
  aria-hidden="true"
  draggable="true"
  {@attach contextMenu({
    canOpen: true,
    items
  })}
  use:HTMLDragItem.action={{
    id: `tab-${tab.id}`,
    data: (() => {
      const dragData = new DragData()
      dragData.setData(DragTypeNames.SURF_TAB, tab)
      return dragData
    })()
  }}
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
>
  <div class="tab-icon">
    {#if $type === ViewType.Resource}
      <Icon name="note" size="1.1rem" />
    {:else if $type === ViewType.Notebook}
      <Icon name="notebook" />
    {:else}
      <Favicon url={$faviconURL || $url} title={$title} />
    {/if}
  </div>

  <div class="tab-content">
    <span class="tab-title typo-tab-title">{$title || hostname}</span>

    {#if showCloseButton}
      <div class="close-button">
        <Button size="xs" square onclick={handleClose}>
          <Icon name="close" />
        </Button>
      </div>
    {/if}
  </div>

  {#if stateIndicator === 'success'}
    <div class="state-indicator success">
      <Icon name="check" />
    </div>
  {/if}
</div>

<style lang="scss">
  .vertical-tab-item {
    position: relative;
    padding: 0.375rem 0.75rem;
    border-radius: 12px;
    user-select: none;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: var(--t-2);
    height: var(--height, 32px);
    min-height: 32px;
    width: var(--drag-width, 100%);
    opacity: 1;
    border: 0.5px solid transparent;
    transition:
      background-color 90ms ease-out,
      height 190ms cubic-bezier(0.165, 0.84, 0.44, 1),
      opacity 150ms ease-out;
    app-region: no-drag;
    box-sizing: border-box;
    will-change: height;

    @starting-style {
      height: calc(var(--height, 40px) * 0.5);
      opacity: 0.66;
    }

    &.no-transition {
      transition:
        background-color 90ms ease-out,
        opacity 150ms ease-out;
    }

    &.dragging {
      opacity: 0.5;
      --drag-scale: 0.95;
      z-index: 1000;
    }

    &.active {
      border: 0.5px solid #fff;
      border: 0.5px solid color(display-p3 1 1 1);
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        rgba(237, 246, 255, 0.96) 0%,
        rgba(246, 251, 255, 0.93) 100%
      );
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        color(display-p3 0.9365 0.9644 0.9997 / 0.96) 0%,
        color(display-p3 0.9686 0.9843 1 / 0.93) 100%
      );
      box-shadow:
        0 -0.5px 1px 0 rgba(119, 189, 255, 0.15) inset,
        0 1px 1px 0 #fff inset,
        0 2px 8px 0 rgba(62, 71, 80, 0.1),
        0 1px 3px 0 rgba(62, 71, 80, 0.1);

      .tab-title {
        color: var(--on-surface-accent);
      }
      color: var(--on-surface-accent);
    }

    &:hover:not(.active),
    &:global([data-context-menu-anchor]) {
      background: rgba(255, 255, 255, 0.6);
      box-shadow:
        inset 0 0 0 0.75px rgba(255, 255, 255, 0.1),
        inset 0 0.5px 0 1px rgba(255, 255, 255, 0.2),
        inset 0 -0.75px 0 1px rgba(0, 0, 0, 0.01);
      transition: none;
    }

    /* Always reveal close button on hover in vertical mode - we have space */
    &:hover .close-button {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .tab-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .tab-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    gap: var(--t-2);
  }

  .tab-title {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    -webkit-font-smoothing: subpixel-antialiased;
    text-rendering: optimizeLegibility;
    color: var(--on-app-background);
    font-size: 0.875rem;
  }

  .close-button {
    flex-shrink: 0;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    width: 16px;
    height: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
    color: var(--on-surface-muted);

    &:hover {
      color: var(--accent);
      opacity: 1;
    }
  }

  .state-indicator {
    position: absolute;
    right: 0.75rem;
    flex-shrink: 0;
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    width: 16px;
    height: 16px;
    pointer-events: none;

    &.success {
      color: var(--accent);
    }
  }
</style>
