<script lang="ts">
  import { createEventDispatcher, getContext } from "svelte";
  import { clamp, hasClassOrParentWithClass, snapToGrid } from "./utils.js";
  import type { Writable } from "svelte/store";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";
  import type { IPositionable } from "./Positionable.svelte";
  import type { Vec2 } from "./index.js";

  // export let positionable: IPositionable;
  export let key: string;
  export let x: number;
  export let y: number;
  export let width: number;
  export let height: number;
  export let direction: "wn" | "ne" | "es" | "sw";
  export let minSize: Vec2<number> = { x: 0, y: 0 };
  export let maxSize: Vec2<number> = { x: Infinity, y: Infinity };
  // todo: aspect-ratio css override? (height unset)

  const board = getContext<IBoard>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");
  let state = board.state;
  $: ({ zoom } = $state);

  const dispatch = createEventDispatcher();
  let htmlEl: HTMLDivElement;

  let resizeState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  // Utils
  function clampSize(size: Vec2<number>) {
    return {
      x: clamp(size.x, minSize.x, maxSize.x),
      y: clamp(size.y, minSize.y, maxSize.y)
    };
  }

  // UI Handlers
  function onMouseDown(e: MouseEvent) {
    if (hasClassOrParentWithClass(e.target as HTMLElement, "tela-ignore")) return;
    e.stopPropagation();

    let cX = e.clientX;
    let cY = e.clientY;
    // todo: handle touch

    const sX = cX//$settings.SNAP_TO_GRID ? snapToGrid(cX, $settings.GRID_SIZE!) : cX;
    const sY = cY//$settings.SNAP_TO_GRID ? snapToGrid(cY, $settings.GRID_SIZE!) : cY;

    resizeState.init = { x: sX, y: sY };
    resizeState.curr = { x: sX, y: sY };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, { once: true });

    $state.mode = "resizing";

    dispatch("resizeStart", { key, x, y, width, height });
  }

  function onMouseMove(e: MouseEvent) {
    let cX = e.clientX;
    let cY = e.clientY;

    resizeState.offset = {
      x: (cX - resizeState.curr.x) / $zoom,
      y: (cY - resizeState.curr.y) / $zoom
    };

    resizeState.curr = { x: e.clientX, y: e.clientY };

    if (direction === "wn") {
      // todo: optimize setting pos?
      width += resizeState.offset.x;
      height += resizeState.offset.y;
    }
    else if (direction === "ne") {
      width -= resizeState.offset.x;
      height += resizeState.offset.y;
      x += resizeState.offset.x;
    }
    else if (direction === "es") {
      width -= resizeState.offset.x;
      height -= resizeState.offset.y;
      y += resizeState.offset.y;
      x += resizeState.offset.x;
    }
    else if (direction === "sw") {
      width += resizeState.offset.x;
      height -= resizeState.offset.y;
      y += resizeState.offset.y;
    }

    const clamped = clampSize({ x: width, y: height });
    width = clamped.x;
    height = clamped.y;

      htmlEl.dispatchEvent(
        new CustomEvent("resizable_change", {
          detail: { key, x, y, width, height },
          bubbles: true
        })
      );
      dispatch("resize", { key, x, y, width, height });
    }

  function onMouseUp(e: MouseEvent) {
    $state.mode = "draw"; // todo: fix

    const clamped = clampSize({ x: width, y: height });
    x = $settings.SNAP_TO_GRID ? snapToGrid(x, $settings.GRID_SIZE!) : x;
    y = $settings.SNAP_TO_GRID ? snapToGrid(y, $settings.GRID_SIZE!) : y;
    width = $settings.SNAP_TO_GRID ? snapToGrid(clamped.x, $settings.GRID_SIZE!) : clamped.x;
    height = $settings.SNAP_TO_GRID ? snapToGrid(clamped.y, $settings.GRID_SIZE!) : clamped.y;

    // positionable.width = clamped.x;
    // positionable.height = clamped.y;

    htmlEl.dispatchEvent(
        new CustomEvent("resizable_move_end", {
          detail: { key, x, y, width, height },
          bubbles: true
        })
      );
    document.removeEventListener("mousemove", onMouseMove);
    htmlEl.dispatchEvent(
        new CustomEvent("resizable_change", {
          detail: { key, x, y, width, height },
          bubbles: true
        })
      );
    dispatch("resizeEnd", { key, x, y, width, height });
  }
</script>

<svelte:element
  this="div"
  {...$$restProps}
  class="resizable {$$restProps.class || ''}"
  on:mousedown={onMouseDown}
    bind:this={htmlEl}
>
  <slot />
</svelte:element>
