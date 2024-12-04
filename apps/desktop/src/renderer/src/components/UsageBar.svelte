<script lang="ts">
  export let used: number
  export let total: number
</script>

<div class="wrapper">
  <div class="bar">
    <div class="used" style="width: {(used / total) * 100}%"></div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    overflow: hidden;
    border-radius: 0.5rem;
    color: var(--color-text);
  }

  .bar {
    width: 100%;
    height: 1.5rem;
    border-radius: 0.5rem;
    background: var(--color-background-light);
    overflow: hidden;
    position: relative;

    .used {
      height: 100%;
      background: var(--color-brand);
      opacity: 0.5;
      transition: width 0.3s;
    }
  }

  .text {
    margin-top: 0.5rem;
    font-size: 1rem;
  }
</style>
