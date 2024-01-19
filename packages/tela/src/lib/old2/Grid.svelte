<script lang="ts">
  import { getContext } from "svelte";
  import type { Writable } from "svelte/store";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";

  export let dotColor = "black";
  export let dotOpacity = 30;
  export let dotSize = 1;

  const board = getContext<IBoard>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");

  const state = board.state;
  let viewX = $state.viewOffset.x;
  let viewY = $state.viewOffset.y;
  let zoom = $state.zoom;

  // $: transformCss = `transform: translate(${$board.viewOffset.x}px, ${$board.viewOffset.y}px);`;
  $: transformCss = `width: ${100 / $zoom}%; height: ${
    100 / $zoom
  }%; transform: translate3d(-${dotSize}px, -${dotSize}px, 0) translate3d(${
    $viewX - ($viewX % $settings.GRID_SIZE!)
  }px, ${$viewY - ($viewY % $settings.GRID_SIZE!)}px, 0);`;

  $: svgShiftCss = `transform: translate3d(-${
    $viewX % $settings.GRID_SIZE!
  }px, 0px, 0);`;
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
    min-height: 100%;
    z-index: -1; /* we dont set it -1 intentionally so that elements not in the stacking order are not clickable -> todo: maybe this is not wanted */
  }
  .grid > svg {
    position: absolute;
    top: 0;
    left: 0;
  }
</style>
