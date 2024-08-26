<script lang="ts">
  export let direction: 'left' | 'right' = 'left'
  export let progress: number = 0
  export let threshold: number

  $: highlightWidth = Math.min(progress / threshold, 1) * 100
  $: highlightPosition = direction === 'left' ? 'right' : 'left'
</script>

<div class="swipe-indicator {highlightPosition}" style="width: {highlightWidth}%"></div>

<style>
  .swipe-indicator {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 0;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.5));
    pointer-events: none;
    z-index: 1000;
    transition: width 0.1s ease-out;
  }

  .swipe-indicator.left {
    left: 0;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.5), transparent);
  }

  .swipe-indicator.right {
    right: 0;
  }
</style>
