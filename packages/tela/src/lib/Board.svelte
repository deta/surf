<script context="module" lang="ts">
  // TODO: REMOVE
  // export const dragDelay = writable(180);
  // export const dragAbortMin = writable(8);
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

      // CULL: true,
      // CULL_MARGIN: 200,

      CHUNK_WIDTH: 500,
      CHUNK_HEIGHT: 500,
      // CHUNK_CULL_MARGIN: 2000,
      // CHUNK_WARM_MARGIN: 1,

      POSITIONABLE_KEY: "key",

      DEV: false,

      ...settings,
      BOUNDS: {
        minX: -Infinity,
        maxX: Infinity,
        minY: -Infinity,
        maxY: Infinity,
        minZoom: 0.3,
        maxZoom: 1,
        limit: "soft",
        ...settings.BOUNDS
      }
    });
  }

  export function createBoard<BaseSt extends BaseState, Actions>(
    settings: Writable<IBoardSettings>,
    stackingOrder: Writable<string[]>,
    initState: DeepPartial<IBoardState<BaseSt, Actions>>,
    initMode: string,
    modes: {}
  ): IBoard<BaseSt, Actions> {
    const cfg = get(settings);
    const selectionRect = writable({ x: 0, y: 0, w: 0, h: 0 });

    initState = {
      zoom: writable(1),
      ...initState,
      viewOffset:
        cfg.BOUNDS.limit === "soft"
          ? spring({ x: 0, y: 0 }, { stiffness: 0.499, damping: 0.999 })
          : tweened({ x: 0, y: 0 }, { duration: 0, easing: cubicOut }),
      // mode: fsm(initMode, modes),
      viewPort: writable({ x: 0, y: 0, w: 0, h: 0, ...initState.viewPort }),
      selection: writable(new Set()),
      selectionRect,
      selectionCss: derived(
        selectionRect,
        (v) =>
          `left: ${v?.x || 0}px; top: ${v?.y || 0}px; width: ${v?.w || 0}px; height: ${
            v?.h || 0
          }px; z-index: 9999999;`
      ),

      stackingOrder
    };

    const state = writable<IBoardState<BaseSt, Actions>>(initState as IBoardState<BaseSt, Actions>);
    const viewOffset = get(state).viewOffset;
    const zoom = get(state).zoom;

    const panTo = (
      x: number,
      y: number,
      opts?: { delay?: number; duration?: number; soft: string | number | boolean }
    ) => {
      opts = {
        delay: 0,
        duration: 0,
        soft: false,
        hard: true,
        ...opts
      };
      viewOffset.update((v) => {
        v.x = x;
        v.y = y;
        return v;
      }, opts);
    };
    const zoomTo = (
      targetZoom: number,
      opts?: { delay?: number; duration?: number; soft?: string | number | boolean }
    ) => {
      opts = {
        delay: 0,
        duration: 0,
        soft: false,
        hard: true,
        ...opts
      };
      zoom.set(targetZoom, opts);
    };

    return {
      state,
      panTo,
      zoomTo
    };
  }

  export function moveToStackingTop(stack: Writable<string[]>, key: string) {
    stack.update((_stack) => {
      const i = _stack.indexOf(key);
      if (i !== -1) _stack.splice(i, 1);
      _stack.push(key);
      return _stack;
    });

    // const l = get(stack).length;
    // // console.time(`[StackingOrder-update :: n = ${l}]`); // todo: make debug only
    // stack.update((_stack) => {
    //   positionable.update((p) => {
    //     const i = _stack.indexOf(p[keyField]);
    //     _stack.push(p[keyField]);
    //     if (i !== -1) _stack.splice(i, 1);

    //     p.z = _stack.indexOf(p[keyField]); //l + 1;
    //     return p;
    //   });
    //   positionables.forEach((_p) => {
    //     _p.update((p) => {
    //       p.z = _stack.indexOf(p[keyField]);
    //       return p;
    //     });
    //   });
    //   return _stack;
    // });
    // // stack.update((s) => {
    // //   positionable.update((p) => {
    // //     const i = s.indexOf(p.key);
    // //     s.push(p.key);
    // //     if (i !== -1) s.splice(i, 1);
    // //     p.z = s.indexOf(p.key);//l + 1;
    // //     return p;
    // //   });
    // //   return s;
    // // });
    // // console.timeEnd(`[StackingOrder-update :: n = ${l}]`);
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, setContext, tick } from "svelte";
  import { derived, get, writable, type Writable } from "svelte/store";
  import type { IBoard, IBoardSettings, IBoardState } from "./types/Board.type.js";
  import type { DeepPartial, Vec2 } from "./types/Utils.type.js";
  import { spring, tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import DebugPanels from "./DebugPanels.svelte";
  import type { BaseState } from "./state-machine/fsm.js";
  import fsm from "./state-machine/fsm.js";
  import {
    clamp,
    debounce,
    fastFilter,
    hasClassOrParentWithClass,
    isInsidePositionable,
    isInsideViewport,
    posToAbsolute,
    rectsIntersect,
    snapToGrid
  } from "./utils.js";
  import type { IPositionable } from "./Positionable.svelte";
  import type { TResizeDirection } from "./Resizable.svelte";
  import ChunkOverlay from "./ChunkOverlay.svelte";

  const dispatch = createEventDispatcher();
  export let containerEl: HTMLElement;

  export let settings: Writable<IBoardSettings>;
  export let board: IBoard<any, any>;
  export let positionables: Writable<Writable<IPositionable<any>>[]> = writable([]);

  setContext("board", board);
  setContext("settings", settings);

  const CHUNK_WIDTH = $settings.CHUNK_WIDTH;
  const CHUNK_HEIGHT = $settings.CHUNK_HEIGHT;
  const POSITIONABLE_KEY = $settings.POSITIONABLE_KEY;

  const state = board.state;
  const viewOffset = $state.viewOffset; // TODO: Can we use custom stores with requestAnimationFrame for scrolling?

  const chunkOffset = writable({ x: 0, y: 0 });
  onDestroy(
    viewOffset.subscribe((_offset) => {
      const chunkX = Math.floor(_offset.x / CHUNK_WIDTH);
      const chunkY = Math.floor(_offset.y / CHUNK_HEIGHT);
      if ($chunkOffset.x !== chunkX) {
        chunkOffset.update((v) => {
          v.x = chunkX;
          return v;
        });
      }
      if ($chunkOffset.y !== chunkY) {
        chunkOffset.update((v) => {
          v.y = chunkY;
          return v;
        });
      }
    })
  );

  const viewPort = $state.viewPort;
  const zoom = $state.zoom;
  $: mode = $state.mode;
  const selection = $state.selection;
  const selectionRect = $state.selectionRect;
  const stackingOrder = $state.stackingOrder;

  $: transformCss = `transform-origin: top left; transform: ${
    $zoom !== 1 ? `scale(${$zoom * 100}%)` : ""
  } translate3d(${-$viewOffset.x}px, ${-$viewOffset.y}px, 0); ${
    $mode === "pan" ? "will-change: transform;" : ""
  }`;

  board.state.update((v) => {
    v.mode = fsm("idle", {
      idle: {
        pan: "pan",
        autoPan: "autoPan",
        zoom: "zoom",
        autoZoom: "autoZoom",
        select: "select",
        modSelect: "modSelect",

        dragging: "dragging",
        resizing: "resizing",

        _enter() {
          tick().then(() => containerEl.addEventListener("mousedown", onMouseDown_idle));
          tick().then(() =>
            containerEl.addEventListener("mousedown", onMouseDown_idleCapture, { capture: true })
          );
        },
        _exit() {
          containerEl.removeEventListener("mousedown", onMouseDown_idle);
          containerEl.removeEventListener("mousedown", onMouseDown_idleCapture);
        }
      },
      pan: {
        idle: "idle",
        _exit() {
          dispatch("panEnd", {});
        }
      },
      autoPan: {
        idle: "idle"
      },
      zoom: {
        idle: "idle"
      },
      autoZoom: {
        idle: "idle"
      },
      select: {
        idle: "idle",

        _enter() {
          document.addEventListener("mousemove", onMouseMove_select);
          document.addEventListener("mouseup", mode.idle);
        },
        _exit() {
          $state.selectionRect.set(null);
          select_init.x = 0;
          select_init.y = 0;
          document.removeEventListener("mousemove", onMouseMove_select);
          document.removeEventListener("mouseup", mode.idle);
        }
      },
      modSelect: {
        idle: "idle",

        _enter() {
          document.addEventListener("mousemove", onMouseMove_modSelect);
          document.addEventListener("mouseup", onMouseUp_modSelect);
        },
        _exit() {
          $state.selectionRect.set(null);
          select_init.x = 0;
          select_init.y = 0;
          document.removeEventListener("mousemove", onMouseMove_modSelect);
          document.removeEventListener("mouseup", onMouseUp_modSelect);
        }
      },

      dragging: {
        idle: "idle"
      },
      resizing: {
        idle: "idle"
      }
      // TODO: add custom actions
    });
    return v;
  });

  let resizeObserver: ResizeObserver;
  const select_init = { x: 0, y: 0 };
  // Hoisted positionables will live outside the chunking / culling -> Always be loaded
  const hoistedPositionables = writable<Writable<IPositionable<any>>[]>([]);
  const chunks = writable(new Map<string, Writable<Writable<IPositionable<any>>[]>>());
  onDestroy(
    positionables.subscribe((_positionables) => {

      hoistedPositionables.update((_hoisted) => {
        chunks.update((_chunks) => {
          // Remove unused from hoisted.
          _hoisted.forEach((_h, i) => {
            // TODO: perf .forEach
            if (!_positionables.includes(_h) || get(_h).hoisted !== true) {
              _hoisted.splice(i, 1);
            }
          });

          // Remove unused from chunks.
          for (const chunk of _chunks.entries()) {
            const [chunkId, chunkPositionables] = chunk;
            let empty = false;
            chunkPositionables.update(_chunkPositionables => {
              _chunkPositionables.forEach(_cP => {
                if (!_positionables.includes(_cP)) {
                  const index = _chunkPositionables.indexOf(_cP);
                  if (index !== -1) _chunkPositionables.splice(index, 1);
                  if (_chunkPositionables.length <= 0) empty = true;
                }
              })
              return _chunkPositionables;
            })
            if (empty) _chunks.delete(chunkId);
          }

          _positionables.forEach((_positionable) => {
            const p = get(_positionable);
            const cI = `${Math.floor(p.x / CHUNK_WIDTH)}:${Math.floor(p.y / CHUNK_HEIGHT)}`;

            // Add Hoisted.
            // TODO: See if we can make this operate only on the positionable that changed instead of the whole array.
            if (get(_positionable).hoisted === true) {
              // Remove from chunk
              if (_chunks.has(cI)) {
                const c = _chunks.get(cI)!;
                c.update((_c) => {
                  const index = _c.indexOf(_positionable);
                  if (index !== -1) _c.splice(index, 1);
                  return _c;
                });
              }

              if (!_hoisted.includes(_positionable)) {
                _hoisted.push(_positionable);
              }
              return;
            }

            // Chunked behaviour.
            else {
              if (!_chunks.has(cI)) {
                _chunks.set(cI, writable([_positionable]));
              } else {
                const c = _chunks.get(cI)!;
                if (!get(c).includes(_positionable)) {
                  c.update((_c) => {
                    _c.push(_positionable);
                    return _c;
                  });
                }
              }
            }
          });
          return _chunks;
        });
        return _hoisted;
      });
    })
  );

  // $: {
  //   for (let [id, v] of $chunks.entries()) {
  //     console.log(`Chunk ${id}: ${get(v).length}`)
  //   }
  // }

  // TODO: Allow option of IPositionable "keepLoaded" to keep chunk it is in & itself always loaded
  // $: visibleChunks = fastFilter((e) => {
  //   const s = e[0].split(":");
  //   const chunkX = parseInt(s[0]);
  //   const chunkY = parseInt(s[1]);
  //   return isInsideViewport(
  //     chunkX * CHUNK_WIDTH,
  //     chunkY * CHUNK_HEIGHT,
  //     CHUNK_WIDTH,
  //     CHUNK_HEIGHT,
  //     $viewOffset.x,
  //     $viewOffset.y,
  //     viewPort,
  //     $zoom,
  //     CHUNK_WIDTH,
  //     CHUNK_HEIGHT
  //   );
  // }, Array.from($chunks.entries()));

  // const visibleChunks = writable(new Map<string, Writable<Writable<IPositionable<any>>[]>>());
  // onDestroy(chunks.subscribe((_chunks) => {
  //   const entries = Array.from($chunks.entries());
  //   visibleChunks.update((v) => {
  //   for (let i = 0; i < entries.length; i++) {
  //     const e = entries[i];
  //     const index = e[0];
  //     const chunkX = parseInt(index.split(":")[0]);
  //     const chunkY = parseInt(index.split(":")[1]);
  //     if (
  //       isInsideViewport(
  //         chunkX * CHUNK_WIDTH,
  //         chunkY * CHUNK_HEIGHT,
  //         CHUNK_WIDTH,
  //         CHUNK_HEIGHT,
  //         $chunkOffset.x * CHUNK_WIDTH,
  //         $chunkOffset.y * CHUNK_HEIGHT,
  //         //$viewOffset.x,
  //         //$viewOffset.y,
  //         $viewPort,
  //         $zoom,
  //         CHUNK_WIDTH,
  //         CHUNK_HEIGHT
  //       )
  //     ) {
  //       v.set(index, e[1]);
  //     } else {
  //       v.delete(index);
  //     }
  //   }
  //   return v;
  // });
  // }))
  // onDestroy(chunks.subscribe(_chunks => {
  //   const entries = Array.from(_chunks.entries());
  //   visibleChunks.update((v) => {
  //     // Remove deleted
  //     const visibleIds = Array.from(v.keys());
  //     for (let i = 0; i < visibleIds.length; i++) {
  //       const id = visibleIds[i];
  //       if (!_chunks.has(id)) {
  //         v.delete(id);
  //       }
  //     }

  //     // Add new
  //     for (let i = 0; i < entries.length; i++) {
  //       const e = entries[i];
  //       const index = e[0];
  //       const chunkX = parseInt(index.split(":")[0]);
  //       const chunkY = parseInt(index.split(":")[1]);
  //       if (
  //         isInsideViewport(
  //           chunkX * CHUNK_WIDTH,
  //           chunkY * CHUNK_HEIGHT,
  //           CHUNK_WIDTH,
  //           CHUNK_HEIGHT,
  //           $chunkOffset.x * CHUNK_WIDTH,
  //           $chunkOffset.y * CHUNK_HEIGHT,
  //           //$viewOffset.x,
  //           //$viewOffset.y,
  //           $viewPort,
  //           $zoom,
  //           CHUNK_WIDTH,
  //           CHUNK_HEIGHT
  //         )
  //       ) {
  //         v.set(index, e[1]);
  //       } else {
  //         v.delete(index);
  //       }
  //     }
  //     return v;
  //   });
  // }));
  // $: {
  //   const entries = Array.from($chunks.entries());
  //   visibleChunks.update((v) => {
  //     // Remove deleted
  //     chunks.update(_chunks => {
  //       const visibleIds = Array.from(v.keys());
  //       for (let i = 0; i < visibleIds.length; i++) {
  //         const id = visibleIds[i];
  //         if (!_chunks.has(id)) {
  //           v.delete(id);
  //         }
  //       }
  //       return _chunks;
  //     })

  //     for (let i = 0; i < entries.length; i++) {
  //       const e = entries[i];
  //       const index = e[0];
  //       const chunkX = parseInt(index.split(":")[0]);
  //       const chunkY = parseInt(index.split(":")[1]);
  //       if (
  //         isInsideViewport(
  //           chunkX * CHUNK_WIDTH,
  //           chunkY * CHUNK_HEIGHT,
  //           CHUNK_WIDTH,
  //           CHUNK_HEIGHT,
  //           $chunkOffset.x * CHUNK_WIDTH,
  //           $chunkOffset.y * CHUNK_HEIGHT,
  //           //$viewOffset.x,
  //           //$viewOffset.y,
  //           $viewPort,
  //           $zoom,
  //           CHUNK_WIDTH,
  //           CHUNK_HEIGHT
  //         )
  //       ) {
  //         v.set(index, e[1]);
  //       } else {
  //         v.delete(index);
  //       }
  //     }
  //     return v;
  //   });
  // }

  const visibleChunks = derived([chunks, chunkOffset], (values) => {
    return fastFilter((entry) => {
      const index = entry[0];
      const chunkX = parseInt(index.split(":")[0]);
      const chunkY = parseInt(index.split(":")[1]);
      if (
        isInsideViewport(
          chunkX * CHUNK_WIDTH,
          chunkY * CHUNK_HEIGHT,
          CHUNK_WIDTH,
          CHUNK_HEIGHT,
          $chunkOffset.x * CHUNK_WIDTH,
          $chunkOffset.y * CHUNK_HEIGHT,
          //$viewOffset.x,
          //$viewOffset.y,
          $viewPort,
          $zoom,
          CHUNK_WIDTH,
          CHUNK_HEIGHT
        )
      ) {
        return true;
      } else {
        return false;
      }
    }, Array.from(values[0].entries()));
  });

  // const visibleChunks = derived([chunks, viewPort], (v) => {
  //   const [chunks, _] = v;
  //   return fastFilter((entry) => {
  //     if (!viewPort) return false;
  //     const index = entry[0];
  //     const chunkX = parseInt(index.split(":")[0]);
  //     const chunkY = parseInt(index.split(":")[1]);
  //     return isInsideViewport(
  //       chunkX * CHUNK_WIDTH,
  //       chunkY * CHUNK_HEIGHT,
  //       CHUNK_WIDTH,
  //       CHUNK_HEIGHT,
  //       $viewOffset.x,
  //       $viewOffset.y,
  //       $viewPort,
  //       $zoom,
  //       CHUNK_WIDTH,
  //       CHUNK_HEIGHT
  //     );
  //   }, Array.from(chunks.entries()));
  // });
  // console.log($visibleChunks);

  // const visibleCards = writable<IPositionable<any>[]>([]);
  //   $: {
  //     const entries = Array.from($visibleChunks.entries());
  //     visibleCards.update((v) => {
  //       for (let i = 0; i < entries.length; i++) {
  //         const e = entries[i];
  //         const index = e[0];
  //         const chunkX = parseInt(index.split(":")[0]);
  //         const chunkY = parseInt(index.split(":")[1]);
  //         const chunk = get(e[1]);
  //         for (let j = 0; j < chunk.length; j++) {
  //           const p = get(chunk[j]);
  //           if (
  //             isInsideViewport(
  //               p.x,
  //               p.y,
  //               p.width,
  //               p.height,
  //               $viewOffset.x,
  //               $viewOffset.y,
  //               $viewPort,
  //               $zoom,
  //               0,
  //               0
  //             )
  //           ) {
  //             if (v.indexOf(p) === -1) v.push(p);
  //           } else {
  //             const index = v.indexOf(p);
  //             if (index !== -1) v.splice(index, 1);
  //           }
  //         }
  //       }
  //       return v;
  //     });
  //   }

  // TODO: make alwys loaded configurable
  // TODO: add alwaysLoaded to positionable
  // TODO: Perf: Look into optimizing away the 'Array.from' everywhere.
  // $: visiblePositionables =
  //   $positionables.length <= 10
  //     ? $positionables
  //     : [
  //         ...$hoistedPositionables,
  //         ...fastFilter((e) => {
  //           const _e = get(e);
  //           return (
  //             !_e.hoisted ||
  //             isInsideViewport(
  //               _e.x,
  //               _e.y,
  //               _e.width,
  //               _e.height,
  //               $viewOffset.x,
  //               $viewOffset.y,
  //               $viewPort,
  //               $zoom,
  //               0,
  //               0
  //             )
  //           );
  //         }, $visibleChunks.map((_p) => get(_p[1])).flat())
  //       ];

  // Store IDS of old visible positionables fro comparison to fire onPositionableEnter/Leave events
  let oldVisiblePositionables: string[] = [];
  const visiblePositionables = derived([positionables, hoistedPositionables, visibleChunks], (values) => {
    const _positionables = values[0];
    const _hoistedPositionables = values[1];
    const _visibleChunks = values[2];
    // TODO: Remove dev
    const visible = _positionables.length <= 0
      ? _positionables
      : [
          ..._hoistedPositionables,
          ...fastFilter((e) => {
            const _e = get(e);
            return (
              !_e.hoisted ||
              isInsideViewport(
                _e.x,
                _e.y,
                _e.width,
                _e.height,
                $viewOffset.x,
                $viewOffset.y,
                $viewPort,
                $zoom,
                0,
                0
              )
            );
          }, _visibleChunks.map((_p) => get(_p[1])).flat())
        ];

    const visibleIds = visible.map(e => get(e)[POSITIONABLE_KEY]);

    // Leave events.
    for (let i = 0; i < oldVisiblePositionables.length; i++) {
      const id = oldVisiblePositionables[i];
      if (!visibleIds.includes(id)) {
        dispatch("positionableLeave", id);
      }
    }

    // Enter events.
    for (let i = 0; i < visibleIds.length; i++) {
      const id = visibleIds[i];
      if (!oldVisiblePositionables.includes(id)) {
        dispatch("positionableEnter", id);
      }
    }
    oldVisiblePositionables = visibleIds;

    return visible;
  });

  onMount(() => {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        // Set viewport
        const { x, y, width, height } = containerEl.getBoundingClientRect();
        viewPort.update((v) => {
          v.x = x;
          v.y = y;
          v.w = width;
          v.h = height;
          return v;
        });
      });
      resizeObserver.observe(containerEl);
    }
    // TODO: Initialize visible chunks.
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Utils
  function clearSelection() {
    selection.update((v) => {
      v.clear();
      return v;
    });
  }

  /**
   * Bound x,y,width,height by boundaries from settings.
   * @param x
   * @param y
   * @param width
   * @param height
   */
  function applyBounds(x: number, y: number, width: number, height: number) {
    let outX = x;
    let outY = y;
    if ($settings.BOUNDS?.minX !== null && x < $settings.BOUNDS!.minX) {
      outX = $settings.BOUNDS!.minX;
    } else if ($settings.BOUNDS?.maxX !== null && x + width > $settings.BOUNDS!.maxX) {
      outX = $settings.BOUNDS!.maxX - width;
    }

    if ($settings.BOUNDS?.minY !== null && y < $settings.BOUNDS!.minY) {
      outY = $settings.BOUNDS!.minY;
    } else if ($settings.BOUNDS?.maxY !== null && y + height > $settings.BOUNDS!.maxY) {
      outY = $settings.BOUNDS!.maxY - height;
    }
    return { x: outX, y: outY };
  }

  // UI Handlers
  let lastViewX = 0;
  let lastViewY = 0;
  function onWheel(e: WheelEvent) {
    // TODO: bypasses from setting
    // TODO: ZOOM
    if (e.ctrlKey && $settings.CAN_ZOOM) {
      e.preventDefault();
      e.stopPropagation();
      mode.zoom();

      const absXOld = $viewOffset.x + e.clientX / $zoom;
      const absYOld = $viewOffset.y + e.clientY / $zoom;

      const delta = e.deltaY / 1000;
      const newZoom = $zoom - delta * 4; // TODO: CLAMP // TODO: Zoom sensitivity cfg?

      const absXNew = $viewOffset.x + e.clientX / newZoom;
      const absYNew = $viewOffset.y + e.clientY / newZoom;
      const offsetX = absXOld - absXNew;
      const offsetY = absYOld - absYNew;

      viewOffset.set(
        { x: $viewOffset.x + offsetX, y: $viewOffset.y + offsetY },
        { duration: 0, hard: true }
      );
      zoom.set(newZoom, { duration: 0 });

      // TODO: Dispatch zoom reset
      debounce("end_zoom", 100, mode.idle);
    } else if ($settings.CAN_PAN) {
      if (hasClassOrParentWithClass(e.target as HTMLElement, "tela-ignore")) return;
      e.preventDefault();
      e.stopPropagation();
      mode.pan(); // TODO: only if not already?

      let deltaX =
        $settings.PAN_DIRECTION === "xy" || $settings.PAN_DIRECTION === "x" ? e.deltaX / $zoom : 0;
      const deltaY =
        $settings.PAN_DIRECTION === "xy" || $settings.PAN_DIRECTION === "y" ? e.deltaY / $zoom : 0;

      // if (!hasClassOrParentWithClass(e.target as HTMLElement, "draggable")) {
      if ($settings.PAN_DIRECTION === "x") {
        deltaX += e.deltaY / $zoom;
        // mode.pan();
      }
      // } else {
      //   if (deltaX < 20 && deltaX > -20) {deltaX = 0;}
      //   else {
      //     mode.pan();
      //   }
      // }

      // TODO: BOUND MAX
      let boundX = Math.floor($viewOffset.x + deltaX); // TODO: works with zoom also? prob. not..
      let boundY = Math.floor($viewOffset.y + deltaY);
      if (boundX === lastViewX && boundY === lastViewY) return;

      // This monster is responsible for the "rubber band" effect / hard limits
      let reachedBounds = false;

      if (isFinite($settings.BOUNDS.minX) && boundX < $settings.BOUNDS.minX) {
        boundX = $settings.BOUNDS.minX;
        reachedBounds = true;
      } else if (
        isFinite($settings.BOUNDS.maxX) &&
        boundX + $viewPort.w / $zoom > $settings.BOUNDS.maxX
      ) {
        boundX = $settings.BOUNDS.maxX - $viewPort.w / $zoom;
        reachedBounds = true;
      } else if (isFinite($settings.BOUNDS.minY) && boundY < $settings.BOUNDS.minY) {
        boundY = $settings.BOUNDS.minY;
        reachedBounds = true;
      } else if (
        isFinite($settings.BOUNDS.maxY) &&
        boundY + $viewPort.h / $zoom > $settings.BOUNDS.maxY
      ) {
        boundY = $settings.BOUNDS.maxY - $viewPort.h / $zoom;
        reachedBounds = true;
      }

      if ($settings.BOUNDS.limit === "soft") {
        viewOffset.set({ x: boundX, y: boundY }, reachedBounds ? { soft: 0.07 } : { hard: true });
      } else {
        viewOffset.set({ x: boundX, y: boundY }, { duration: 0 });
      }

      lastViewX = boundX;
      lastViewY = boundY;

      // TODO: Done event --> use native pan method

      debounce("end_scroll_pan", 100, mode.idle);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === "0") {
      $settings.DEV = !$settings.DEV;
    } else if ($mode === "idle" && e.key === "Escape") {
      clearSelection();
    } else if (e.key === "Escape") {
      mode.idle();
    }
  }

  // TELA Handlers
  // Idle
  /**
   * Use capture, to ensure select also works on top of draggable stuff.
   */
  function onMouseDown_idleCapture(e: MouseEvent | TouchEvent) {
    if (!e.shiftKey) return;
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );
    // e.stopPropagation();
    // e.preventDefault();

    select_init.x = absX;
    select_init.y = absY;
    $state.selectionRect.set({
      x: absX,
      y: absY,
      w: 0,
      h: 0
    });
    mode.select();
  }
  function onMouseDown_idle(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    if (
      hasClassOrParentWithClass(e.target as HTMLElement, "positionable") ||
      hasClassOrParentWithClass(e.target as HTMLElement, "draggable") ||
      hasClassOrParentWithClass(e.target as HTMLElement, "resizable")
    )
      return;
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    // e.stopPropagation();
    // e.preventDefault();

    select_init.x = absX;
    select_init.y = absY;
    $state.selectionRect.set({
      x: absX,
      y: absY,
      w: 0,
      h: 0
    });
    mode.modSelect();
  }

  // Select
  function onMouseMove_select(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );
    const offsetX = absX - select_init.x;
    const offsetY = absY - select_init.y;

    let x = select_init.x;
    let y = select_init.y;
    let w = offsetX;
    let h = offsetY;

    if (offsetX < 0) {
      x = absX;
      w = Math.abs(offsetX);
    }
    if (offsetY < 0) {
      y = absY;
      h = Math.abs(offsetY);
    }

    $state.selectionRect.update((v) => {
      v!.x = x;
      v!.y = y;
      v!.w = w;
      v!.h = h;
      return v;
    });

    selection.update((_selection) => {
      _selection.clear(); // TODO: Allow select multiple, off screen also?
      $visiblePositionables.forEach((_card) => {
        const c = get(_card);
        if (rectsIntersect({ x: c.x, y: c.y, w: c.width, h: c.height }, { x, y, w, h })) {
          _selection.add(c[POSITIONABLE_KEY]);
        } else {
          _selection.delete(c[POSITIONABLE_KEY]);
        }
      });
      return _selection;
    });
    // deprecated: dispatch("selectChange", { rect: { x, y, w, h }, visibleCards });
  }

  // MetaSelect
  function onMouseMove_modSelect(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target;
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );
    const offsetX = absX - select_init.x;
    const offsetY = absY - select_init.y;

    let x = select_init.x;
    let y = select_init.y;
    let w = offsetX;
    let h = offsetY;

    if (offsetX < 0) {
      x = absX;
      w = Math.abs(offsetX);
    }
    if (offsetY < 0) {
      y = absY;
      h = Math.abs(offsetY);
    }

    $state.selectionRect.update((v) => {
      v!.x = x;
      v!.y = y;
      v!.w = w;
      v!.h = h;
      return v;
    });

    dispatch("modSelectChange", { rect: $selectionRect });
  }
  function onMouseUp_modSelect(e: MouseEvent | TouchEvent) {
    dispatch("modSelectEnd", { rect: $selectionRect });
    mode.idle();
  }

  const dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }, // TODO: Do we need this? -> Can we merge with relativeOffset?
    relativeOffset: { x: 0, y: 0 },
    positionableInit: { x: 0, y: 0 }
  };
  function draggable_onMouseDown(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    moveToStackingTop(stackingOrder, get(positionable)[POSITIONABLE_KEY]);

    positionable.update((p) => {
      dragState.init.x = absX;
      dragState.init.y = absY;
      dragState.curr.x = absX;
      dragState.curr.y = absY;
      dragState.relativeOffset.x = absX - p.x;
      dragState.relativeOffset.y = absY - p.y;
      dragState.positionableInit.x = p.x;
      dragState.positionableInit.y = p.y;

      p.x = absX - dragState.relativeOffset.x;
      p.y = absY - dragState.relativeOffset.y;
      return p;
    });
  }
  function draggable_onMouseMove(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    let startedDragging = false;
    if ($mode !== "dragging") {
      startedDragging = true;
      mode.dragging();
    }

    dragState.offset.x = absX - dragState.init.x;
    dragState.offset.y = absY - dragState.init.y;
    dragState.curr.x = absX;
    dragState.curr.y = absY;

    positionable.update((p) => {
      const { x: boundX, y: boundY } = applyBounds(
        absX - dragState.relativeOffset.x,
        absY - dragState.relativeOffset.y,
        p.width,
        p.height
      );

      p.x = boundX;
      p.y = boundY;
      return p;
    });

    if (startedDragging) {
      dispatch("draggableStart", { positionable });
    }
  }
  function draggable_onMouseUp(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    const initChunkX = Math.floor(dragState.positionableInit.x / CHUNK_WIDTH);
    const initChunkY = Math.floor(dragState.positionableInit.y / CHUNK_WIDTH);
    let targetChunkX: number;
    let targetChunkY: number;

    // TODO3: Issues cuz update positionable before chunks?
    positionable.update((p) => {
      const { x: boundX, y: boundY } = applyBounds(
        absX - dragState.relativeOffset.x,
        absY - dragState.relativeOffset.y,
        p.width,
        p.height
      );

      // p.x = boundX;
      // p.y = boundY;

      // let x = absX - dragState.relativeOffset.x;
      // let y = absY - dragState.relativeOffset.y;
      if ($settings.SNAP_TO_GRID) {
        p.x = snapToGrid(boundX, $settings.GRID_SIZE);
        p.y = snapToGrid(boundY, $settings.GRID_SIZE);
      } else {
        p.x = boundX;
        p.y = boundY;
      }

      targetChunkX = Math.floor(p.x / CHUNK_WIDTH);
      targetChunkY = Math.floor(p.y / CHUNK_HEIGHT);

      // Remove from old chunk (It will automatically get added to the new one by the reactive logic at the beginning).
      if (!p.hoisted) {
        chunks.update(_chunks => {
          const initChunkId = `${initChunkX}:${initChunkY}`;
          const targetChunkId = `${targetChunkX}:${targetChunkY}`;
          if (initChunkId === targetChunkId) return _chunks;
          const initChunk = _chunks.get(initChunkId);

          if (initChunk === undefined) {
            console.error(
              initChunk !== undefined,
              `[draggable_onMouseUp] Chunk ${initChunkId} not found!`
            );
          } else {
            let empty = false;
            initChunk.update((_positionables) => {
              const i = _positionables.indexOf(positionable);
              _positionables.splice(i, 1);
              empty = _positionables.length === 0;
              // TODO: What if indexOf returns -1?
              return _positionables;
            });
            if (empty) {
              _chunks.delete(initChunkId);
            }
          }

          return _chunks;
        })
      }

      return p;
    });

    positionables.update(v => v);

    //const initChunkX = Math.floor((dragState.init.x - dragState.relativeOffset.x) / CHUNK_WIDTH);
    //const initChunkY = Math.floor((dragState.init.y - dragState.relativeOffset.y) / CHUNK_HEIGHT);
    //const targetChunkX = Math.floor((dragState.curr.x - dragState.relativeOffset.x) / CHUNK_WIDTH);
    //const targetChunkY = Math.floor((dragState.curr.y - dragState.relativeOffset.y) / CHUNK_HEIGHT);

    // Update chunk
    // TODO: Snapping to grid can make this off by a chunk -> Use final position instead!
    // if (!get(positionable).hoisted) {
    //   chunks.update((_chunks) => {
    //     const initChunkId = `${initChunkX}:${initChunkY}`;
    //     const targetChunkId = `${targetChunkX}:${targetChunkY}`;

    //     console.log("intiChunk", initChunkId);
    //     console.log("targetChunk", targetChunkId);

    //     if (initChunkId === targetChunkId) return _chunks;

    //     const initChunk = _chunks.get(initChunkId);
    //     const targetChunk = _chunks.get(targetChunkId);

    //     console.log("initChunk", initChunk);
    //     console.log("targetChunk", targetChunk);

    //     // TODO: THis is broken again!!
    //     // if (initChunk === undefined) {
    //     //   console.error(
    //     //     initChunk !== undefined,
    //     //     `[draggable_onMouseUp] Chunk ${initChunkId} not found!`
    //     //   );
    //     // } else {
    //     //   let empty = false;
    //     //   initChunk.update((_positionables) => {
    //     //     _positionables.splice(_positionables.indexOf(positionable), 1);
    //     //     empty = _positionables.length === 0;
    //     //     // TODO: What if indexOf returns -1?
    //     //     return _positionables;
    //     //   });
    //     //   if (empty) {
    //     //     _chunks.delete(initChunkId);
    //     //   }
    //     // }
    //     // if (targetChunk === undefined) {
    //     //   _chunks.set(targetChunkId, writable([positionable]));
    //     // } else {
    //     //   targetChunk.update((_positionables) => {
    //     //     _positionables.push(positionable);
    //     //     return _positionables;
    //     //   });
    //     // }

    //     return _chunks;
    //   });
    // }

    mode.idle();
    dispatch("draggableEnd", positionable);
  }

  function resizable_onMouseDown(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    mode.resizing();
    moveToStackingTop(stackingOrder, get(positionable)[POSITIONABLE_KEY]);

    dragState.init.x = absX;
    dragState.init.y = absY;
    dragState.curr.x = absX;
    dragState.curr.y = absY;
    dragState.relativeOffset.x = absX - clientX;
    dragState.relativeOffset.y = absY - clientY;
    dragState.positionableInit.x = get(positionable).x;
    dragState.positionableInit.y = get(positionable).y;
  }
  function resizable_onMouseMove(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
      direction: TResizeDirection;
      minSize: Vec2<number>;
      maxSize: Vec2<number>;
    }>
  ) {
    const { positionable, clientX, clientY, direction, minSize, maxSize } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );

    dragState.offset.x = absX - dragState.init.x;
    dragState.offset.y = absY - dragState.init.y;
    dragState.curr.x = absX;
    dragState.curr.y = absY;

    positionable.update((p) => {
      let x = p.x;
      let y = p.y;
      let width = p.width;
      let height = p.height;

      // TODO: CLAMPS
      // TODO: PREVENT MOVING OVER INITIAL WIDTH & POS

      if (direction === "right") {
        width = clamp(absX - p.x, minSize.x, maxSize.x);
      } else if (direction === "bottom") {
        height = absY - p.y;
      } else if (direction === "top") {
        y = absY;
        height = p.y + p.height - absY;
      } else if (direction === "left") {
        x = absX;
        width = p.x + p.width - absX;
      } else if (direction === "top-left") {
        x = absX;
        y = absY;
        width = p.x + p.width - absX;
        height = p.y + p.height - absY;
      } else if (direction === "top-right") {
        y = absY;
        width = absX - p.x;
        height = p.y + p.height - absY;
      } else if (direction === "bottom-left") {
        x = absX;
        width = p.x + p.width - absX;
        height = absY - p.y;
      } else if (direction === "bottom-right") {
        width = absX - p.x;
        height = absY - p.y;
      }

      // TODO: MIN HEIGHT
      width = clamp(width, minSize.x, maxSize.x);
      height = clamp(height, minSize.y, maxSize.y);
      // TODO: MIN WIDHT

      // TODO: BOUNDS CHECKING
      const { x: boundX, y: boundY } = applyBounds(x, y, width, height);

      p.x = boundX;
      p.y = boundY;
      p.width = width;
      p.height = height;
      return p;
    });

    dispatch("resizableStart", { positionable });
  }
  function resizable_onMouseUp(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent;
      positionable: Writable<IPositionable<any>>;
      clientX: number;
      clientY: number;
      direction: TResizeDirection;
      minSize: number;
      maxSize: number;
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail;
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    );
    // TODO: BOUNDS CHECKING& APPLY final pos

    const initChunkX = Math.floor(dragState.positionableInit.x / CHUNK_WIDTH);
    const initChunkY = Math.floor(dragState.positionableInit.y / CHUNK_WIDTH);
    let targetChunkX: number;
    let targetChunkY: number;

    positionable.update((p) => {
      let x = p.x;
      let y = p.y;
      let width = p.width;
      let height = p.height;

      if ($settings.SNAP_TO_GRID) {
        x = snapToGrid(x, $settings.GRID_SIZE);
        y = snapToGrid(y, $settings.GRID_SIZE);
        width = snapToGrid(width, $settings.GRID_SIZE);
        height = snapToGrid(height, $settings.GRID_SIZE);
      }

      const { x: boundX, y: boundY } = applyBounds(x, y, width, height);

      p.x = boundX;
      p.y = boundY;
      p.width = width;
      p.height = height;

      targetChunkX = Math.floor(p.x / CHUNK_WIDTH);
      targetChunkY = Math.floor(p.y / CHUNK_HEIGHT);
      return p;
    });

    // TODO: Move into singel functoon
    // Update chunk
    if (!get(positionable).hoisted) {
      chunks.update((_chunks) => {
        const initChunkId = `${initChunkX}:${initChunkY}`;
        const targetChunkId = `${targetChunkX}:${targetChunkY}`;

        if (initChunkId === targetChunkId) return _chunks;

        const initChunk = _chunks.get(initChunkId);
        const targetChunk = _chunks.get(targetChunkId);

        // TODO: THis is broken again!!
        if (initChunk === undefined) {
          console.error(
            initChunk === undefined,
            `[draggable_onMouseUp] Chunk ${initChunkId} not found!`
          );
        } else {
          let empty = false;
          initChunk.update((_positionables) => {
            _positionables.splice(_positionables.indexOf(positionable), 1);
            empty = _positionables.length === 0;
            // TODO: What if indexOf returns -1?
            return _positionables;
          });
          if (empty) {
            _chunks.delete(initChunkId);
          }
        }
        if (targetChunk === undefined) {
          _chunks.set(targetChunkId, writable([positionable]));
        } else {
          targetChunk.update((_positionables) => {
            _positionables.push(positionable);
            return _positionables;
          });
        }

        return _chunks;
      });
    }

    mode.idle();
    dispatch("resizableEnd", positionable);
  }

  function positionable_hoist(e: CustomEvent<string>) {
    const key = e.detail;
    const positionable = $positionables.find((p) => get(p)[POSITIONABLE_KEY] === key);
    if (!positionable) {
      console.error(`[TELA] Tried to hoist non-existing positionable: ${key}`);
      return;
    }
    if (get(positionable).hoisted) return;

    positionable.update((p) => {
      // Remove from chunk
      const cI = `${Math.floor(p.x / CHUNK_WIDTH)}:${Math.floor(p.y / CHUNK_HEIGHT)}`;
      const chunk = $chunks.get(cI);
      if (chunk !== undefined) {
        chunks.update((_chunks) => {
          let empty = false;
          chunk.update((_chunk) => {
            // TODO: Perf: Compare perf of findIndex vs indexOf
            // const i = _chunk.findIndex(e => get(e)[POSITIONABLE_KEY] === key);
            const i = _chunk.indexOf(positionable);
            if (i !== -1) _chunk.splice(i, 1);
            if (_chunk.length <= 0) empty = true;
            return _chunk;
          });
          if (empty) {
            _chunks.delete(cI);
          }
          return _chunks;
        });
      }

      // @ts-ignore we want this!
      p.hoisted = true;
      return p;
    });

    positionables.update(v => v);
  }
  function positionable_unHoist(e: CustomEvent<string>) {
    const key = e.detail;
    const positionable = $positionables.find((p) => get(p)[POSITIONABLE_KEY] === key);
    if (!positionable) {
      console.error(`[TELA] Tried to un-hoist non-existing positionable: ${key}`);
      return;
    }
    if (!get(positionable).hoisted) return;
    hoistedPositionables.update(_hoisted => {
      return _hoisted;
    })
    positionable.update((p) => {
      // @ts-ignore we want this!
      p.hoisted = false;
      return p;
    });

    positionables.update(v => v);
  }

  onMount(() => {
    containerEl.addEventListener("draggable_onMouseDown", draggable_onMouseDown);
    containerEl.addEventListener("draggable_onMouseMove", draggable_onMouseMove);
    containerEl.addEventListener("draggable_onMouseUp", draggable_onMouseUp);
    containerEl.addEventListener("resizable_onMouseDown", resizable_onMouseDown);
    containerEl.addEventListener("resizable_onMouseMove", resizable_onMouseMove);
    containerEl.addEventListener("resizable_onMouseUp", resizable_onMouseUp);
    containerEl.addEventListener("tela_hoist", positionable_hoist);
    containerEl.addEventListener("tela_unhoist", positionable_unHoist);
  });
  onDestroy(() => {
    containerEl && containerEl.removeEventListener("draggable_onMouseDown", draggable_onMouseDown);
    containerEl && containerEl.removeEventListener("draggable_onMouseMove", draggable_onMouseMove);
    containerEl && containerEl.removeEventListener("draggable_onMouseUp", draggable_onMouseUp);
    containerEl && containerEl.removeEventListener("resizable_onMouseDown", resizable_onMouseDown);
    containerEl && containerEl.removeEventListener("resizable_onMouseMove", resizable_onMouseMove);
    containerEl && containerEl.removeEventListener("resizable_onMouseUp", resizable_onMouseUp);
    containerEl && containerEl.removeEventListener("tela_hoist", positionable_hoist);
    containerEl && containerEl.removeEventListener("tela_unhoist", positionable_unHoist);
  });
