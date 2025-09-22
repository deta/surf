<script lang="ts">
  import { type Color } from './ColorPicker.svelte'

  let {
    selected = false,
    color,
    onpick
  }: { selected?: boolean; color: Color; onpick?: (item: Color) => void } = $props()
</script>

<button
  style:--color={`${color[0]}`}
  style:--color-fallback={`${color[1]}`}
  onclick={() => onpick?.(color)}
  class:selected
>
</button>

<style lang="scss">
  button {
    --border-color-fallback: color-mix(in oklch, var(--color-fallback), black 10%);
    --inset-color-fallback: color-mix(in oklch, var(--color-fallback), transparent 100%);

    --border-color: color-mix(in oklch, var(--color), black 10%);
    --inset-color: color-mix(in oklch, var(--color), transparent 100%);
    --size: 2rem;

    width: var(--size);
    height: var(--size);
    aspect-ratio: 1 / 1;
    background: #fff;
    border: 2px solid;
    border-color: var(--border-color-fallback);
    border-color: var(--border-color);

    box-shadow: inset 0 0 0 2px var(--inset-color-fallback);
    box-shadow: inset 0 0 0 2px var(--inset-color);
    border-radius: 1rem;

    background: var(--color-fallback);
    background: var(--color);

    transition-property: border, box-shadow;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    &.selected {
      --border-color: color-mix(in oklch, var(--color-fallback), black 10%);
      --inset-color: #fff;
    }
    &:hover:not(.selected) {
      --border-color: #fff;

      --inset-color: color-mix(in oklch, var(--color-fallback), black 10%);
    }
  }
</style>
