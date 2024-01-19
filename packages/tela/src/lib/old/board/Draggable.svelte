<script lang="ts">
  import type { TBoard } from "$lib/types/Board.type.js";
  import type { Vec2 } from "$lib/types/Utils.type.js";
  import { createEventDispatcher } from "svelte";
  import type { Writable } from "svelte/store";

  export let pos: Vec2, board: Writable<TBoard>, wc: boolean;

  const dispatch = createEventDispatcher();
  let el: HTMLElement;

  let dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  function onMouseDown(e: MouseEvent) {
    wc = true;
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

    pos.x += dragState.offset.x;
    pos.y += dragState.offset.y;

    // $activeBoard.viewOffset = {
    //   x: $activeBoard.viewOffset.x + dragState.offset.x,
    //   y: $activeBoard.viewOffset.y + dragState.offset.y
    // };
  }

  function onMouseUp(e: MouseEvent) {
    wc = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    dispatch("dragEnd", { pos });
  }
</script>

<svelte:element
  this="div"
  bind:this={el}
  on:mousedown={onMouseDown}
  {...$$restProps}
  class="draggable {$$restProps.class}"
>
  <slot />
</svelte:element>

<style>
  div.draggable {
  }
</style>
