<script lang="ts">
  import { onMount } from 'svelte'

  export let caption = null

  let figure: HTMLElement | null = null
  let captionElem: HTMLElement | null = null // Add a reference to the caption element to measure its width
  let captionStyle = { x: 0, y: 0, opacity: 0, transform: '' }
  let lastY = 0
  let lastTime = 0
  let velocityY = 0
  let rotation = 0

  onMount(() => {
    if (figure) {
      figure.addEventListener('mousemove', handleMouseMove)
      figure.addEventListener('mouseenter', () => {
        captionStyle.opacity = 1
      })
      figure.addEventListener('mouseleave', handleMouseLeave)
    }
  })

  const handleMouseMove = (event: MouseEvent) => {
    const now = performance.now()
    const timeDiff = now - lastTime
    const rect = figure!.getBoundingClientRect()
    let offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top

    // Prevent the caption from overflowing the figure boundaries
    const maxOffsetX = rect.width - captionElem!.offsetWidth
    if (offsetX > maxOffsetX) offsetX = maxOffsetX

    captionStyle.x = offsetX
    captionStyle.y = offsetY - 20 // Adjust Y position slightly above the cursor

    // Calculate rotation velocity
    if (lastTime !== 0) {
      velocityY = (offsetY - lastY) / timeDiff
      rotation = velocityY * -5 // Adjust multiplier for sensitivity
    }

    captionStyle.transform = `rotate(${rotation}deg)`

    lastY = offsetY
    lastTime = now
  }

  const handleMouseLeave = () => {
    captionStyle.opacity = 0
    captionStyle.transform = ''
  }
</script>

<div class="figure" bind:this={figure}>
  <slot name="content" />
  <div
    bind:this={captionElem}
    class="caption"
    style={`left: ${captionStyle.x}px; top: ${captionStyle.y + (caption ? 0 : 60)}px; opacity: ${captionStyle.opacity}; transform: ${captionStyle.transform}; 
    z-index: 2147483647;
    `}
  >
    {#if caption}
      {caption}
    {:else}
      <div class="border-gray-300 border-opacity-50 shadow-lg shadow-gray-300 rounded-md">
        <slot name="caption" />
      </div>
    {/if}
  </div>
</div>

<style>
  .figure {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .caption {
    position: absolute;
    background-color: white;
    padding: 5px 10px;
    font-size: 10px;
    color: #2d2d2d;
    border-radius: 4px;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      opacity 0.2s ease-out,
      transform 0.1s linear;
    will-change: opacity, transform;
  }
</style>
