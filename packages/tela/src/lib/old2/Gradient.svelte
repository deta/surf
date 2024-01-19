<script lang="ts">
  import { getContext } from "svelte";
  import type { Writable } from "svelte/store";
  import type { TBoard } from "./types/Board.type.js";

  const board = getContext<Writable<TBoard>>("board");

    // todo: FIX

  $: transformCss = `width: ${100 / $board.zoom}%; height: ${
    100 / $board.zoom
  }%; transform: translate(${
    $board.viewOffset.x
  }px, ${$board.viewOffset.y}px);`;

  $: backgroundCss = `background: repeating-linear-gradient(90deg, red, lime, red, lime); background-size: ${50 / $board.zoom}% ${50 / $board.zoom}%; background-position: ${Math.abs($board.viewOffset.x % 100)}% ${Math.abs($board.viewOffset.y % 100)}%;`;
</script>

<div style="{transformCss} {backgroundCss}">
  {Math.abs($board.viewOffset.x % 100)}
  </div>

<style>
  div {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
  }
</style>
