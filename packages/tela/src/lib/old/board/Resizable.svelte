<script lang="ts">
  import type { TBoard } from "$lib/types/Board.type.js";
  import type { Vec2 } from "$lib/types/Utils.type.js";
  import { createEventDispatcher } from "svelte";
  import type { Writable } from "svelte/store";

  export let pos: Vec2, size: Vec2, board: Writable<TBoard>;

  const dispatch = createEventDispatcher();

  let dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  function onMouseDown(e: MouseEvent) {
    dragState.init = { x: e.clientX, y: e.clientY };
    dragState.curr = { x: e.clientX, y: e.clientY };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    dragState.offset = {
      x: (e.clientX - dragState.curr.x) / $board.zoom,
      y: (e.clientY - dragState.curr.y) / $board.zoom
    };

    dragState.curr = { x: e.clientX, y: e.clientY };

    size.x += dragState.offset.x;
    size.y += dragState.offset.y;

    // $activeBoard.viewOffset = {
    //   x: $activeBoard.viewOffset.x + dragState.offset.x,
    //   y: $activeBoard.viewOffset.y + dragState.offset.y
    // };
  }

  function onMouseUp(e: MouseEvent) {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    dispatch("resizeEnd", { pos });
  }
</script>

<svelte:element
  this="div"
  on:mousedown={onMouseDown}
  {...$$restProps}
  class="resizable {$$restProps.class}"
/>

<style>
  .resizable {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 15px;
    height: 15px;
    cursor: nwse-resize;
  }
</style>
