<script lang="ts">
  export let draggable = true
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div {draggable} on:dragstart class="drawer-item">
  <slot />
</div>

<style lang="scss">
  .drawer-item {
    display: block;
    width: 100%;
    height: min-content;
  }
</style>
