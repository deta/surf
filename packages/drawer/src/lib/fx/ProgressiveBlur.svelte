<script lang="ts">
  export let blurLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5]
  export let gradientStops = [
    'rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 12.5%, rgba(0, 0, 0, 1) 25%, rgba(0, 0, 0, 0) 37.5%',
    'rgba(0, 0, 0, 0) 12.5%, rgba(0, 0, 0, 1) 25%, rgba(0, 0, 0, 1) 37.5%, rgba(0, 0, 0, 0) 50%',
    'rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 1) 37.5%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 0) 62.5%',
    'rgba(0, 0, 0, 0) 37.5%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 1) 62.5%, rgba(0, 0, 0, 0) 75%',
    'rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 1) 62.5%, rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 0) 87.5%',
    'rgba(0, 0, 0, 0) 62.5%, rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 1) 87.5%, rgba(0, 0, 0, 0) 100%',
    'rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 1) 87.5%, rgba(0, 0, 0, 1) 100%',
    'rgba(0, 0, 0, 0) 87.5%, rgba(0, 0, 0, 1) 100%'
  ]
</script>

{#each blurLevels as blur, index (index)}
  <div
    class="progressive-blur"
    style="backdrop-filter: blur({blur}px); -webkit-backdrop-filter: blur({blur}px); mask-image: linear-gradient(to left, {gradientStops[
      index
    ]}); -webkit-mask-image: linear-gradient(to left, {gradientStops[
      index
    ]}); position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: {index};"
  ></div>
{/each}

<style>
  .progressive-blur {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    /* Create a gradient that goes from transparent to a solid color */
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 100%);
    /* Apply the blur effect based on the gradient */
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    /* Make sure the effect is only applied at the bottom */
    mask-image: linear-gradient(to top, transparent, black);
    -webkit-mask-image: linear-gradient(to top, transparent, black);
  }
</style>
