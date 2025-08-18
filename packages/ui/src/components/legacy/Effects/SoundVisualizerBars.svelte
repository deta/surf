<script lang="ts">
  export let barsCount = 4
  export let size = '100%'
  export let gap = 10
</script>

<svg class="bar-visualizer" width={size} height={size} viewBox="0 0 100 100" {...$$restProps}>
  {#each { length: barsCount } as bar, i (i)}
    <rect
      x={1 + (100 / barsCount) * i + i * gap}
      width={`${100 / (barsCount + 1)}%`}
      height="100%"
      fill="currentColor"
      stroke-width="0"
      stroke="none"
      style:--delay={i * 100 + Math.floor((Math.random() - 0.5) * 400) + 'ms'}
      style:--duration={1500 + Math.floor((Math.random() - 0.5) * 300) + 'ms'}
      ry="10"
    />
  {/each}
</svg>

<style lang="scss">
  @keyframes bar {
    from {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(0.5);
    }
    to {
      transform: scaleY(1);
    }
  }

  svg {
    rect {
      transform-origin: center center;
      animation: bar 1500s ease-in-out infinite;
      animation-delay: var(--delay, 0);
      animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
      animation-duration: var(--duration, 1500ms);
    }
  }
</style>
