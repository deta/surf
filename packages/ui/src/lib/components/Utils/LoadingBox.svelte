<script lang="ts">
  export let height = '130px'
</script>

<div class="loading-box" style="height: {height};"></div>

<style lang="scss">
  .loading-box {
    width: 100%;
    background: light-dark(rgba(255, 255, 255, 0), rgba(15, 23, 42, 0));
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      background: light-dark(rgba(255, 255, 255, 0), rgba(15, 23, 42, 0));
    }
    50% {
      background: light-dark(rgba(255, 255, 255, 0.25), rgba(148, 163, 184, 0.2));
    }
    100% {
      background: light-dark(rgba(255, 255, 255, 0), rgba(15, 23, 42, 0));
    }
  }
</style>
