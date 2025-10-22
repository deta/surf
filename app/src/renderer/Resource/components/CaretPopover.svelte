<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import { Icon } from '@deta/icons'
  import { isMac } from '@deta/utils/system'

  const dispatch = createEventDispatcher()

  export let visible: boolean = false
  export let position: {
    left: number
    top: number
    height: number
    bottom: number
  } = {
    left: 0,
    top: 0,
    height: 0,
    bottom: 0
  }

  // Configuration for positioning
  const OFFSET_X = 8
  const TRANSITION_DURATION_MS = 300 // 0.3s in milliseconds
  const HOVER_AREA_SIZE = 24 // Size of the square hover area

  let popoverElement: HTMLDivElement
  let popoverContent: HTMLDivElement
  let pillElement: HTMLDivElement
  let isHovering = false
  let resizeObserver: ResizeObserver | null = null
  let transitionTimeout: number | null = null

  // Update whenever position or visibility changes
  $: if (visible && popoverElement && position) {
    // Use requestAnimationFrame to ensure everything's updated properly
    requestAnimationFrame(updatePosition)
  }

  // Position the popover using the provided position coordinates
  function updatePosition() {
    if (!visible || !popoverElement) return

    // Always position to the right of the caret
    popoverElement.style.left = `${position.left + OFFSET_X}px`

    // Align with the middle of the caret
    const caretMiddle = position.top + position.height / 2

    // Get height of the popover (after it's rendered)
    if (popoverContent) {
      const height = popoverContent.offsetHeight
      popoverElement.style.top = `${caretMiddle - height / 2}px`
    } else {
      // Fallback if we can't get content height yet
      popoverElement.style.top = `${caretMiddle}px`
      popoverElement.style.transform = 'translateY(-50%)'
    }
  }

  function handleMouseEnter() {
    // Re-enable transitions when hovering
    if (popoverElement) {
      popoverElement.style.transition = 'all 0.3s ease'
      isHovering = true

      // Clear any pending timeout that would disable transitions
      if (transitionTimeout !== null) {
        clearTimeout(transitionTimeout)
        transitionTimeout = null
      }
    }
  }

  function handleMouseLeave() {
    // Schedule the transition disabling again when mouse leaves
    isHovering = false
    if (popoverElement) {
      transitionTimeout = setTimeout(() => {
        if (popoverElement) {
          popoverElement.style.transition = 'none'
        }
        transitionTimeout = null
      }, TRANSITION_DURATION_MS) as unknown as number
    }
  }

  onMount(() => {
    // Create a ResizeObserver to watch for container size changes
    // This ensures the popover position updates when its content changes size
    resizeObserver = new ResizeObserver(() => {
      if (visible && position) {
        requestAnimationFrame(updatePosition)
      }
    })

    // Observe the popover content for size changes
    if (popoverContent) {
      resizeObserver.observe(popoverContent)
    }

    // Add visible class after 150ms
    if (popoverElement) {
      setTimeout(() => {
        // Check if popoverElement still exists before accessing classList
        if (popoverElement) {
          popoverElement.classList.add('visible')

          // Lock the element after transition is complete by removing the transition
          transitionTimeout = setTimeout(() => {
            if (popoverElement) {
              popoverElement.style.transition = 'none'
            }
          }, TRANSITION_DURATION_MS) as unknown as number
        }
      }, 150)
    }
  })

  onDestroy(() => {
    // Clean up the ResizeObserver
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    // Clear any pending timeouts
    if (transitionTimeout !== null) {
      clearTimeout(transitionTimeout)
      transitionTimeout = null
    }
  })

  function handleClickPopover(event: MouseEvent) {
    event.stopPropagation()
    event.preventDefault()

    // Dispatch an event to trigger autocomplete (like Opt+Enter)
    dispatch('autocomplete')
  }
</script>

{#if visible}
  <div
    bind:this={popoverElement}
    class="caret-popover"
    aria-hidden="true"
    on:click={handleClickPopover}
  >
    <div bind:this={popoverContent} class="popover-content">
      <div
        class="hover-area"
        on:mouseenter={handleMouseEnter}
        on:mouseleave={handleMouseLeave}
        aria-hidden="true"
      >
        <div class="cursor-container">
          <div class="cursor">
            <Icon name="cursor" fill="light-dark(#ff6426, #ff8a4c)" size={position.height} />
          </div>

          <div bind:this={pillElement} class="pill" class:visible={isHovering}>
            <span>Ask Surf {isMac() ? '⌘' : 'ctrl'} ↵</span>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .caret-popover {
    position: absolute;
    z-index: 9999;
    pointer-events: auto;
    opacity: 0;
    transition: all 0.3s ease;
    transform: translateX(-40%) scale(0.9);
    transform-origin: center center;
    cursor: default;
    &.visible {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
    &:hover {
      transform: scale(1.025) translateX(1px);
    }
  }

  .hover-area {
    position: relative;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Ensure this does not scale with parent hover */
    transform: scale(1);
    transform-origin: center center;
  }

  .cursor-container {
    position: absolute;
    left: 0;
    display: flex;
    align-items: center;
    opacity: 1;
    pointer-events: none;
  }

  .cursor {
    position: relative;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: transparent;
    border: none;
    outline: none;
    cursor: default;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pill {
    margin-top: -2px;
    margin-left: 2px;
    color: light-dark(#ffffff, var(--on-app-background-dark, #e5edff));
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0;
    transform: translateX(-12px);
    transition: all 0.3s ease;
    pointer-events: none;
    font-weight: 450;
    letter-spacing: 0.01em;

    background: paint(squircle) !important;
    --squircle-radius: 11px;
    --squircle-smooth: 0.28;
    --squircle-fill: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.35));
  }

  .pill.visible {
    opacity: 1;
    transform: translateX(0);
  }
</style>
