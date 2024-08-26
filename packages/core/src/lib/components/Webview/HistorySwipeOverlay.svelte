<script lang="ts">
  import { tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { fade, fly } from 'svelte/transition'

  export let direction: 'left' | 'right' = 'left'
  export let progress: number = 0
  export let threshold: number = 100
  export let lightMode: boolean = false
  export let sensitivity: number = 6

  let highlightWidth = tweened(0, {
    duration: 50,
    easing: cubicOut
  })

  $: {
    highlightWidth.set(Math.min(progress / threshold, 1) * 100)
  }

  $: arrowPosition = direction === 'left' ? 'right' : 'left'

  const circleRadius = 36
  const circumference = 2 * Math.PI * circleRadius

  $: adjustedProgress = 1 - Math.pow(1 - $highlightWidth / 100, sensitivity)
  $: strokeDashoffset = circumference - adjustedProgress * circumference

  $: ringColor = lightMode ? '#333333' : '#ffffff'

  let visible = false
  $: if (progress > 0 && !visible) visible = true
</script>

{#if visible}
  <div class="swipe-indicator-container" in:fade={{ duration: 200 }}>
    <div
      class="arrow-container"
      style="{arrowPosition}: 1rem;"
      in:fly={{ x: direction === 'left' ? 100 : -100, duration: 500, easing: cubicOut }}
    >
      <svg class="progress-ring" width="100" height="100">
        <circle
          class="progress-ring__background"
          stroke={lightMode ? '#e0e0e0' : '#333333'}
          stroke-width="4"
          fill="rgba(128, 128, 128, 0.8)"
          r={circleRadius}
          cx="50"
          cy="50"
        />
        <circle
          class="progress-ring__circle"
          stroke={ringColor}
          stroke-width="4"
          fill="transparent"
          r={circleRadius}
          cx="50"
          cy="50"
          style="stroke-dasharray: {circumference}; stroke-dashoffset: {strokeDashoffset}"
        />
      </svg>
      <div class="arrow-circle">
        <svg
          class="arrow"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {#if direction === 'left'}
            <path
              d="M9 18L15 12L9 6"
              stroke={ringColor}
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {:else}
            <path
              d="M15 18L9 12L15 6"
              stroke={ringColor}
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/if}
        </svg>
      </div>
    </div>
  </div>
{/if}

<style>
  .swipe-indicator-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  }
  .arrow-container {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    width: 100px;
    height: 100px;
  }
  .progress-ring {
    transform: rotate(-90deg);
    position: absolute;
  }
  .progress-ring__circle {
    transition: stroke-dashoffset 0.1s ease-out;
  }
  .arrow-circle {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
  }
  .arrow {
    transition: transform 0.1s ease-out;
  }
</style>
