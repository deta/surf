<script lang="ts">
  export let height = '130px'
</script>

<div class="loading-box" style="height: {height};"></div>

<style lang="scss">
  .loading-box {
    width: 100%;
    background: rgba(255, 255, 255, 0);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      background: rgba(255, 255, 255, 0);
    }
    50% {
      background: rgba(255, 255, 255, 0.25);
    }
    100% {
      background: rgba(255, 255, 255, 0);
    }
  }
</style>
