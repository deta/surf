<script context="module" lang="ts">
  export type IPositionable<KeyName extends string> = {
    pos_x: number;
    pos_y: number;
    width: number;
    height: number;
  } & {[P in KeyName]: string};
</script>

<script lang="ts">
  import { getContext, onDestroy, onMount, setContext } from "svelte";
  import type { Writable } from "svelte/store";
  import type { Vec2, Vec4 } from "./types/Utils.type.js";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";
  import { isBrowser, snapToGrid } from "./utils.js";
  import type { Tweened } from "svelte/motion";
  import { scale } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";

  // export let positionable: IPositionable;
  export let key: string;
  export let x: number;
  export let y: number;
  export let width: number;
  export let height: number;
  export let zIndex: number | undefined = undefined;
  export let preTransform: string | null = null;
  export let postTransform: string | null = null;

  let htmlEl: HTMLDivElement;
  const board = getContext<IBoard>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");
  const stackingOrder = getContext<Writable<string>>("stackingOrder");

  // $: ({ posX, posY, width, height } = positionable);
  // $: key = positionable[$settings.POSITIONABLE_KEY]; // todo: fix dis type

  let state = board.state;
  $: ({ viewPort, selection } = $state);
  $: ({ x: viewX, y: viewY } = $state.viewOffset);
  $: ({ zoom } = $state);
  $: z =
    zIndex !== undefined
      ? zIndex
      : $stackingOrder.indexOf(key) === -1
      ? 0
      : $stackingOrder.indexOf(key);

  $: transformCss = `transform: ${preTransform || ""} translate3d(${x}px, ${y}px, 0) ${
    postTransform || ""
  }; width: ${width}px; height: ${height}px; z-index: ${z};`;

  let dragging = false;

  // Handlers
  function onDraggableMove(e: CustomEvent<{ key: string, x: number, y: number, width: number, height: number }>) {
    //e.stopPropagation();
    // const { key, x: newPosX, y: newPosY } = e.detail;
    // x = newPosX;
    // x = newPosY; // todo: prob from chunk stuff -> use context to figure if in chunked mode
  }
  function onResizableChanged(e: CustomEvent<{ key: string, x: number, y: number, width: number, height: number }>) {
    e.stopPropagation();
    x = e.detail.x;
    y = e.detail.y;
    width = e.detail.width;
    height = e.detail.height;
  }
  // function onDraggableMoveEnd(e: CustomEvent<{ key: string, initChunk: Vec2<number>, newPos: Vec2<number> }>) {
  //   const { newPos } = e.detail;
  //   posX = newPos.x;
  //   posY = newPos.y;
  // }

  function onDraggableMoveStart(e: CustomEvent) {
    dragging = true;
  }
  function onDraggableMoveEnd(e: CustomEvent) {
    dragging = false;
    x = $settings.SNAP_TO_GRID ? snapToGrid(x, $settings.GRID_SIZE!) : x;
    y = $settings.SNAP_TO_GRID ? snapToGrid(y, $settings.GRID_SIZE!) : y;
    width = $settings.SNAP_TO_GRID ? snapToGrid(width, $settings.GRID_SIZE!) : width;
    height = $settings.SNAP_TO_GRID ? snapToGrid(height, $settings.GRID_SIZE!) : height;
  }
  function onResizableMoveEnd(e: CustomEvent) {
    width = $settings.SNAP_TO_GRID ? snapToGrid(width, $settings.GRID_SIZE!) : width;
    height = $settings.SNAP_TO_GRID ? snapToGrid(height, $settings.GRID_SIZE!) : height;
  }

  onMount(() => {
    htmlEl.addEventListener("draggable_move_start", onDraggableMoveStart);
    htmlEl.addEventListener("draggable_move_end", onDraggableMoveEnd);
    htmlEl.addEventListener("draggable_move", onDraggableMove);
    htmlEl.addEventListener("resizable_change", onResizableChanged);
    htmlEl.addEventListener("resizable_move_end", onResizableMoveEnd);
    // htmlEl.addEventListener("draggable_move_end", onDraggableMoveEnd);
  });
  onDestroy(() => {
    htmlEl && htmlEl.removeEventListener("draggable_move_start", onDraggableMoveStart);
    htmlEl && htmlEl.removeEventListener("draggable_move_end", onDraggableMoveEnd);
    htmlEl && htmlEl.removeEventListener("draggable_move", onDraggableMove);
    htmlEl && htmlEl.removeEventListener("resizable_change", onResizableChanged);
    htmlEl && htmlEl.removeEventListener("resizable_move_end", onResizableMoveEnd);
  });
</script>

<!-- transition:scale={{ duration: 120, opacity: 0, start: 0.8, easing: cubicInOut}} -->
<svelte:element
  this="div"
  {...$$restProps}
  class="positionable {$selection.has(key) ? 'selected' : ''} {$$restProps.class || ''}"
  class:dragging
  style="{transformCss} {$$restProps.style || ''}"
  bind:this={htmlEl}
>
  <!-- {#if $zoom > 0.6} -->
  <slot />
  <!-- {/if} -->
</svelte:element>

<style>
  .positionable {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;

    /* transform-style: preserve-3d;
    backface-visibility: hidden; */
  }
</style>