</script>

<svelte:window on:keydown={onKeyDown} />
<!-- <svelte:options immutable={true} /> -->

<!--
  TODO: switch to use resize observer to update viewport
-->
<div
  class="tela-container {$$restProps.class || ''}"
  bind:this={containerEl}
  on:wheel={onWheel}
  on:wheel
  on:mousedown={(e) => {
    if (!hasClassOrParentWithClass(e.target, "draggable")) clearSelection();
  }}
  on:mousedown
>
  {#if $settings.DEV}
    <ul class="dev" style="list-style: none;">
      <li>
        <ul class="dev-txt" style="list-style: none;">
          <!-- TODO: Dynamic version inject -->
          <span style="margin-bottom: 8px;"
            ><i>Tela <small style="color: #b7b7c4;">v3.0.0</small></i></span
          >
          <li><span>Mode:</span><span>{$mode}</span></li>
          <li><span>Zoom:</span><span>{$zoom}</span></li>
          <li>
            <!-- <span>Offset:</span><span
              >{$viewOffset.x}, {$viewOffset.y} // {Math.floor($viewOffset.x / CHUNK_WIDTH)}, {Math.floor(
                $viewOffset.y / CHUNK_HEIGHT
              )}</span
            > -->
            <span>Offset:</span><span
              >{$viewOffset.x}, {$viewOffset.y} // {$chunkOffset.x}, {$chunkOffset.y}</span
            >
          </li>
          <li>
            <span>Viewport:</span><span
              >{$viewPort.x}, {$viewPort.y}, {$viewPort.w}, {$viewPort.h}</span
            >
          </li>
          <li><span>N-Chunks:</span><span>{$chunks.size}</span></li>
          <li><span>Hot Chunks:</span><span>{$visibleChunks.length}</span></li>
          <li><span>N-Cards:</span><span>{$positionables.length}</span></li>
          <li>
            <span>Hot Cards:</span><span
              >{$visiblePositionables.length}
              <small>({$hoistedPositionables.length} hoisted)</small></span
            >
          </li>
          <!-- <li>
            <span>Drag Start Delay ({$dragDelay}):</span><span
              ><input type="range" bind:value={$dragDelay} min="1" max="3000" /></span
            >
          </li>
          <li>
            <span>Drag Abort Move ({$dragAbortMin}):</span><span
              ><input type="range" bind:value={$dragAbortMin} min="1" max="200" /></span
            >
          </li> -->
          <!-- NOTE: Major perf hit due to conditional slot. -->
          <!-- TODO: Look into optimizing dev overlay perf -->
          <!-- <slot name="dev" /> -->
        </ul>
      </li>
      <br />
      <DebugPanels />
    </ul>
  {/if}

  <div class="tela-board mode-{$mode}" style={transformCss}>
    {#if $mode === "select" || $mode === "modSelect"}
      <slot name="selectRect" />
    {/if}

    {#if $settings.DEV}
      <!-- TODO: This requires updating lib users to Svelte4 -->
      <!-- TODO: Perf use iterator is much faster: https://github.com/sveltejs/svelte/issues/7425#issuecomment-1461021936 -->
      <!-- Depends on implementation using map -->
      <!-- {#each $visibleChunks as [chunkId, _] (chunkId)} -->
      {#each $visibleChunks as [chunkId, _] (chunkId)}
        {@const index = chunkId.split(":")}
        {@const chunkX = parseInt(index[0])}
        {@const chunkY = parseInt(index[1])}
        <ChunkOverlay {chunkX} {chunkY} />
      {/each}
    {/if}

    {#each $visiblePositionables as positionable (get(positionable)[POSITIONABLE_KEY])}
      <slot {positionable} />
    {/each}

    <slot name="raw" />
  </div>
</div>

<style>
  .tela-container {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    overscroll-behavior: contain;
    width: 100%;
    height: 100%;
  }
  .tela-container * {
    box-sizing: border-box;
  }
  .tela-board {
    position: absolute;
    backface-visibility: hidden;
  }
  .tela-container > .dev {
    margin: 0;
    position: absolute;
    font-family: monospace;
    right: 1ch;
    top: 1ch;
    z-index: 9999999;
    padding: 4px;
    display: flex;
    flex-direction: column;
    /* TODO: Reenable */
    user-select: none;
    /* pointer-events: none; */
  }
  .tela-container > .dev .dev-txt {
    margin: 0;
    font-size: 0.85em;
    font-family: monospace;
    background: darkblue;
    color: #fff;
    padding: 4px;
    display: flex;
    flex-direction: column;
    /* TODO: Reenable */
    user-select: none;
    /* pointer-events: none; */
  }
  :global(.tela-container > .dev .dev-txt li :first-child) {
    color: #b7b7c4;
  }
  :global(.tela-container > .dev .dev-txt li) {
    display: flex;
    justify-content: space-between;
    gap: 1.5ch;
  }
</style>
