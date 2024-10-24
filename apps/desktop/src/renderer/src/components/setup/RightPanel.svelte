<script>
  export let expanded = false
  export let gradient = true
</script>

<div class="right-panel" class:expanded class:gradient>
  <slot></slot>
</div>

<style lang="scss">
  .right-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: calc(100% - 420px);
    height: 100%;
    background-color: #f8f9fa;
    padding: 2rem;
    border-right: 1px solid #ccc;
    text-align: left;
    border-left: 0.5px solid rgba(0, 0, 0, 0.09);
    border-left: 0.5px solid color(display-p3 0 0 0 / 0.09);
    transition: width 0.3s ease;

    &.expanded {
      width: 100%;
    }

    &.gradient {
      background: linear-gradient(180deg, #39a1fb 0%, #b4dcff 100%);
      background: linear-gradient(
        180deg,
        color(display-p3 0.3445 0.6242 0.9564) 0%,
        color(display-p3 0.7368 0.8571 1) 100%
      );
    }
  }
</style>
