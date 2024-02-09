<script lang="ts">
  import type { Horizon } from '../../service/horizon'

  export let horizon: Horizon
</script>

<div class="wrapper">
  {#if horizon?.previewImageObjectURL}
    <img src={horizon.previewImageObjectURL} alt="preview" />
  {:else}
    <div class="empty">
      <svg xmlns="http://www.w3.org/2000/svg" fill="var(--color-text)" fill-opacity="30%">
        <pattern id="dotGrid2" x="0" y="0" width="15" height="15" patternUnits="userSpaceOnUse">
          <circle
            cx="var(--scale)"
            cy="var(--scale)"
            r={1}
            fill="var(--color-text)"
            fill-opacity="30%"
          />
        </pattern>

        <!-- Left square with user space tiles -->
        <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid2)" />
      </svg>
    </div>
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

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      background-color: #fff;
    }

    svg {
      height: 100%;
      width: 100%;

      pattern {
        height: calc(30 * var(--scale));
        width: calc(30 * var(--scale));

        circle {
          cx: var(--scale);
          cy: var(--scale);
        }
      }
    }

    // svg {
    //     height: calc(100% / var(--scale));
    //     width: calc(100% / var(--scale));
    //     transform: scale(var(--scale));
    // }
  }
</style>
