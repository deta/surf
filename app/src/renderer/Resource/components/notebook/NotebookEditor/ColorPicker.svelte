<script lang="ts">
  import ColorPoint from './ColorPoint.svelte'

  export type Color = [string, string]
  let {
    colors,
    selected,
    onpick
  }: { colors: Color[]; selected?: string; onpick?: (item: Color) => void } = $props()
</script>

<div class="picker">
  {#each colors as color, i (color[0] + i)}
    <ColorPoint {color} {onpick} selected={selected === color[0]} />
  {/each}
</div>

<style>
  div.picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 28ch;
  }
</style>
