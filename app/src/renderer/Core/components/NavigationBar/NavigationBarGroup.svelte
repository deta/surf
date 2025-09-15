<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    fullWidth = false,
    slim = false,
    shrink = false,
    children,
    ...restProps
  }: { fullWidth?: boolean; slim?: boolean; shrink?: boolean; children?: Snippet } = $props()
</script>

<div
  {...restProps}
  class="group {restProps['class'] ?? ''}"
  class:slim
  class:fullWidth
  class:shrink
>
  {@render children?.()}
</div>

<style lang="scss">
  .group {
    display: flex;
    align-items: center;
    flex-shrink: 1;
    &.shrink {
      min-width: 0;
    }

    &.fullWidth {
      width: 100%;
    }

    // Smol trick to make the back & forwards buttons visually more balanced
    &.slim {
      :global([data-button-root]:first-child) {
        margin-right: -1.5px;
      }
      :global([data-button-root]:last-child) {
        margin-left: -1.5px;
      }
    }
  }
</style>
