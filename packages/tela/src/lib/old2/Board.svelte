<script context="module" lang="ts">
  /**
   * Creates a board settings store with given values or defaults as fallback.
   * @param settings The settings to override.
   */
  export function createSettings(settings: DeepPartial<IBoardSettings>): Writable<IBoardSettings> {
    return writable({
      CAN_PAN: true,
      PAN_DIRECTION: "xy",

      CAN_DRAW: true,
      CAN_ZOOM: true,
      CAN_SELECT: true,
      SNAP_TO_GRID: false,
      GRID_SIZE: 20,

      CULL: true,
      CULL_MARGIN: 200,

      CHUNK_SIZE: 2000,
      CHUNK_CULL_MARGIN: 2000,
      CHUNK_WARM_MARGIN: 1,

      POSITIONABLE_KEY: "key",

      ...settings,
      BOUNDS: {
        minX: null,
        maxX: null,
        minY: null,
        maxY: null,
        minZoom: 0.3,
        maxZoom: 1,
        limit: "soft",
        ...settings.BOUNDS
      },
      DEV: {
        SHOW_POS: false,
        SHOW_MODE: false,
        CHUNK_DBG: false,
        ...settings.DEV
      }
    } as IBoardSettings); // hack: fixs optional types
  }

  /**
   * Pan the board to the given position.
   * @param viewOffset
   * @param x
   * @param y
   * @param duration
   * @param delay
   */
  export function panTo(
    viewOffset: Vec2<Tweened<number>>,
    x: number,
    y: number,
    duration: number = 400,
    delay: number = 0,
    bounds: { minX: number | null, maxX: number | null, minY: number | null, maxY: number | null } = {
      minX: null,
      maxX: null,
      minY: null,
      maxY: null
    }
  ) {
    // todo: add gta pan mode
    const boundX = clamp(
        x,
        bounds.minX !== null ? bounds.minX : -Infinity,
        bounds.maxX !== null ? bounds.maxX - window.innerWidth : Infinity // todo: use bounding rect
      );
      const boundY = clamp(
        y,
        bounds.minY !== null ? bounds.minY : -Infinity,
        bounds.maxY !== null ? bounds.maxY! - window.innerHeight : Infinity
      );
    return Promise.all([
      viewOffset.x.set(boundX, { duration, delay }),
      viewOffset.y.set(boundY, { duration, delay })
    ]);
  }

  /**
   * Zoom the board to a given zoom factor.
   * @param state
   * @param zoom
   * @param duration
   * @param delay
   */
  export function zoomTo(
    state: IBoardState,
    zoom: number,
    duration: number = 400,
    delay: number = 0
  ) {
    return state.zoom.set(zoom, { duration, delay });
  }

  export function createBoard(
    initialState: DeepPartial<{
      viewOffset: Vec2<number>;
      viewPort: Vec4;
      zoom: number;
      mode: TBoardMode;
      selection: Writable<Set<string>>;
    }>,
    settings: Writable<IBoardSettings>,
    handlers: {
      onChunksChanged?: (chunks: Writable<Map<string, Writable<IPositionable[]>>>, changed: Set<string>) => void;
    } = {}
  ): IBoard {
    initialState.viewOffset = {
      // @ts-ignore we just override to not create a new object
      x: tweened(initialState.viewOffset?.x === undefined ? 0 : initialState.viewOffset?.x, {
        duration: 0,
        easing: cubicOut
      }),
      // @ts-ignore we just override to not create a new object
      y: tweened(initialState.viewOffset?.y === undefined ? 0 : initialState.viewOffset?.y, {
        duration: 0,
        easing: cubicOut
      })
    };
    initialState.viewPort = {
      // todo
      x: 0,
      y: 0,
      w: 0,
      h: 0
    };
    // @ts-ignore we just override
    initialState.zoom = tweened(initialState.zoom === undefined ? 1 : initialState.zoom, {
      duration: 0,
      easing: cubicOut
    });
    initialState.mode = initialState.mode !== undefined ? initialState.mode : "draw";
    initialState.selection = initialState.selection !== undefined ? initialState.selection : writable(new Set());

    const state = writable<IBoardState>(initialState as unknown as IBoardState); // hack: types

    return {
      state,

      // Handlers
      onChunksChanged: (chunks: Writable<Map<string, Writable<IPositionable[]>>>, changed: Set<string>) => {
        handlers.onChunksChanged && handlers.onChunksChanged(chunks, changed);
      },

      // Commands
      setMode: (mode: TBoardMode) => {
        state.update((s) => {
          s.mode = mode;
          return s;
        });
      },
      panTo: (x: number, y: number, duration = 400, delay = 0) => {
        state.update(s => {
          s.mode = "auto-panning";
          return s;
        })
        const p = panTo(get(state).viewOffset, x, y, duration, delay, get(settings).BOUNDS);
        p.then(() => {
          state.update(s => {
            s.mode = "draw";
            return s;
          })
        })
        return p;
      },
      zoomTo: (zoom: number, duration = 400, delay = 0) => {
        state.update(s => {
          s.mode = "auto-zooming";
          return s;
        })
        const p = zoomTo(get(state), zoom, duration, delay);
        p.then(() => {
          state.update(s => {
            s.mode = "draw";
            return s;
          })
        })
        return p;
      }
    };
  }

  export function moveToStackingTop(stack: Writable<string[]>, key: string) {
    const l = get(stack).length;
    // console.time(`[StackingOrder-update :: n = ${l}]`); // todo: make debug only
    stack.update(s => {
      const i = s.indexOf(key);
      s.push(key);
      if (i === -1) return s;
      s.splice(i, 1);
      return s;
    });
    // console.timeEnd(`[StackingOrder-update :: n = ${l}]`);
  }
