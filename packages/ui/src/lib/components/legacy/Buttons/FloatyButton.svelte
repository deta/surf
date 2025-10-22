<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Icon } from '@deta/icons'

  // Props with default configuration
  export let config = {
    attractionThreshold: 60,
    snapThreshold: 50,
    friction: 0.25,
    attraction: 0.05,
    maxVelocity: 12,
    movementScale: 1.15,
    scaleFactor: 1.075
  }

  export let text: string = ''
  export let icon: string | undefined = undefined
  export let onClick: () => void = () => {}

  // Optional class name prop
  export let class_name = ''

  let button: HTMLElement
  let frame: number
  let velocityX = 0
  let velocityY = 0
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0
  let currentScale = 1
  let targetScale = 1

  function updateButtonPosition() {
    const dx = targetX - currentX
    const dy = targetY - currentY

    velocityX += dx * config.attraction
    velocityY += dy * config.attraction

    velocityX *= config.friction
    velocityY *= config.friction

    if (Math.abs(velocityX) < 0.01) velocityX = 0
    if (Math.abs(velocityY) < 0.01) velocityY = 0

    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY)
    if (speed > config.maxVelocity) {
      velocityX = (velocityX / speed) * config.maxVelocity
      velocityY = (velocityY / speed) * config.maxVelocity
    }

    currentX += velocityX
    currentY += velocityY

    // Smooth scale transition
    currentScale += (targetScale - currentScale) * 0.2

    button.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`

    frame = requestAnimationFrame(updateButtonPosition)
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = button.getBoundingClientRect()
    const buttonCenterX = rect.left + rect.width / 2
    const buttonCenterY = rect.top + rect.height / 2

    const deltaX = e.clientX - buttonCenterX
    const deltaY = e.clientY - buttonCenterY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance < config.attractionThreshold) {
      const strength =
        distance < config.snapThreshold
          ? 0.8
          : 1 -
            (distance - config.snapThreshold) / (config.attractionThreshold - config.snapThreshold)

      targetX = deltaX * strength * config.movementScale
      targetY = deltaY * strength * config.movementScale

      targetScale =
        distance < config.snapThreshold
          ? config.scaleFactor
          : 1 + (config.scaleFactor - 1) * (1 - distance / config.attractionThreshold)
    } else {
      targetX = 0
      targetY = 0
      targetScale = 1
    }
  }

  function handleMouseLeave() {
    targetX = 0
    targetY = 0
    targetScale = 1
  }

  function handleClick(e: MouseEvent) {
    e.stopImmediatePropagation()
    onClick()
  }

  onMount(() => {
    button.addEventListener('mousemove', handleMouseMove)
    button.addEventListener('mouseleave', handleMouseLeave)
    frame = requestAnimationFrame(updateButtonPosition)
  })

  onDestroy(() => {
    button.removeEventListener('mousemove', handleMouseMove)
    button.removeEventListener('mouseleave', handleMouseLeave)
    cancelAnimationFrame(frame)
  })
</script>

<button
  bind:this={button}
  class={`magnetic-button ${class_name}`}
  on:click={handleClick}
  style={`transform: translate(${currentX}px, ${currentY}px) scale(${currentScale})`}
>
  {#if icon}
    <Icon name={icon} size="16px" />
  {/if}
  {#if text}
    <span>{text}</span>
  {:else}
    <slot />
  {/if}
</button>

<style lang="scss">
  .magnetic-button {
    position: relative;
    padding: 0.75rem 1.5rem;
    color: black;
    cursor: pointer;
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    background: paint(squircle) !important;
    --squircle-radius: 18px;
    --squircle-smooth: 0.33;
    --squircle-shadow: 0px 2px 2px -1px var(--black-09);
    --squircle-inner-shadow: inset 0px 3px 4px -1px var(--ring-color-shade),
      inset 0px 1.25px 0px -1.25px var(--white-60), inset 1.25px 0px 0px -1.25px var(--white-60),
      inset -1.25px 0px 0px -1.25px var(--white-60), inset 0px -1.25px 0px -1.25px var(--white-60);
    --squircle-fill: white;

    will-change: transform;
    transform: translate(0, 0) scale(1);
    white-space: nowrap;
    z-index: 1000;

    :global(.dark) & {
      --squircle-fill: var(--ring-color) !important;
      --squircle-inner-shadow: none;
      color: white;
    }

    :global(.custom) & {
      --squircle-fill: color-mix(in hsl, var(--base-color), hsl(0, 80%, 90%)) !important;
    }

    :global(.custom.dark) & {
      --squircle-fill: color-mix(in hsl, var(--base-color), hsl(0, 80%, 0%)) !important;
    }
    & > * {
      cursor: pointer;
    }
    &:hover {
      --squircle-shadow: 0px 3px 2px -1px var(--black-09);
      color: var(--contrast-color);
    }
  }
</style>
