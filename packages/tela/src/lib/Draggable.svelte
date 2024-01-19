<svelte:options immutable={true} />

<script lang="ts">
  import { isTagsOrParentWithTags } from "./utils.js";
  import type { Writable } from "svelte/store";
  import type { IPositionable } from "./Positionable.svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let positionable: Writable<IPositionable<any>>;

  let el: HTMLDivElement;
  let dragging = false;
  let holdTimer: number | null = null;
  // const dragInit = { x: 0, y: 0 };
  // const dragOffset = { x: 0, y: 0 };

  // TODO: ignore input, button, textarea, select, option, a, iframe

  // UI Handlers
  function onMouseDown(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

    if (isTagsOrParentWithTags(target as HTMLElement, [
      "INPUT",
      "BUTTON",
      "TEXTAREA",
      "SELECT",
      "OPTION",
      "A",
      "IFRAME"
    ])) return;

    // dragInit.x = clientX;
    // dragInit.y = clientY;

    document.addEventListener("mouseup", onMouseUp, { once: true });
    document.addEventListener("touchend", onMouseUp, { once: true });
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("touchmove", onMouseMove);

    holdTimer = setTimeout(() => {
      e.preventDefault();
      e.stopPropagation();

      // TODO: Combine these events
      el.dispatchEvent(new CustomEvent("draggable_onMouseDown", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));
      el.dispatchEvent(new CustomEvent("draggable_start", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));
      // TODO: check if event canceled, if not:
      dragging = true;
    }, 100);
  }

  function onMouseMove(e: MouseEvent | TouchEvent) {
    // dragOffset.x += e.clientX - dragInit.x;
    // dragOffset.y += e.clientY - dragInit.y;
    // if (dragOffset.x >= 9 || dragOffset.y >= 9) {
    //   if (holdTimer) clearTimeout(holdTimer);
    //   holdTimer = null;
    // }
    if (!dragging) return;
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;
    el.dispatchEvent(new CustomEvent("draggable_onMouseMove", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));
    el.dispatchEvent(new CustomEvent("draggable_move", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));
  }

  function onMouseUp(e: MouseEvent | TouchEvent) {
    // dragOffset.x = 0;
    // dragOffset.y = 0;
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;

    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
      e.stopImmediatePropagation();
      e.preventDefault();
    }

    if (!dragging) return;
    const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
    const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

    el.dispatchEvent(new CustomEvent("draggable_onMouseUp", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));
    el.dispatchEvent(new CustomEvent("draggable_end", { bubbles: true, detail: { event: e, positionable, clientX, clientY } }));

    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }

  // function onMouseDown(e: MouseEvent | TouchEvent) {
  //   const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
  //   const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
  //   const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

  //   if (
  //     isTagsOrParentWithTags(target as HTMLElement, [
  //       "INPUT",
  //       "BUTTON",
  //       "TEXTAREA",
  //       "SELECT",
  //       "OPTION",
  //       "A",
  //       "IFRAME"
  //     ])
  //   )
  //     return;

  //   document.addEventListener("mouseup", onMouseUp, { once: true });
  //   document.addEventListener("touchend", onMouseUp, { once: true });
  //   document.addEventListener("mousemove", onMouseMove);
  //   document.addEventListener("touchmove", onMouseMove);

  //   e.preventDefault();
  //   e.stopPropagation();

  //   // TODO: Combine these events
  //   el.dispatchEvent(
  //     new CustomEvent("draggable_onMouseDown", {
  //       bubbles: true,
  //       detail: { event: e, positionable, clientX, clientY }
  //     })
  //   );
  //   el.dispatchEvent(
  //     new CustomEvent("draggable_start", {
  //       bubbles: true,
  //       detail: { event: e, positionable, clientX, clientY }
  //     })
  //   );
  //   // TODO: check if event canceled, if not:
  // }

  // function onMouseMove(e: MouseEvent | TouchEvent) {
  //   const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
  //   const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
  //   const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;
  //   el.dispatchEvent(
  //     new CustomEvent("draggable_onMouseMove", {
  //       bubbles: true,
  //       detail: { event: e, positionable, clientX, clientY }
  //     })
  //   );
  // }

  // function onMouseUp(e: MouseEvent | TouchEvent) {
  //   const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
  //   const clientX = (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX;
  //   const clientY = (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY;

  //   el.dispatchEvent(
  //     new CustomEvent("draggable_onMouseUp", {
  //       bubbles: true,
  //       detail: { event: e, positionable, clientX, clientY }
  //     })
  //   );
  //   el.dispatchEvent(
  //     new CustomEvent("draggable_end", {
  //       bubbles: true,
  //       detail: { event: e, positionable, clientX, clientY }
  //     })
  //   );

  //   document.removeEventListener("mousemove", onMouseMove);
  //   document.removeEventListener("mouseup", onMouseUp);
  //   document.removeEventListener("touchmove", onMouseMove);
  //   document.removeEventListener("touchend", onMouseUp);
  // }
</script>

<div
  class="draggable {$$restProps.class || ''}"
  on:mousedown|capture={onMouseDown}
  on:touchstart={onMouseDown}
  bind:this={el}
  on:click
>
  <slot />
</div>