</script>

<script lang="ts">
  import { derived, get, writable, type Writable } from "svelte/store";
  import type { IBoard, IBoardState, TBoardMode, IBoardSettings } from "./types/Board.type.ts";
  import type { DeepPartial, Vec2, Vec4 } from "./types/Utils.type.ts";
  import { clamp, debounce, hasClassOrParentWithClass } from "./utils.js";
  import { createEventDispatcher, onMount, setContext } from "svelte";
  import { tweened, type Tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import type { IPositionable } from "./Positionable.svelte";

  export let settings: Writable<IBoardSettings>;
  export let board: IBoard; // "exported" with custom properties
  //export let chunks: Writable<Map<string, Writable<IPositionable[]>>> = writable(new Map());
  export let stackingOrder: Writable<string[]>;
  export let preTransform: string | null = null;
  export let postTransform: string | null = null;

  const dispatch = createEventDispatcher();

  setContext("board", board);
  setContext("settings", settings);
  setContext("stackingOrder", stackingOrder);

  let state = board.state;
  let mode = derived(state, (e) => e.mode);
  $: ({ x: viewX, y: viewY } = $state.viewOffset);
  $: ({ viewPort } = $state);
  $: ({ zoom } = $state);

  let containerEl: HTMLDivElement;
  let dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  let selectState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    pos: { x: 0, y: 0 },
    size: { x: 0, y: 0 }
  };

  $: transformCss = `transform-origin: top left; transform: ${preTransform || ''} ${$zoom !== 1 ? `scale(${$zoom})` : ''} translate3d(${-$viewX}px, ${-$viewY}px, 0) ${postTransform || ''};`;

  // $: selectionCss = `transform: translate(${
  //   $settings.SNAP_TO_GRID ? snapToGrid(Math.floor($viewX + (selectState.pos.x - 0.5) / $zoom), $settings.GRID_SIZE!) : $viewX + selectState.pos.x / $zoom
  // }px, ${
  //   $settings.SNAP_TO_GRID ? snapToGrid(Math.floor($viewY + (selectState.pos.y - 0.5) / $zoom), $settings.GRID_SIZE!) : $viewY + selectState.pos.y / $zoom
  // }px); width: ${
  //   $settings.SNAP_TO_GRID ? snapToGrid(Math.round(selectState.size.x + 0.5), $settings.GRID_SIZE!) : Math.round(selectState.size.x)
  // }px; height: ${
  //   $settings.SNAP_TO_GRID ? snapToGrid(Math.round(selectState.size.y + 0.5), $settings.GRID_SIZE!) : Math.round(selectState.size.y)
  // }px;`;

  $: selectionCss = `transform: translate(${selectState.pos.x}px, ${
    selectState.pos.y
  }px); width: ${Math.round(selectState.size.x)}px; height: ${Math.round(
    selectState.size.y
  )}px;`;

  // if ($settings.BOUNDS?.minX !== null && $viewX < $settings.BOUNDS!.minX) {
  //   $viewX = $settings.BOUNDS!.minX;
  // }
  // if ($settings.BOUNDS?.minY !== null && $viewY < $settings.BOUNDS!.minY) {
  //   $viewY = $settings.BOUNDS!.minY;
  // }
  // if ($settings.BOUNDS?.maxX !== null && $viewX > $settings.BOUNDS!.maxX - window.innerWidth) {
  //   $viewX = $settings.BOUNDS!.maxX - window.innerWidth;
  // }
  // if ($settings.BOUNDS?.maxY !== null && $viewY > $settings.BOUNDS!.maxY - window.innerHeight) {
  //   $viewY = $settings.BOUNDS!.maxY - window.innerHeight;
  // }

  // Utils
  function posToViewportPos(x: number, y: number) {
    return {
      x: $viewX + x / $zoom,
      y: $viewY + y / $zoom//y - $viewY + window.scrollY // todo: fix
    };
  }
  function stopDrawing() {
    document.removeEventListener("mousemove", onMouseMoveDraw);
  }
  function stopPanning() {
    document.removeEventListener("mousemove", onMouseMovePan);
    document.removeEventListener("touchmove", onMouseMovePan);
    dispatch("panEnd", { offset: $state.viewOffset });
  }

  function startSelect() {
    dispatch("selectStart");
    document.addEventListener("mousemove", onMouseMoveSelect);
    // document.removeEventListener("touchmove", onMouseMoveSelect);
  }
  function stopSelect() {
    document.removeEventListener("mousemove", onMouseMoveSelect);
    // document.removeEventListener("touchmove", onMouseMoveSelect);
  }

  // UI Handlers
  function onWheel(e: WheelEvent) {
    if (!hasClassOrParentWithClass(e.target as HTMLElement, "tela-container")) return;
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!$settings.CAN_ZOOM) return;

      $state.mode = "zoom";

      // todo: fix relative to bounding element box not screen pos
      const absoluteMouseXOld = $viewX + e.clientX / $zoom;
      const absoluteMouseYOld = $viewY + e.clientY / $zoom;

      const delta = e.deltaY;
      const newZoom = clamp($zoom - delta / 500, $settings.BOUNDS?.minZoom!, $settings.BOUNDS?.maxZoom!);

      const absoluteMouseXNew = $viewX + e.clientX / newZoom;
      const absoluteMouseYNew = $viewY + e.clientY / newZoom;

      const offsetX = absoluteMouseXOld - absoluteMouseXNew;
      const offsetY = absoluteMouseYOld - absoluteMouseYNew;

      $state.viewOffset.x.set($viewX + offsetX, { duration: 0 });
      $state.viewOffset.y.set($viewY + offsetY, { duration: 0 });
      $state.zoom.set(newZoom, { duration: 0 });

      debounce("tela_zoomModeReset", 50, () => $state.mode = "draw");
    } else {
      if (!$settings.CAN_PAN || hasClassOrParentWithClass(e.target as HTMLElement, "tela-ignore")) return;
      e.preventDefault();
      e.stopPropagation();

      $state.mode = "panning";

      const deltaX = ($settings.PAN_DIRECTION === "xy" || $settings.PAN_DIRECTION === "x") ? e.deltaX / $zoom : 0;
      const deltaY = ($settings.PAN_DIRECTION === "xy" || $settings.PAN_DIRECTION === "y") ? e.deltaY / $zoom : 0;

      const boundX = clamp(
        $viewX + deltaX,
        $settings.BOUNDS!.minX !== null ? $settings.BOUNDS!.minX : -Infinity,
        $settings.BOUNDS!.maxX !== null ? $settings.BOUNDS!.maxX - window.innerWidth : Infinity // todo: use bounding rect
      );
      const boundY = clamp(
        $viewY + deltaY,
        $settings.BOUNDS!.minY !== null ? $settings.BOUNDS!.minY : -Infinity,
        $settings.BOUNDS!.maxY !== null ? $settings.BOUNDS!.maxY - window.innerHeight : Infinity
      );

      $state.viewOffset.x.set(boundX, { duration: 0 });
      $state.viewOffset.y.set(boundY, { duration: 0 });

      if (boundX % 3 === 0) { // todo: not only x !!
        debounce("tela_board_pan_done", 250, () => dispatch("panDone", { offset: $state.viewOffset }));
      }

      debounce("tela_trackpadPanModeReset", 60, () => $state.mode = "draw");
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.shiftKey) {
      $state.mode = "select";
    } else if (e.metaKey) {
      $state.mode = "pan";
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!e.shiftKey && !e.metaKey) {
      $mode === "draw" && stopDrawing();
      ($mode === "pan" || $mode === "panning") && stopPanning();
      $mode === "select" && stopSelect();
      $state.mode = "draw";
    }
  }

  function onMouseDown(e: MouseEvent | TouchEvent) {
    if (hasClassOrParentWithClass(e.target as HTMLElement, "tela-ignore")) return;
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    if (hasClassOrParentWithClass(target as HTMLElement, "tela-ignore")) return;
    if ($mode === "pan" || (e as TouchEvent).targetTouches?.length === 1) {
      $state.mode = "panning";
      // todo: look into
    }

    if ($mode === "draw") {
      e.stopPropagation();
      $state.mode = "drawing";

      selectState.init = { x: clientX, y: clientY };
      selectState.curr = { x: clientX, y: clientY };
      selectState.pos = { x: clientX, y: clientY };
      selectState.size = { x: 0, y: 0 };

      document.addEventListener("mousemove", onMouseMoveDraw);
      document.addEventListener("mouseup", onMouseUp, { once: true });
    } else if ($mode === "panning") { // Todo: fix panning
      e.stopPropagation();

      dragState.init = { x: clientX, y: clientY };
      dragState.curr = { x: clientX, y: clientY };

      document.addEventListener("mousemove", onMouseMovePan);
      document.addEventListener("mouseup", onMouseUp, { once: true });
      document.addEventListener("touchmove", onMouseMovePan);
      document.addEventListener("touchend", onMouseUp, { once: true });
    } else if ($mode === "select") {
      e.stopPropagation();
      startSelect();

      selectState.init = { x: clientX, y: clientY };
      selectState.curr = { x: clientX, y: clientY };
      selectState.pos = { x: clientX, y: clientY };
      selectState.size = { x: 0, y: 0 };

      document.addEventListener("mousemove", onMouseMoveSelect);
      document.addEventListener("mouseup", onMouseUp, { once: true });
    }
  }

  function onBoardMouseDown(e: MouseEvent) {
    $state.selection.update(_selection => {
      _selection.clear();
      return _selection;
    })
  }

  function onMouseMovePan(e: MouseEvent | TouchEvent) {
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    dragState.offset = {
      x: Math.floor(clientX - dragState.curr.x),
      y: Math.floor(clientY - dragState.curr.y)
    };

    dragState.curr = { x: clientX, y: clientY };

    const boundX = clamp(
      $viewX - dragState.offset.x,
      $settings.BOUNDS!.minX !== null ? $settings.BOUNDS!.minX : -Infinity,
      $settings.BOUNDS!.maxX !== null ? $settings.BOUNDS!.maxX - window.innerWidth : Infinity
    );
    const boundY = clamp(
      $viewY - dragState.offset.y,
      $settings.BOUNDS!.minY !== null ? $settings.BOUNDS!.minY : -Infinity,
      $settings.BOUNDS!.maxY !== null ? $settings.BOUNDS!.maxY - window.innerHeight : Infinity
    );

    $state.viewOffset.x.set(boundX, { duration: 0 });
    $state.viewOffset.y.set(boundY, { duration: 0 });
  }

  function onMouseMoveSelect(e: MouseEvent) {
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    selectState.offset = {
      x: -Math.floor(selectState.init.x - selectState.curr.x),
      y: -Math.floor(selectState.init.y - selectState.curr.y)
    };

    selectState.pos.x = selectState.init.x;
    selectState.pos.y = selectState.init.y;

    selectState.size.x = selectState.offset.x;
    selectState.size.y = selectState.offset.y;

    if (selectState.size.x < 0) {
      selectState.size.x = Math.abs(selectState.offset.x);
      selectState.pos.x = selectState.init.x - selectState.size.x;
    }
    if (selectState.size.y < 0) {
      selectState.size.y = Math.abs(selectState.offset.y);
      selectState.pos.y = selectState.init.y - selectState.size.y;
    }

    // todo: optimize if snapToGrid
    // todo: calc chunkes

    selectState.curr = { x: clientX, y: clientY };
    dispatch("selectMove", { selectState });
  }

  function onMouseMoveDraw(e: MouseEvent | TouchEvent) {
    const { x: clientX, y: clientY } = posToViewportPos(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    );

    selectState.offset = {
      x: -Math.floor(selectState.init.x - selectState.curr.x),
      y: -Math.floor(selectState.init.y - selectState.curr.y)
    };

    selectState.pos.x = selectState.init.x;
    selectState.pos.y = selectState.init.y;

    selectState.size.x = selectState.offset.x;
    selectState.size.y = selectState.offset.y;

    if (selectState.size.x < 0) {
      selectState.size.x = Math.abs(selectState.offset.x);
      selectState.pos.x = selectState.init.x - selectState.size.x;
    }
    if (selectState.size.y < 0) {
      selectState.size.y = Math.abs(selectState.offset.y);
      selectState.pos.y = selectState.init.y - selectState.size.y;
    }

    selectState.curr = { x: clientX, y: clientY };
  }

  function onMouseUp(e: MouseEvent | TouchEvent) {
    if ($mode === "drawing") {
      document.removeEventListener("mousemove", onMouseMoveDraw);
      document.removeEventListener("touchmove", onMouseMoveDraw);
      dispatch("drawEnd", { selection: { pos: selectState.pos, size: selectState.size } });
    } else if ($mode === "panning") {
      stopPanning();
    } else if ($mode === "select") {
      stopSelect();
      dispatch("selectEnd", { selectionArea: { pos: selectState.pos, size: selectState.size } }); // todo: copy object to prevent nulling
    }
    $state.mode = "draw";
    selectState = {
        init: { x: 0, y: 0 },
        curr: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
        pos: { x: 0, y: 0 },
        size: { x: 0, y: 0 }
      };
  }

  //console.debug("Handling n positionables:", Array.from($chunks.values()).reduce((a, b) => a + b.length, 0));
  //console.debug("Handling n chunks:", $chunks.size);

  onMount(() => {
    const rec = containerEl.getBoundingClientRect();
    console.log("rec", rec)
    $state.viewPort = {
      x: rec.x,
      y: rec.y,
      w: window.innerWidth,//rec.right - rec.left,
      h: window.innerHeight//rec.bottom - rec.top
    };
  });
