<script context="module" lang="ts">
  export type TResizeDirection =
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left";
</script>

<script lang="ts">
  import type { IPositionable } from "./Positionable.svelte.js";
  import type { Vec2 } from "./types/Utils.type.js";
  import type { Writable } from "svelte/store";

  export let positionable: Writable<IPositionable<any>>;
  export let direction: TResizeDirection;
  export let minSize: Vec2<number> = { x: 0, y: 0 };
  export let maxSize: Vec2<number> = { x: Infinity, y: Infinity };

  let el: HTMLDivElement;
  let resizing = false;

  function onMouseDown(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

    el.dispatchEvent(
      new CustomEvent("resizable_onMouseDown", {
        bubbles: true,
        detail: { event: e, positionable, clientX, clientY }
      })
    );
    resizing = true;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, { once: true });
    document.addEventListener("touchmove", onMouseMove);
    document.addEventListener("touchend", onMouseUp, { once: true });
  }
  function onMouseMove(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

    el.dispatchEvent(
      new CustomEvent("resizable_onMouseMove", {
        bubbles: true,
        detail: { event: e, positionable, clientX, clientY, direction, minSize, maxSize }
      })
    );
  }
  function onMouseUp(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

    el.dispatchEvent(
      new CustomEvent("resizable_onMouseUp", {
        bubbles: true,
        detail: { event: e, positionable, clientX, clientY }
      })
    );
    el.dispatchEvent(
      new CustomEvent("resizable_end", {
        bubbles: true,
        detail: { event: e, positionable, clientX, clientY }
      })
    );

    resizing = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }
</script>

<svelte:options immutable={true} />

<div
  class="resizable {direction} {$$restProps.class || ''}"
  class:resizing
  on:mousedown={onMouseDown}
  on:touchstart={onMouseDown}
  bind:this={el}
>
  <slot />
</div>
