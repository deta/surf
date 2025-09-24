<script lang="ts">
  import { type Snippet } from "svelte"

  let {
    url,
    children,
    position,
    rotation,
    size = "20%",
    readonly = true,
  
    onmoved,
  }: {
    url?: string
    children?: Snippet
    position: [number, number] // 0-1, 0-1
    rotation: number
    size: string
    readonly?: boolean
  
    onmoved?: (e: MouseEvent) => void
  } = $props()
  
  let el: HTMLElement
  let scaling = $state(false)
  let rotating = $state(false)
  
  const onmousemoveOver = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    
    // Mouse position relative to the container
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalize to 0–1 range
    const nx = x / rect.width;
    const ny = y / rect.height;
    
    // Clamp values (in case mouse goes slightly outside)
    const clampedX = Math.max(0, Math.min(1, nx));
    const clampedY = Math.max(0, Math.min(1, ny));
    
    if (clampedY >= 0.8 && clampedX >= 0.8) {
      scaling = false
      rotating = true
    }
    else if (clampedY >= 0.8) {
      scaling = true
        rotating = false
    }
    else {
      scaling = false
      rotating = false
    }
  }

  const onpointerdown =(e: PointerEvent) => {
    e.stopPropagation()
    window.addEventListener('mousemove', onmousemove, { capture: true })
    window.addEventListener('mouseup', onmouseup, { capture: true, once: true })
  }
  
  const onmousemove = (e: MouseEvent) => {
    e.stopPropagation()
    onmoved?.(e)
  }
  const onmouseup = (e: MouseEvent) => {
    window.removeEventListener('mousemove', onmousemove, { capture: true })
  }
</script>
<!--
  src="https://i.imgur.com/db97JV7.png" 
-->
<div class="sticker" 
  bind:this={el} 
  style:--x={position[0] * 100 + '%'} 
  style:--y={position[1] * 100 + '%'} 
  style:--r={rotation + 'deg'} 
  style:--size={size} 
  class:readonly  
  class:scaling 
  class:rotating 
  {onpointerdown} 
  onmousemove={onmousemoveOver}>
  
  {#if url}
    <img 
      alt="Sticker"
      src={url}
      draggable="false" 
    />
    {:else if children}
      {@render children?.()}
  {/if}  
</div>

<style lang="scss">
  .sticker {
    --scale: 1;
    --outline-width: 1px;

    pointer-events: all;
      position: absolute;
      top: var(--y);
      left: var(--x);
      width: var(--size);
      height: auto;
      transform: translate(-50%, -50%) scale(var(--scale)) rotate(var(--r, 0deg));

    &:not(.readonly) {
      cursor: grab;

      &.rotating {
        cursor: crosshair !important;
      }
      &.scaling {
        cursor: ns-resize !important;
      }

      &:hover {
        --scale: 1.05;
      }
      &:active {
        cursor: grabbing;
        img {
          filter: 
            drop-shadow(var(--outline-width) 0 0  white)
            drop-shadow(calc(-1 * var(--outline-width)) 0 0 white)
            drop-shadow(0 var(--outline-width) 0  white)
            drop-shadow(0 calc(-1 * var(--outline-width)) 0 white)
            drop-shadow(0px 4px 2px rgba(0,0,0,0.3));
        }
      }
    }
  }
  img {
    filter:
      drop-shadow(var(--outline-width) 0 0  white)
      drop-shadow(calc(-1 * var(--outline-width)) 0 0 white)
      drop-shadow(0 var(--outline-width) 0  white)
      drop-shadow(0 calc(-1 * var(--outline-width)) 0 white);
  }
</style>

