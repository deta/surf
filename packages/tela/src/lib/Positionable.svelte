<script context="module" lang="ts">
  export type IPositionable<KeyName extends string> = {
    x: number;
    y: number;
    width: number;
    height: number;
    z?: number;
    readonly hoisted?: boolean;
  } & { [P in KeyName]: string };
</script>

<script lang="ts">
  import { getContext, onDestroy, onMount } from "svelte";
  import type { Writable } from "svelte/store";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";
  import { scale } from "svelte/transition";
  import { cubicInOut } from "svelte/easing";

  type T = $$Generic<IPositionable<any>>;
  export let positionable: Writable<T>;
  /**
   * Sets the `contain: strict;` property, resulting in better performance for a large number of elements,
   * but prevents card content overflowing the card.
   */
  export let contained: boolean = true;
  export let el: HTMLElement;

  const board = getContext<IBoard<any, any>>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");
  const POSITIONABLE_KEY = $settings.POSITIONABLE_KEY;

  const state = board.state;
  const selection = $state.selection;
  const stackingOrder = $state.stackingOrder;

  let dragging = false;

  $: transformCss = `left: ${$positionable.x}px; top: ${$positionable.y}px; width: ${$positionable.width}px; height: ${$positionable.height}px; z-index: ${$positionable.z !== undefined ? $positionable.z : $stackingOrder.indexOf($positionable[POSITIONABLE_KEY])}; contain-intrinsic-size: ${$positionable.width}px ${$positionable.height}px; ${contained ? 'contain: strict;' : ''}`;
  // $: transformCss = `left: ${$positionable.x - (Math.floor($positionable.x / CHUNK_WIDTH) * CHUNK_WIDTH)}px; top: ${$positionable.y  - (Math.floor($positionable.y / CHUNK_HEIGHT) * CHUNK_HEIGHT)}px; width: ${$positionable.width}px; height: ${$positionable.height}px; z-index: ${$positionable.key !== undefined ? $positionable.key : 0};`; // ${!visible ? 'display: none;' : ''} ${!visible ? 'content-visibility: hidden;' : ''}
  // $: transformCss = `left: 0; top: 0;transform: translate3d(${$positionable.x}px, ${$positionable.y}px, 0) scale(${$state.zoom}); width: ${$positionable.width}px; height: ${$positionable.height}px; z-index: ${$positionable.key !== undefined ? $positionable.key : 0};`;

  function onDraggableStart() { dragging = true; }
  function onDraggableEnd() { dragging = false; }

  onMount(() => {
    el.addEventListener("draggable_start", onDraggableStart);
    el.addEventListener("draggable_end", onDraggableEnd);
  })
  onDestroy(() => {
    el && el.removeEventListener("draggable_start", onDraggableStart);
    el && el.removeEventListener("draggable_end", onDraggableEnd);
  })
</script>

<!-- TODO: For Readonly mode, custom immutable version of this cmp -->
<!-- <svelte:options immutable={true} /> -->

<!-- transition:scale={{ duration: 100, opacity: 0, start: 0.8, easing: cubicInOut }} -->
<div
  data-key={$positionable[POSITIONABLE_KEY]}
  {...$$restProps}
  style="{transformCss} {$$restProps.style || ''}"
  class="positionable {$$restProps.class || ''}"
  class:selected={$selection.has($positionable[POSITIONABLE_KEY])}
  class:hoisted={$positionable.hoisted}
  class:dragging

  bind:this={el}
>
  <slot />
</div>

<style>
  div {
    position: absolute;
    top: 0;
    left: 0;
    /* will-change: left, top, width, height; */
    will-change: transform;
    /* transform: translateZ(0); */
    backface-visibility: hidden;
    /* content-visibility: auto; */
    /* contain: style layout paint; */
    /* contain: strict; */ /* TODO: This should maybe be a cfg, for perf needs, but not reuired */
  }
</style>
