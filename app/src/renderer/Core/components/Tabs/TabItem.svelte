<script lang="ts">
  import { useTabs, TabItem } from '@deta/services/tabs'
  import { Favicon, Button, type CtxItem, contextMenu } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { HTMLDragItem, DragData } from '@deta/dragcula'
  import { DragTypeNames } from '@deta/types'
  import { getCleanHostname } from '@deta/utils'
  import { useBrowser } from '@deta/services/browser'
  import { ViewType } from '@deta/services/views'

  let {
    tab,
    active,
    width,
    collapsed = false,
    squished = false,
    showCloseButton = true,
    isResizing = false
  }: {
    tab: TabItem
    active: boolean
    width?: number
    collapsed?: boolean
    squished?: boolean
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
    tabsService.delete(tab.id, true)
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
      icon: tab.pinned ? 'pinned-off' : 'pin',
      text: tab.pinned ? 'Unpin Tab' : 'Pin Tab',
      action: async () => {
        if (tab.pinned) {
          // Unpin and move to end of pinned section
          await tab.unpin()
          const pinnedCount = tabsService.tabs.filter((t) => t.pinned).length
          tabsService.reorderTab(tab.id, pinnedCount)
        } else {
          // Pin and move to end of pinned tabs
          await tab.pin()
          const pinnedCount = tabsService.tabs.filter((t) => t.pinned).length
          tabsService.reorderTab(tab.id, pinnedCount - 1)
        }
      }
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
  class="tab-item"
  class:active
  class:collapsed
  class:squished
  class:pinned={tab.pinned}
  class:state-visible={stateIndicator !== 'none'}
  class:no-transition={isResizing}
  style:--width={`${width ?? '0'}px`}
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

  {#if !collapsed && !squished && !tab.pinned}
    <span class="tab-title typo-tab-title">{$title || hostname || 'Untitled'}</span>
  {/if}

  {#if showCloseButton && !collapsed && !squished && !tab.pinned}
    <div class="close-button">
      <Button size="xs" square onclick={handleClose}>
        <Icon name="close" />
      </Button>
    </div>
  {/if}

  {#if stateIndicator === 'success'}
    <div class="state-indicator success">
      <Icon name="check" />
    </div>
  {/if}
</div>

<style lang="scss">
  .tab-item {
    position: relative;
    padding: 0.5rem 0.55rem;
    border-radius: 11px;
    user-select: none;
    overflow: hidden;
    display: flex;
    flex-shrink: 0;
    gap: var(--t-2);
    align-items: center;
    width: var(--width, 0px);
    opacity: 1;
    border: 0.5px solid transparent;
    transition:
      background-color 90ms ease-out,
      width 190ms cubic-bezier(0.165, 0.84, 0.44, 1),
      opacity 150ms ease-out;
    app-region: no-drag;
    box-sizing: border-box;
    will-change: width;

    @starting-style {
      width: calc(var(--width, 0px) * 0.5);
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
      border: 0.5px solid light-dark(#fff, rgba(71, 85, 105, 0.6));
      border: 0.5px solid
        light-dark(color(display-p3 1 1 1), color(display-p3 0.2784 0.3333 0.4118 / 0.6));
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        light-dark(rgba(237, 246, 255, 0.96), rgba(40, 53, 73, 0.92)) 0%,
        light-dark(rgba(246, 251, 255, 0.93), rgba(27, 36, 56, 0.88)) 100%
      );
      background: radial-gradient(
        290.88% 100% at 50% 0%,
        light-dark(
            color(display-p3 0.9365 0.9644 0.9997 / 0.96),
            color(display-p3 0.1569 0.2078 0.2863 / 0.92)
          )
          0%,
        light-dark(
            color(display-p3 0.9686 0.9843 1 / 0.93),
            color(display-p3 0.1059 0.1412 0.2196 / 0.88)
          )
          100%
      );
      box-shadow:
        0 -0.5px 1px 0 light-dark(rgba(119, 189, 255, 0.15), rgba(129, 146, 255, 0.22)) inset,
        0 1px 1px 0 light-dark(#fff, rgba(71, 85, 105, 0.3)) inset,
        0 12px 5px 0 light-dark(#3e4750, rgba(15, 23, 42, 0)),
        0 7px 4px 0 light-dark(rgba(62, 71, 80, 0.01), rgba(15, 23, 42, 0.02)),
        0 3px 3px 0 light-dark(rgba(62, 71, 80, 0.02), rgba(15, 23, 42, 0.04)),
        0 1px 2px 0 light-dark(rgba(62, 71, 80, 0.02), rgba(15, 23, 42, 0.04)),
        0 1px 1px 0 light-dark(#000, rgba(0, 0, 0, 0)),
        0 1px 1px 0 light-dark(rgba(0, 0, 0, 0.01), rgba(0, 0, 0, 0.02)),
        0 1px 1px 0 light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.08)),
        0 0 1px 0 light-dark(rgba(0, 0, 0, 0.09), rgba(0, 0, 0, 0.12));
      box-shadow:
        0 -0.5px 1px 0 light-dark(
            color(display-p3 0.5294 0.7333 0.9961 / 0.15),
            color(display-p3 0.5059 0.5725 0.9961 / 0.22)
          ) inset,
        0 1px 1px 0
          light-dark(color(display-p3 1 1 1), color(display-p3 0.2784 0.3333 0.4118 / 0.3)) inset,
        0 12px 5px 0
          light-dark(
            color(display-p3 0.251 0.2784 0.3098 / 0),
            color(display-p3 0.0588 0.0902 0.1647 / 0)
          ),
        0 7px 4px 0
          light-dark(
            color(display-p3 0.251 0.2784 0.3098 / 0.01),
            color(display-p3 0.0588 0.0902 0.1647 / 0.02)
          ),
        0 3px 3px 0
          light-dark(
            color(display-p3 0.251 0.2784 0.3098 / 0.02),
            color(display-p3 0.0588 0.0902 0.1647 / 0.04)
          ),
        0 1px 2px 0
          light-dark(
            color(display-p3 0.251 0.2784 0.3098 / 0.02),
            color(display-p3 0.0588 0.0902 0.1647 / 0.04)
          ),
        0 1px 1px 0 light-dark(color(display-p3 0 0 0 / 0), color(display-p3 0 0 0 / 0)),
        0 1px 1px 0 light-dark(color(display-p3 0 0 0 / 0.01), color(display-p3 0 0 0 / 0.02)),
        0 1px 1px 0 light-dark(color(display-p3 0 0 0 / 0.05), color(display-p3 0 0 0 / 0.08)),
        0 0 1px 0 light-dark(color(display-p3 0 0 0 / 0.09), color(display-p3 0 0 0 / 0.12));
      .tab-title {
        color: light-dark(var(--on-surface-accent), var(--on-surface-accent-dark));
      }
      color: light-dark(var(--on-surface-accent), var(--on-surface-accent-dark));
    }

    &.squished {
      width: fit-content;
    }

    &.squished:not(.active) {
      padding: 0.25rem 0;
      width: auto;
      flex-grow: 1;
      min-width: 4px;
      overflow: visible;
      &:hover {
        background: none;
        box-shadow: none;
        &:after {
          content: '';
          position: absolute;
          top: 0;
          left: -25%;
          width: 150%;
          height: 100%;
          background: light-dark(rgba(255, 255, 255, 0.6), rgba(35, 45, 65, 0.45));
          border-radius: 8px;
          outline: 0.5px solid light-dark(rgba(255, 255, 255, 0.6), rgba(71, 85, 105, 0.5));
          z-index: 1;
        }
      }
      .tab-icon {
        position: absolute;
        left: 50%;
        width: 16px;
        height: 16px;
        max-width: 16px;
        max-height: 16px;
        overflow: visible;
        transform: translateX(-50%);
        z-index: 2;
      }
    }

    &:hover,
    &.state-visible {
      .tab-title {
        -webkit-mask-image: linear-gradient(
          to right,
          light-dark(#000, #fff) calc(100% - 2.5rem),
          transparent calc(100% - 1.25rem)
        );
      }
    }

    &:hover:not(.active),
    &:global([data-context-menu-anchor]) {
      background: light-dark(rgba(255, 255, 255, 0.6), rgba(35, 45, 65, 0.45));
      box-shadow:
        inset 0 0 0 0.75px light-dark(rgba(255, 255, 255, 0.1), rgba(71, 85, 105, 0.2)),
        inset 0 0.5px 0 1px light-dark(rgba(255, 255, 255, 0.2), rgba(71, 85, 105, 0.15)),
        inset 0 -0.75px 0 1px light-dark(rgba(0, 0, 0, 0.01), rgba(15, 23, 42, 0.12));
      transition: none;
    }

    &.collapsed {
      justify-content: center;

      .tab-icon {
        margin: 0;
      }
    }

    // Pinned tab styles
    &.pinned {
      min-width: 40px;
      max-width: 40px;
      width: 40px !important;
      padding: 0.5rem 0.375rem;
      justify-content: center;

      .tab-icon {
        margin: 0;
      }
    }

    /* Reveal close button on hover — but not in collapsed state or pinned state */
    &:hover:not(.collapsed):not(.pinned) .close-button {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .tab-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-title {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    -webkit-font-smoothing: subpixel-antialiased;
    text-rendering: optimizeLegibility;
    color: light-dark(var(--on-app-background), var(--on-app-background-dark));
  }

  .close-button {
    position: absolute;
    right: 0.55rem;

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
    color: light-dark(var(--on-surface-muted), var(--on-surface-muted-dark));

    &:hover {
      color: light-dark(var(--accent), var(--accent-dark));
      opacity: 1;
    }
  }

  .state-indicator {
    position: absolute;
    right: 0.55rem;

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
      color: light-dark(var(--accent), var(--accent-dark));
    }
  }
</style>
