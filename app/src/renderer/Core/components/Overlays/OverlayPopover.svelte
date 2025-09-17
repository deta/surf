<script lang="ts">
  import { clickOutside, useLogScope } from '@deta/utils'
  import Overlay from '../Overlays/Overlay.svelte'
  import type { OverlayPopoverProps } from './types'

  let {
    open = $bindable(false),
    position = 'top',
    children,
    trigger,
    autofocus = false
  }: OverlayPopoverProps = $props()

  const log = useLogScope('OverlayPopover')

  let bounds = $state({ x: 200, y: 200, width: 300, height: 500 })

  let ref: HTMLElement

  function onClick() {
    const clientRect = ref.getBoundingClientRect()

    log.debug('Overlay position:', position, 'Trigger bounds:', clientRect)

    if (position === 'top') {
      bounds.x = Math.max(0, Math.min(clientRect.x, window.innerWidth - bounds.width))
      bounds.y = Math.max(
        0,
        Math.min(clientRect.y - clientRect.height, window.innerHeight - bounds.height)
      )
    } else if (position === 'bottom') {
      bounds.x = Math.max(0, Math.min(clientRect.x, window.innerWidth - bounds.width))
      bounds.y = Math.max(
        0,
        Math.min(clientRect.y + clientRect.height, window.innerHeight - bounds.height)
      )
    } else if (position === 'right') {
      bounds.x = Math.max(
        0,
        Math.min(clientRect.x + clientRect.width, window.innerWidth - bounds.width)
      )
      bounds.y = Math.max(0, Math.min(clientRect.y, window.innerHeight - bounds.height))
    } else if (position === 'left') {
      bounds.x = Math.max(
        0,
        Math.min(clientRect.x - clientRect.width, window.innerWidth - bounds.width)
      )
      bounds.y = Math.max(0, Math.min(clientRect.y, window.innerHeight - bounds.height))
    }

    log.debug('New overlay bounds:', bounds)

    open = !open
  }
</script>

<div class="popover-root">
  <button bind:this={ref} onclick={onClick} class="trigger ignore-click-outside">
    {@render trigger?.()}
  </button>

  {#if open}
    <div {@attach clickOutside(() => (open = false))}>
      <Overlay {bounds} {autofocus}>
        <div class="popover-content-wrapper">
          {@render children?.()}
        </div>
      </Overlay>
    </div>
  {/if}
</div>

<style lang="scss">
  .popover-content-wrapper {
    //background: white;
    //border: 1px solid #eee;
    border-radius: 12px;
    overflow: hidden;
    height: calc(100vh - 32px);
    // box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>
