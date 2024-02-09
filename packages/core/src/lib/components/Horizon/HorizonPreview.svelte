<script lang="ts">
  import type { Horizon } from '../../service/horizon'

  export let horizon: Horizon
</script>

<div class="wrapper">
  {#if horizon?.previewImageObjectURL}
    <img src={horizon.previewImageObjectURL} alt="preview" />
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    overflow: hidden;

    img {
      height: 100%;
      width: 100%;
      object-fit: cover;
    }
  }
</style>