</script>

{#if Object.values($settings.DEV).includes(true)}
  <!-- todo: add dev toggle -->
  <div
    style="position: absolute; right: 1ch; top: 1ch; background: darkblue; z-index: 200; color: #fff; padding: 4px; display: flex; gap: 2ch; user-select: none; pointer-events: none;"
  >
    {#if $settings.DEV?.SHOW_POS}
      <span>{Math.floor($viewX / $settings.CHUNK_SIZE)} // {Math.floor($viewY / $settings.CHUNK_SIZE)}</span>
      <span>{$viewX} // {$viewY} // {$zoom}x</span>
    {/if}
    {#if $settings.DEV?.SHOW_MODE}
      <span>{$mode}</span>
    {/if}
  </div>
{/if}

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} on:wheel|nonpassive={onWheel}/>

<div
  class="tela-container"
  on:mousedown={onMouseDown}
  on:touchstart|nonpassive={onMouseDown}
  bind:this={containerEl}
>
  <div class="board mode-{$mode}" style="{transformCss} {$$restProps.style || ''}" on:mousedown={onBoardMouseDown}>
    <!-- {#if ["select", "zoom", "pan", "panning"].includes($mode)}
    <div class="dragIntercept"></div>
  {/if} -->
    {#if $mode === "select" || $mode === "drawing"}
      <div class="selection-rect" style={selectionCss} />
      <!-- <div id="dragIntercept">
        <div id="selectionRect" style={selectionCss} bind:this={selectionRectEl} />
      </div> -->
    {/if}

    <slot name="meta" />

    <slot/>
    </div>
</div>

<style>
  .tela-container {
    width: 100%;
    height: 100%;

    overflow: hidden;
    /* overscroll-behavior: contain; */
  }
  .board {
    position: relative;
    height: 100%;
    overflow: visible;

    will-change: transform;
    isolation: isolate;

    /* transform-style: preserve-3d;
    backface-visibility: hidden; */
  }

  .dragIntercept {
    background-color: transparent;
    position: fixed;
    z-index: 99999;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }

  .selection-rect {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 99999;
  }
</style>
