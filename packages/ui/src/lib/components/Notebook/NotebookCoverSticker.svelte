<script lang="ts">
  let {
    url,
    position,
    rotation,
    size = "20%",
    readonly = true,
  
    onmoved,
  }: {
    url: string
    position: [number, number] // 0-1, 0-1
    rotation: number
    size: string
    readonly?: boolean
  
    onmoved?: (e: MouseEvent) => void
  } = $props()
  
  let el: HTMLImageElement
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

<img 
  bind:this={el} 
  src="https://i.imgur.com/db97JV7.png" 
  style:--x={position[0] * 100 + '%'} 
  style:--y={position[1] * 100 + '%'} 
  style:--r={rotation + 'deg'} 
  style:--size={size} 
  class:readonly  
  draggable="false" 
  class:scaling 
  class:rotating 
  {onpointerdown} 
  onmousemove={onmousemoveOver}
/>

<style>
  img {
    --scale: 1;
  
    pointer-events: all;
    position: absolute;
    top: var(--y);
    left: var(--x);
    rotate: var(--r);
    width: var(--size);
    height: auto;
    transform: translate(-50%, -50%) scale(var(--scale));
  
    
    filter:
      drop-shadow(2px 0 0  white)
      drop-shadow(-2px 0 0 white)
      drop-shadow(0 2px 0  white)
      drop-shadow(0 -2px 0 white);
  
  
    &:not(.readonly) {
      cursor: grab;
  
  
      &:hover {
        --scale: 1.05;
      }
      &:active {
        cursor: grabbing;
        filter: 
          drop-shadow(2px 0 0  white)
          drop-shadow(-2px 0 0 white)
          drop-shadow(0 2px 0  white)
          drop-shadow(0 -2px 0 white)
          drop-shadow(0px 4px 2px rgba(0,0,0,0.3));
      }
    }
  
    &.scaling {
      cursor: ns-resize !important;
    }
    &.rotating {
      cursor: crosshair !important;
    }
  }
</style>

