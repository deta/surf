<script>
  export let expanded = false
</script>

<div class="left-panel" class:expanded={!expanded}>
  <slot></slot>
</div>

<style lang="scss">
  .left-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 420px;
    height: 100%;
    background-color: #f8f9fa;
    padding: 3rem 4rem 3rem 3rem;
    border-right: 1px solid #ccc;
    text-align: left;
    transition: transform 0.3s ease-in-out;

    &:not(.expanded) {
      transform: translateX(-100%);
    }
  }
</style>
