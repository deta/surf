<div class="drawer-content-item">
  <slot />
</div>

<style lang="scss">
  .drawer-content-item {
    width: calc(50% - 0.5rem);
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    overflow: hidden;
  }
</style>
