<script lang="ts">
  import { useTabs, TabItem } from '@deta/services/tabs'
  import { spawnBoxSmoke } from '@deta/ui/src/lib/components/Effects/index'
  import { Favicon, Button } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { HTMLDragItem, DragData } from '@deta/dragcula'
  import { DragTypeNames } from '@deta/types'

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

  const title = tab.view.title
  const url = tab.view.url

  function handleClick() {
    tabsService.setActiveTab(tab.id)
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
    tabsService.setActiveTab(tab.id)
  }

  function handleDragEnd() {
    // Handle drag end if needed
  }
</script>

<div
  id="tab-{tab.id}"
  data-tab-id="tab-{tab.id}"
  class="tab-item"
  class:active
  class:collapsed
  class:squished
  class:no-transition={isResizing}
  style:--width={`${width ?? '0'}px`}
  onclick={handleClick}
  aria-hidden="true"
  draggable="true"
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
    <Favicon url={$url} title={$title} />
  </div>

  {#if !collapsed && !squished}
    <span class="tab-title typo-tab-title">{$title}</span>
  {/if}

  {#if showCloseButton && !collapsed && !squished}
    <div class="close-button">
      <Button size="xs" square onclick={handleClose}>
        <Icon name="close" />
      </Button>
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
      --drag-scale: 0.5;
      z-index: 1000;
    }

    &.active {
      border: 0.5px solid light-dark(var(--white), var(--border-subtle-dark));
      background: light-dark(
        radial-gradient(
          290.88% 100% at 50% 0%,
          var(--tab-active-gradient-top, rgba(237, 246, 255, 0.96)) 0%,
          var(--tab-active-gradient-bottom, rgba(246, 251, 255, 0.93)) 100%
        ),
        radial-gradient(
          290.88% 100% at 50% 0%,
          var(--tab-active-gradient-top-dark, rgba(40, 53, 73, 0.92)) 0%,
          var(--tab-active-gradient-bottom-dark, rgba(27, 36, 56, 0.88)) 100%
        )
      );
      box-shadow:
        0 -0.5px 1px 0 light-dark(
            var(--tab-shadow-inset-accent, rgba(119, 189, 255, 0.15)),
            var(--tab-shadow-inset-accent-dark, rgba(129, 146, 255, 0.22))
          ) inset,
        0 1px 1px 0
          light-dark(
            var(--white),
            color-mix(in srgb, var(--surface-elevated-dark) 35%, transparent)
          )
          inset,
        0 12px 5px 0
          light-dark(var(--tab-shadow-base, #3e4750), var(--tab-shadow-base-dark, #111827)),
        0 7px 4px 0
          light-dark(
            var(--tab-shadow-surface-soft, rgba(62, 71, 80, 0.01)),
            var(--tab-shadow-surface-soft-dark, rgba(16, 21, 33, 0.18))
          ),
        0 3px 3px 0
          light-dark(
            var(--tab-shadow-surface, rgba(62, 71, 80, 0.02)),
            var(--tab-shadow-surface-dark, rgba(16, 21, 33, 0.28))
          ),
        0 1px 2px 0
          light-dark(
            var(--tab-shadow-surface, rgba(62, 71, 80, 0.02)),
            var(--tab-shadow-surface-dark, rgba(16, 21, 33, 0.28))
          ),
        0 1px 1px 0
          light-dark(var(--black), color-mix(in srgb, var(--overlay-medium-dark) 28%, transparent)),
        0 1px 1px 0
          light-dark(
            var(--tab-shadow-black, rgba(0, 0, 0, 0.01)),
            var(--tab-shadow-black-dark, rgba(15, 23, 42, 0.12))
          ),
        0 1px 1px 0
          light-dark(
            var(--tab-shadow-black-strong, rgba(0, 0, 0, 0.05)),
            var(--tab-shadow-black-strong-dark, rgba(15, 23, 42, 0.28))
          ),
        0 0 1px 0
          light-dark(
            var(--tab-shadow-black-heavy, rgba(0, 0, 0, 0.09)),
            var(--tab-shadow-black-heavy-dark, rgba(15, 23, 42, 0.4))
          );
      @supports (color(display-p3 1 1 1)) {
        background: light-dark(
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-p3, color(display-p3 0.9365 0.9644 0.9997 / 0.96)) 0%,
            var(--tab-active-gradient-bottom-p3, color(display-p3 0.9686 0.9843 1 / 0.93)) 100%
          ),
          radial-gradient(
            290.88% 100% at 50% 0%,
            var(--tab-active-gradient-top-dark, rgba(40, 53, 73, 0.92)) 0%,
            var(--tab-active-gradient-bottom-dark, rgba(27, 36, 56, 0.88)) 100%
          )
        );
        box-shadow:
          0 -0.5px 1px 0 light-dark(
              var(--tab-shadow-inset-accent-p3, color(display-p3 0.5294 0.7333 0.9961 / 0.15)),
              var(--tab-shadow-inset-accent-dark, rgba(129, 146, 255, 0.22))
            ) inset,
          0 1px 1px 0
            light-dark(
              var(--tab-shadow-highlight-p3, color(display-p3 1 1 1)),
              color-mix(in srgb, var(--surface-elevated-dark) 35%, transparent)
            )
            inset,
          0 12px 5px 0
            light-dark(
              var(--tab-shadow-base-p3-0, color(display-p3 0.251 0.2784 0.3098 / 0)),
              var(--tab-shadow-base-dark, #111827)
            ),
          0 7px 4px 0
            light-dark(
              var(--tab-shadow-base-p3-1, color(display-p3 0.251 0.2784 0.3098 / 0.01)),
              var(--tab-shadow-surface-soft-dark, rgba(16, 21, 33, 0.18))
            ),
          0 3px 3px 0
            light-dark(
              var(--tab-shadow-base-p3-2, color(display-p3 0.251 0.2784 0.3098 / 0.02)),
              var(--tab-shadow-surface-dark, rgba(16, 21, 33, 0.28))
            ),
          0 1px 2px 0
            light-dark(
              var(--tab-shadow-base-p3-2, color(display-p3 0.251 0.2784 0.3098 / 0.02)),
              var(--tab-shadow-surface-dark, rgba(16, 21, 33, 0.28))
            ),
          0 1px 1px 0
            light-dark(
              var(--tab-shadow-black-p3-0, color(display-p3 0 0 0 / 0)),
              color-mix(in srgb, var(--overlay-medium-dark) 28%, transparent)
            ),
          0 1px 1px 0
            light-dark(
              var(--tab-shadow-black-p3-1, color(display-p3 0 0 0 / 0.01)),
              color-mix(in srgb, var(--overlay-medium-dark) 24%, transparent)
            ),
          0 1px 1px 0
            light-dark(
              var(--tab-shadow-black-p3-2, color(display-p3 0 0 0 / 0.05)),
              var(--tab-shadow-black-strong-dark, rgba(15, 23, 42, 0.28))
            ),
          0 0 1px 0
            light-dark(
              var(--tab-shadow-black-p3-3, color(display-p3 0 0 0 / 0.09)),
              var(--tab-shadow-black-heavy-dark, rgba(15, 23, 42, 0.4))
            );
      }
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
          background: light-dark(
            var(--white-60),
            var(--tab-hover-overlay-dark, rgba(35, 45, 65, 0.45))
          );
          border-radius: 8px;
          outline: 0.5px solid
            light-dark(
              var(--white-60),
              color-mix(in srgb, var(--overlay-light-dark) 70%, transparent)
            );
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

    &:hover {
      .tab-title {
        -webkit-mask-image: linear-gradient(
          to right,
          light-dark(var(--black), var(--white)) calc(100% - 2.5rem),
          transparent calc(100% - 1.25rem)
        );
      }
    }

    &:hover:not(.active) {
      background: light-dark(
        var(--tab-hover-overlay, rgba(255, 255, 255, 0.6)),
        var(--tab-hover-overlay-dark, rgba(35, 45, 65, 0.45))
      );
      box-shadow:
        inset 0 0 0 0.75px
          light-dark(
            color-mix(in srgb, var(--white) 10%, transparent),
            color-mix(in srgb, var(--overlay-light-dark) 70%, transparent)
          ),
        inset 0 0.5px 0 1px
          light-dark(
            color-mix(in srgb, var(--white) 20%, transparent),
            color-mix(in srgb, var(--overlay-medium-dark) 45%, transparent)
          ),
        inset 0 -0.75px 0 1px light-dark(var(--tab-shadow-black, rgba(0, 0, 0, 0.01)), color-mix(in
                srgb, var(--overlay-light-dark) 60%, transparent));
      transition: none;
    }

    &.collapsed {
      justify-content: center;

      .tab-icon {
        margin: 0;
      }
    }

    &:hover:not(.collapsed) .close-button {
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
</style>
