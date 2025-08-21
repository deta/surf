<script lang="ts">
  import { useTabs, TabItem } from '@deta/services/tabs'
  import { Favicon, Button } from '@deta/ui'
  import { Icon } from '@deta/icons'

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
    tabsService.delete(tab.id)
  }
</script>

<div
  class="tab-item"
  class:active
  class:collapsed
  class:squished
  class:no-transition={isResizing}
  style:--width={`${width ?? '0'}px`}
  onclick={handleClick}
  aria-hidden="true"
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

    &.active {
      border: 0.5px solid white;
      background: linear-gradient(to top, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.75));
      box-shadow:
        inset 0 0 0 0.75px rgba(255, 255, 255, 0.4),
        inset 0 0.5px 0 1px rgba(255, 255, 255, 0.25),
        inset 0 -0.75px 0 1px rgba(0, 0, 0, 0.01);
      .tab-title {
        color: var(--on-surface-accent);
      }
      color: var(--on-surface-accent);
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
          background: rgba(255, 255, 255, 0.6);
          border-radius: 8px;
          outline: 0.5px solid rgba(255, 255, 255, 0.6);
          z-index: 1;
        }
      }
      .tab-icon {
        position: absolute;
        left: 50%;
        width: 16px;
        height: 16px;
        transform: translateX(-50%);
        z-index: 2;
      }
    }

    &:hover {
      .tab-title {
        -webkit-mask-image: linear-gradient(
          to right,
          #000 calc(100% - 2.5rem),
          transparent calc(100% - 1.25rem)
        );
      }
    }

    &:hover:not(.active) {
      background: rgba(255, 255, 255, 0.6);
      box-shadow:
        inset 0 0 0 0.75px rgba(255, 255, 255, 0.1),
        inset 0 0.5px 0 1px rgba(255, 255, 255, 0.2),
        inset 0 -0.75px 0 1px rgba(0, 0, 0, 0.01);
      transition: none;
    }

    &.collapsed {
      justify-content: center;

      .tab-icon {
        margin: 0;
      }
    }

    /* Reveal close button on hover — but not in collapsed state */
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
    color: var(--on-app-background);
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
    color: var(--on-surface-muted);

    &:hover {
      color: var(--accent);
      opacity: 1;
    }
  }
</style>
