<script lang="ts">
  import { writable } from 'svelte/store'
  import { useLocalStorageStore } from '@deta/utils'

  const isResizing = writable(false)
  const stuffWidth = useLocalStorageStore<number>('stuff_sidebar_width', 500)

  const MIN_WIDTH = 300
  const MAX_WIDTH = 1200

  let _stuffWidth = 0
  let resizeRaf: null | number = null
  let stuffWrapperRef: HTMLElement

  const resizeRafCbk = () => {
    $stuffWidth = _stuffWidth
    resizeRaf = null
  }

  const handleResizeHandlerMouseDown = (_event: MouseEvent) => {
    $isResizing = true

    // Get the component's bounding rectangle
    const componentRect = stuffWrapperRef.getBoundingClientRect()
    const rightEdge = componentRect.right

    const move = (e: MouseEvent) => {
      // Calculate width based on distance from cursor to component right edge
      const distanceFromRight = rightEdge - e.clientX
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, distanceFromRight))

      _stuffWidth = newWidth

      if (resizeRaf === null) {
        resizeRaf = requestAnimationFrame(resizeRafCbk)
      }
    }

    const up = (_e: MouseEvent) => {
      $isResizing = false
      window.removeEventListener('mousemove', move, { capture: true })
    }

    window.addEventListener('mousemove', move, { capture: true })
    window.addEventListener('mouseup', up, { capture: true, once: true })
  }
</script>

<div
  bind:this={stuffWrapperRef}
  id="stuff-sidebar-wrapper"
  class:isResizing={$isResizing}
  class="no-drag"
  style:--stuff-sidebar-width={$stuffWidth + 'px'}
>
  <div role="none" class="resize-handle left" on:mousedown={handleResizeHandlerMouseDown}></div>

  <slot></slot>
</div>

<style lang="scss">
  :global(body:has(#stuff-sidebar-wrapper.isResizing)) {
    user-select: none;

    #stuff-sidebar-wrapper.isResizing .resize-handle {
      pointer-events: auto;
    }
  }

  :global(body:has(#stuff-sidebar-wrapper.isResizing)) {
    cursor: ew-resize !important;
  }

  #stuff-sidebar-wrapper {
    position: relative;
    width: 100%;
    max-width: var(--stuff-sidebar-width);
    height: 100%;
    overflow: hidden;
  }

  .resize-handle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 100%;

    z-index: 999999999999999999999999999;
    cursor: ew-resize;

    &.left {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;

      &:hover {
        border-radius: 2em;
      }
    }
  }
</style>
