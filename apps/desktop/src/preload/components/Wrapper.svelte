<script lang="ts">
  export let expanded: boolean = false
  export let elem: HTMLElement | null = null
</script>

<div bind:this={elem} class="wrapper deta-component-wrapper" class:expanded>
  <slot></slot>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 12px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
    border: 1px solid #f0f0f0;
    user-select: none;
    font-size: 15px;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      sans-serif;
    max-width: 100%;

    &.expanded {
      width: 90vw;
    }
  }
</style>
