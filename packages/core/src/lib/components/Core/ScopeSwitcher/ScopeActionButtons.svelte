<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { useDesktopManager } from '@horizon/core/src/lib/service/desktop'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import DesktopPreview from '../../Chat/DesktopPreview.svelte'
  import { useTabsViewManager } from '@horizon/core/src/lib/service/tabs'

  export let onShowDesktop: () => void
  export let onOpenInOasis: () => void

  const desktopManager = useDesktopManager()
  const oasis = useOasis()
  const viewManager = useTabsViewManager()

  const desktopVisible = desktopManager.activeDesktopVisible
  const selectedSpace = oasis.selectedSpace

  let contentElem: HTMLUListElement

  onMount(() => {
    // check if the menu would overlap with the active webcontents view
    // and if so notify the view manager that the menu is open
    const activeWebview = document.querySelector(
      '.browser-window.active .webcontentsview-container'
    )
    if (activeWebview && contentElem) {
      const viewRect = activeWebview.getBoundingClientRect()
      const menuRect = contentElem.getBoundingClientRect()

      // Check if any part of the menu overlaps with the view
      const isOverlapping = !(
        (
          Math.round(menuRect.left) >= Math.round(viewRect.right) || // Menu is completely to the right
          Math.round(menuRect.right) <= Math.round(viewRect.left) || // Menu is completely to the left
          Math.round(menuRect.top) >= Math.round(viewRect.bottom) || // Menu is completely below
          Math.round(menuRect.bottom) <= Math.round(viewRect.top)
        ) // Menu is completely above
      )

      if (isOverlapping && !viewManager?.overlayStateValue.selectPopupOpen) {
        viewManager.changeOverlayState({ selectPopupOpen: true })
      }
    } else {
      console.warn(
        'No active webview found or contentElem is not set. Cannot check for overlap with select dropdown.'
      )
    }
  })

  onDestroy(() => {
    viewManager.changeOverlayState({
      selectPopupOpen: false
    })
  })
</script>

<ul class="hover-buttons" bind:this={contentElem}>
  {#if !$desktopVisible}
    <div class="desktop-preview-wrapper" on:click|stopPropagation={onShowDesktop}>
      <DesktopPreview willReveal={false} desktopId={$selectedSpace} />
    </div>
    <hr />
  {/if}
  <button type="submit" on:click|stopPropagation={onOpenInOasis}>
    <Icon name="arrow" size="1.2em" />
    <span class="truncate" style="flex: 1; width:100%; max-width: 20ch;">Open in Stuff</span>
  </button>
</ul>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  .hover-buttons {
    --ctx-background: var(--background-color, #fff);
    --ctx-border: var(--border-color, rgba(0, 0, 0, 0.25));
    --ctx-shadow-color: var(--shadow-color, rgba(0, 0, 0, 0.12));

    --ctx-item-hover: var(--item-hover-color, #2497e9);
    --ctx-item-danger-hover: var(--item-danger-hover-color, #ff4d4f);
    --ctx-item-submenu-open: var(--item-submenu-open-color, rgba(0, 0, 0, 0.065));
    --ctx-item-text: var(--item-text-color, #210e1f);
    --ctx-item-text-hover: var(--item-text-hover-color, #fff);

    position: absolute;
    top: calc(100% + 0.5rem);
    left: -2rem;
    width: 180px;
    height: fit-content;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 10;
    background: var(--ctx-background);
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    user-select: none;
    font-size: 0.9em;
    transform-origin: top left;
    animation: scale-in 125ms cubic-bezier(0.19, 1, 0.22, 1);
  }

  @keyframes scale-in {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .hover-buttons {
    @include utils.light-dark-custom('background-color', #fff, #111b2b, #fff, #111b2b);
    @include utils.light-dark-custom(
      'border-color',
      rgba(0, 0, 0, 0.25),
      rgba(255, 255, 255, 0.25),
      rgba(0, 0, 0, 0.25),
      rgba(255, 255, 255, 0.25)
    );
    @include utils.light-dark-custom(
      'shadow-color',
      rgba(0, 0, 0, 0.12),
      rgba(125, 125, 125, 0.25),
      rgba(0, 0, 0, 0.12),
      rgba(125, 125, 125, 0.25)
    );
    @include utils.light-dark-custom('item-hover-color', #2497e9, #2497e9, #2497e9, #2497e9);
    @include utils.light-dark-custom('item-danger-hover-color', #ff4d4f, #ff4d4f, #ff4d4f, #ff4d4f);
    @include utils.light-dark-custom(
      'item-submenu-open-color',
      rgba(0, 0, 0, 0.065),
      rgba(255, 255, 255, 0.075),
      rgba(0, 0, 0, 0.065),
      rgba(255, 255, 255, 0.075)
    );
    @include utils.light-dark-custom('item-text-color', #210e1f, #fff, #210e1f, #fff);
    @include utils.light-dark-custom('item-text-hover-color', #fff, #fff, #fff, #fff);
  }

  .desktop-preview-wrapper {
    position: relative;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: fit-content;
    padding: 0;
    border-radius: 6px;
    overflow: hidden;
    background: transparent;
    box-shadow: none;

    :global(.desktop-preview-container) {
      width: 100%;
      border-radius: 4px;
      transform: none !important;
    }

    :global(.desktop-preview) {
      width: 100%;
      height: 6rem;
      border-radius: 0.5rem;
      outline: none;
      transform: none !important;
    }

    :global(.context-pill) {
      display: none;
    }

    :global(.show-desktop-label) {
      opacity: 1 !important;
      background: var(--label-bg);
      color: var(--label-color);
      transition: all 0.2s;
      font-size: 0.99em;
      font-weight: 500;
      letter-spacing: 0.0125rem;
      font-family: system-ui;
      -webkit-font-smoothing: antialiased;
    }
  }

  .desktop-preview-wrapper {
    @include utils.light-dark-custom(
      'label-bg',
      rgba(2, 132, 199, 0.8),
      rgba(2, 132, 199, 0.8),
      rgba(2, 132, 199, 0.8),
      rgba(2, 132, 199, 0.8)
    );
    @include utils.light-dark-custom('label-color', #fff, #fff, #fff, #fff);
  }

  hr {
    margin-inline: 1.2ch;
    margin: 0.125rem;
    border-top: 0.07rem solid var(--hr-color);
  }

  hr {
    @include utils.light-dark-custom(
      'hr-color',
      rgba(0, 0, 0, 0.15),
      rgba(255, 255, 255, 0.15),
      rgba(0, 0, 0, 0.15),
      rgba(255, 255, 255, 0.15)
    );
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.4em 0.55em;
    padding-bottom: 0.385rem;
    border-radius: 6px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.0125rem;
    font-size: 0.99em;
    text-align: left;
    color: var(--ctx-item-text);
    font-family: system-ui;
    -webkit-font-smoothing: antialiased;
    border: none;
    background: none;
    cursor: pointer;
    width: 100%;

    &:hover {
      background: var(--ctx-item-hover);
      color: var(--ctx-item-text-hover);
      outline: none;
    }

    &:focus {
      outline: none;
    }

    & * {
      pointer-events: none;
    }
  }
</style>
