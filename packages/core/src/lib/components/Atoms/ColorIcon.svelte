<script lang="ts">
  export let colors: [string, string]
  export let size: string = '100%'
  export let style: string = ''

  $: minSize = size === '100%' ? '1.25rem' : size
</script>

<div
  class="color-icon"
  on:click
  style="--color1: {colors[0]}; --color2: {colors[1]}; --size: {size}; --min-size: {minSize}; {style}"
  role="none"
></div>

<style lang="scss">
  .color-icon {
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    aspect-ratio: 1 / 1;
    min-width: var(--min-size);
    min-height: var(--min-size);
    border-radius: 50%;
    background: radial-gradient(
        95% 95% at 50% 10%,
        rgba(255, 255, 255, 0.5) 0%,
        rgba(0, 0, 0, 0.5) 100%
      ),
      linear-gradient(180deg, var(--color1) 0%, var(--color2) 100%);
    background: radial-gradient(
        97.6% 97.6% at 50% 10.9%,
        color(display-p3 1 1 1 / 0.5) 0%,
        color(display-p3 0 0 0 / 0.5) 100%
      ),
      linear-gradient(180deg, var(--color1) 0%, var(--color2) 100%);
    background-blend-mode: soft-light, normal;
    box-shadow:
      0px -0.3px 0.6px 0px rgba(0, 0, 0, 0.15),
      0px -1.25px 1.8px 0px rgba(0, 0, 0, 0.05) inset,
      0px 0.9px 0.6px 0px rgba(255, 255, 255, 0.3) inset,
      0px -1.5px 2px 0px rgba(255, 255, 255, 0.09) inset,
      0px -1.5px 4px 0px rgba(0, 0, 0, 0.15) inset;
    box-shadow:
      0px -0.3px 0.6px 0px color(display-p3 0 0 0 / 0.15),
      0px -1.25px 1.8px 0px color(display-p3 0 0 0 / 0.05) inset,
      0px 0.9px 0.6px 0px color(display-p3 1 1 1 / 0.3) inset,
      0px -1.5px 2px 0px color(display-p3 0 0 0/ 0.09) inset,
      0px -1.5px 4px 0px color(display-p3 0 0 0 / 0.15) inset;
  }
</style>
