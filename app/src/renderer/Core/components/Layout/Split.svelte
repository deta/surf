<script lang="ts">
  import { type Snippet } from 'svelte'

  let { left, right }: { left?: Snippet; right?: Snippet } = $props()
</script>

<div class="wrapper">
  <div class="side left">
    {@render left?.()}
  </div>

  <div class="side right">
    {@render right?.()}
  </div>
</div>

<style>
  .wrapper {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .side {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .left {
    border-right: 1px solid
      light-dark(
        var(--border-subtle, var(--border-color, rgba(0, 0, 0, 0.1))),
        var(--border-subtle-dark, rgba(148, 163, 184, 0.35))
      );
  }

  .right {
    border-left: 1px solid
      light-dark(
        var(--border-subtle, var(--border-color, rgba(0, 0, 0, 0.1))),
        var(--border-subtle-dark, rgba(148, 163, 184, 0.35))
      );
  }
</style>
