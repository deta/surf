<script lang="ts">
  import { createEventDispatcher, getContext } from "svelte";
  import type { Vec2 } from "./types/Utils.type.js";
  import type { Writable } from "svelte/store";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";
  import { hasClassOrParentWithClass, snapToGrid } from "./utils.js";
  import { moveToStackingTop } from "./Board.svelte";

  /**
   * Events:
   * - draggable_move
   * - draggable_move_end
   * - positionableChunkChanged<key, initChunk: dragState.initChunk, newChunk: { x: currChunkX, y: currChunkY }>
   */

  export let key: string;
  export let x: number;
  export let y: number;
  export let width: number;
  export let height: number;

  const dispatch = createEventDispatcher();

  const board = getContext<IBoard>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");
  const stackingOrder = getContext<Writable<string[]>>("stackingOrder");

  let htmlEl: HTMLDivElement;
  let state = board.state;
  $: ({ viewPort, selection } = $state);
  $: ({ x: viewX, y: viewY } = $state.viewOffset);
  $: ({ zoom } = $state);

  let dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    autoPanOffset : { x: 0, y: 0 },
    initChunk: { x: 0, y: 0 }
  };

  // Utils
  /**
   * Converts window position to board position.
   * @param x
   * @param y
   */
  function posToViewportPos(x: number, y: number) {
    return {
      x: x - $viewX - viewPort.x,
      y: y - $viewY + window.scrollY - viewPort.y
    };
  }

  // UI Handlers
  function onMouseDown(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    if (hasClassOrParentWithClass(target as HTMLElement, "tela-ignore")) return;
    e.stopPropagation();

    // Reset selection to prevent remaining selection when moving sth. elese
    if (!$selection.has(key)) {
      $selection.clear();
    }

    //document.body.classList.add("dragging");
    // todo: handle touch

    // const sX = $settings.SNAP_TO_GRID ? snapToGrid(clientX, $settings.GRID_SIZE!) : clientX;
    // const sY = $settings.SNAP_TO_GRID ? snapToGrid(clientY, $settings.GRID_SIZE!) : clientY;

    dragState.init = { x: clientX, y: clientY };
    dragState.curr = { x: clientX, y: clientY };
    dragState.initChunk = {
      x: Math.floor(x / $settings.CHUNK_SIZE),
      y: Math.floor(y / $settings.CHUNK_SIZE)
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, { once: true });
    document.addEventListener("touchmove", onMouseMove);
    document.addEventListener("touchend", onMouseUp, { once: true });

    // Move to stack top.
    moveToStackingTop(stackingOrder, key);
    $state.mode = "dragging";

    dispatch("dragStart", { x, y });
    htmlEl.dispatchEvent(
      new CustomEvent("draggable_move_start", {
        detail: { key, x, y },
        bubbles: true
      })
    );
  }

  let autoPanInterval: NodeJS.Timer | null = null;
  function onMouseMove(e: MouseEvent | TouchEvent) {
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    dragState.offset = {
      x: ((clientX - dragState.curr.x) / $zoom),
      y: (clientY - dragState.curr.y) / $zoom
    };

    dragState.curr = { x: clientX, y: clientY };

    // Auto Pan
    // if (e.clientX < 200) {
    //   if (autoPanInterval === null) {
    //     autoPanInterval = setInterval(() => {
    //       dragState.autoPanOffset.x -= 1;
    //       // x -= 1;
    //       $state.viewOffset.x.update((_x) => (_x -= 1), { duration: 0 });
    //     }, 10);
    //   }
    // } else if (e.clientX > window.innerWidth - 200) {
    //   if (autoPanInterval === null) {
    //     autoPanInterval = setInterval(() => {
    //       dragState.autoPanOffset.x += 1;
    //       // x += 1;
    //       $state.viewOffset.x.update((_x) => (_x += 1), { duration: 0 });
    //     }, 10);
    //   }
    // }
    // else {
    //   if (autoPanInterval !== null) clearInterval(autoPanInterval);
    //   autoPanInterval = null;
    // }

    // todo: optimize setting pos?

    const newX = x + dragState.offset.x;
    const newY = y + dragState.offset.y;
    // const vpInit = posToViewportPos(dragState.init.x, dragState.init.y)
    // const vpOffset
    // const newX = vpInit.x + dragState.offset.x + dragState.autoPanOffset.x;
    // const newY = vpInit.y + dragState.offset.y + dragState.autoPanOffset.y;

    // x = newX
    // y = newY

    if ($settings.BOUNDS?.minX !== null && newX < $settings.BOUNDS!.minX) {
      x = $settings.BOUNDS!.minX;
    } else if ($settings.BOUNDS?.maxX !== null && newX + width > $settings.BOUNDS!.maxX) {
      x = $settings.BOUNDS!.maxX - width;
    } else {
      x += dragState.offset.x;
    }

    if ($settings.BOUNDS?.minY !== null && newY < $settings.BOUNDS!.minY) {
      y = $settings.BOUNDS!.minY;
    } else if ($settings.BOUNDS?.maxY !== null && newY + height > $settings.BOUNDS!.maxY) {
      y = $settings.BOUNDS!.maxY - height;
    } else {
      y += dragState.offset.y;
    }

    dispatch("dragMove", { key, x, y, offset: dragState.offset });
    htmlEl.dispatchEvent(
      new CustomEvent("draggable_move", {
        detail: { key, x, y, offset: dragState.offset },
        bubbles: true
      })
    );
  }

  function onMouseUp(e: MouseEvent | TouchEvent) {
    if (autoPanInterval !== null) clearInterval(autoPanInterval);
    autoPanInterval = null;
    $state.mode = "draw";
    const currChunkX = Math.floor(x / $settings.CHUNK_SIZE);
    const currChunkY = Math.floor(y / $settings.CHUNK_SIZE);

    x = $settings.SNAP_TO_GRID ? snapToGrid(x, $settings.GRID_SIZE!) : x;
    y = $settings.SNAP_TO_GRID ? snapToGrid(y, $settings.GRID_SIZE!) : y;
    width = $settings.SNAP_TO_GRID ? snapToGrid(width, $settings.GRID_SIZE!) : width;
    height = $settings.SNAP_TO_GRID ? snapToGrid(height, $settings.GRID_SIZE!) : height;

    htmlEl.dispatchEvent(
      new CustomEvent("draggable_move_end", {
        detail: {
          key,
          initChunk: dragState.initChunk,
          currChunk: { x: currChunkX, y: currChunkY },
          newPos: { x, y }
        },
        bubbles: true
      })
    );

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("touchmove", onMouseMove);
    dispatch("dragEnd", { x, y });
  }
</script>

<svelte:element
  this="div"
  {...$$restProps}
  class="draggable {$$restProps.class || ''}"
  on:mousedown={onMouseDown}
  on:touchstart|nonpassive={onMouseDown}
  bind:this={htmlEl}
>
  <slot />
</svelte:element>
