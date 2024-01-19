<script lang="ts">
  import { getContext } from "svelte";
  import type { Writable } from "svelte/store";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";

  export let dotColor = "black";
  export let dotOpacity = 30;
  export let dotSize = 1;

  const board = getContext<IBoard<any, any>>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");
  const GRID_SIZE = $settings.GRID_SIZE;

  const state = board.state;
  const viewport = $state.viewPort;
  const viewOffset = $state.viewOffset;
  const zoom = $state.zoom;

  $: transformCss = `width: ${$viewport.w / $zoom}px; height: ${
    $viewport.h / $zoom
  }px; transform: translate3d(-${dotSize}px, -${dotSize}px, 0) translate3d(${
    $viewOffset.x - ($viewOffset.x % GRID_SIZE)
  }px, ${$viewOffset.y - ($viewOffset.y % GRID_SIZE)}px, 0);`;

  // $: svgShiftCss = `transform: translate3d(-${$viewX % GRID_SIZE}px, 0px, 0);`;
</script>

<div class="grid" style={transformCss}>
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <pattern
      id="dotGrid"
      x="0"
      y="0"
      width={$settings.GRID_SIZE}
      height={$settings.GRID_SIZE}
      patternUnits="userSpaceOnUse"
    >
      <circle cx={dotSize} cy={dotSize} r={dotSize} fill={dotColor} fill-opacity="{dotOpacity}%" />
    </pattern>

    <!-- Left square with user space tiles -->
    <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" />
  </svg>
</div>

<style>
  .grid {
    position: relative;
    z-index: -1; /* we dont set it -1 intentionally so that elements not in the stacking order are not clickable -> TODO: maybe this is not wanted */
    will-change: transform;
    contain: strict;
    pointer-events: none;
  }
  .grid > svg {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
