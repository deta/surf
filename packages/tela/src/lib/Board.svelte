<svelte:options immutable={true} />

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
      PAN_DIRECTION: 'xy',

      CAN_DRAW: true,
      CAN_ZOOM: true,
      CAN_SELECT: true,
      SNAP_TO_GRID: false,
      GRID_SIZE: 20,

      EDGE_SNAP: true,
      EDGE_SNAP_FACTOR: 1,

      QUICK_SNAP: true,
      QUICK_SNAP_THRESHOLD: 25,

      // CULL: true,
      // CULL_MARGIN: 200,

      CHUNK_WIDTH: 500,
      CHUNK_HEIGHT: 500,
      // CHUNK_CULL_MARGIN: 2000,
      // CHUNK_WARM_MARGIN: 1,

      POSITIONABLE_KEY: 'key',

      DEV: false,

      ...settings,
      BOUNDS: {
        minX: -Infinity,
        maxX: Infinity,
        minY: -Infinity,
        maxY: Infinity,
        minZoom: 0.3,
        maxZoom: 1,
        limit: 'soft',
        ...settings.BOUNDS
      }
    })
  }

  export function createBoard<BaseSt extends BaseState, Actions>(
    settings: Writable<IBoardSettings>,
    stackingOrder: Writable<string[]>,
    initState: DeepPartial<IBoardState<BaseSt, Actions>>,
    initMode: string,
    modes: {}
  ): IBoard<BaseSt, Actions> {
    const cfg = get(settings)
    const selectionRect = writable({ x: 0, y: 0, w: 0, h: 0 })

    initState = {
      zoom: writable(1),
      ...initState,
      viewOffset:
        cfg.BOUNDS.limit === 'soft'
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
    }

    const state = writable<IBoardState<BaseSt, Actions>>(initState as IBoardState<BaseSt, Actions>)
    const viewOffset = get(state).viewOffset
    const zoom = get(state).zoom

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
      }
      viewOffset.update((v) => {
        v.x = x
        v.y = y
        return v
      }, opts)
    }
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
      }
      zoom.set(targetZoom, opts)
    }

    return {
      state,
      panTo,
      zoomTo
    }
  }

  export function moveToStackingTop(stack: Writable<string[]>, key: string) {
    stack.update((_stack) => {
      const i = _stack.indexOf(key)
      if (i !== -1) _stack.splice(i, 1)
      _stack.push(key)
      return _stack
    })

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
  import { createEventDispatcher, onDestroy, onMount, setContext, tick } from 'svelte'
  import { derived, get, writable, type Writable } from 'svelte/store'
  import type { IBoard, IBoardSettings, IBoardState } from './types/Board.type.js'
  import type { DeepPartial, Vec2 } from './types/Utils.type.js'
  import { spring, tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import DebugPanels from './DebugPanels.svelte'
  import type { BaseState } from './state-machine/fsm.js'
  import fsm from './state-machine/fsm.js'
  import {
    clamp,
    debounce,
    fastFilter,
    hasClassOrParentWithClass,
    isInsidePositionable,
    isInsideViewport,
    posToAbsolute,
    rectsIntersect,
    snapToEdges,
    snapToGrid
  } from './utils.js'
  import type { IPositionable } from './Positionable.svelte'
  import type { TResizeDirection } from './Resizable.svelte'
  import ChunkOverlay from './ChunkOverlay.svelte'

  const dispatch = createEventDispatcher()
  export let containerEl: HTMLElement

  export let settings: Writable<IBoardSettings>
  export let board: IBoard<any, any>
  export let positionables: Writable<Writable<IPositionable<any>>[]> = writable([])

  setContext('board', board)
  setContext('settings', settings)

  const CHUNK_WIDTH = $settings.CHUNK_WIDTH
  const CHUNK_HEIGHT = $settings.CHUNK_HEIGHT
  const POSITIONABLE_KEY = $settings.POSITIONABLE_KEY

  const state = board.state
  const viewOffset = $state.viewOffset // TODO: Can we use custom stores with requestAnimationFrame for scrolling?

  const chunkOffset = writable({ x: 0, y: 0 })
  onDestroy(
    viewOffset.subscribe((_offset) => {
      const chunkX = Math.floor(_offset.x / CHUNK_WIDTH)
      const chunkY = Math.floor(_offset.y / CHUNK_HEIGHT)
      if ($chunkOffset.x !== chunkX) {
        chunkOffset.update((v) => {
          v.x = chunkX
          return v
        })
      }
      if ($chunkOffset.y !== chunkY) {
        chunkOffset.update((v) => {
          v.y = chunkY
          return v
        })
      }
    })
  )

  const viewPort = $state.viewPort
  const zoom = $state.zoom
  $: mode = $state.mode
  const selection = $state.selection
  const selectionRect = $state.selectionRect
  const stackingOrder = $state.stackingOrder

  const allowQuickSnap = writable(false)
  let showQuickSnapGuides = false

  // $: transformCss = `transform-origin: top left; transform: ${
  //   $zoom !== 1 ? `scale(${$zoom * 100}%)` : ""
  // } translate3d(${-$viewOffset.x}px, ${-$viewOffset.y}px, 0); ${
  //   $mode === "pan" ? "will-change: transform;" : ""
  // }`;
  $: transformCss = `transform-origin: top left; transform: scale(1) translate3d(${-$viewOffset.x}px, ${-$viewOffset.y}px, 0); ${
    $mode === 'pan' ? 'will-change: transform;' : ''
  }`

  board.state.update((v) => {
    v.mode = fsm('idle', {
      idle: {
        pan: 'pan',
        autoPan: 'autoPan',
        zoom: 'zoom',
        autoZoom: 'autoZoom',
        select: 'select',
        modSelect: 'modSelect',

        dragging: 'dragging',
        resizing: 'resizing',

        _enter() {
          tick().then(() => containerEl.addEventListener('mousedown', onMouseDown_idle))
          tick().then(() =>
            containerEl.addEventListener('mousedown', onMouseDown_idleCapture, { capture: true })
          )
        },
        _exit() {
          containerEl.removeEventListener('mousedown', onMouseDown_idle)
          containerEl.removeEventListener('mousedown', onMouseDown_idleCapture)
        }
      },
      pan: {
        idle: 'idle',
        _exit() {
          dispatch('panEnd', {})
        }
      },
      autoPan: {
        idle: 'idle'
      },
      zoom: {
        idle: 'idle'
      },
      autoZoom: {
        idle: 'idle'
      },
      select: {
        idle: 'idle',

        _enter() {
          document.addEventListener('mousemove', onMouseMove_select)
          document.addEventListener('mouseup', mode.idle)
        },
        _exit() {
          $state.selectionRect.set(null)
          select_init.x = 0
          select_init.y = 0
          document.removeEventListener('mousemove', onMouseMove_select)
          document.removeEventListener('mouseup', mode.idle)
        }
      },
      modSelect: {
        idle: 'idle',

        _enter() {
          document.addEventListener('mousemove', onMouseMove_modSelect)
          document.addEventListener('mouseup', onMouseUp_modSelect)
        },
        _exit() {
          $state.selectionRect.set(null)
          select_init.x = 0
          select_init.y = 0
          document.removeEventListener('mousemove', onMouseMove_modSelect)
          document.removeEventListener('mouseup', onMouseUp_modSelect)
        }
      },

      dragging: {
        idle: 'idle'
      },
      resizing: {
        idle: 'idle'
      }
      // TODO: add custom actions
    })
    return v
  })

  // Bound Zoom
  onDestroy(
    zoom.subscribe((e) => {
      if (e < $settings.BOUNDS.minZoom) {
        zoom.set($settings.BOUNDS.minZoom)
      } else if (e > $settings.BOUNDS.maxZoom) {
        zoom.set($settings.BOUNDS.maxZoom)
      }
    })
  )

  let resizeObserver: ResizeObserver
  const select_init = { x: 0, y: 0 }
  // Hoisted positionables will live outside the chunking / culling -> Always be loaded
  const hoistedPositionables = writable<Writable<IPositionable<any>>[]>([])
  const chunks = writable(new Map<string, Writable<Writable<IPositionable<any>>[]>>())
  onDestroy(
    positionables.subscribe((_positionables) => {
      hoistedPositionables.update((_hoisted) => {
        chunks.update((_chunks) => {
          // Remove unused from hoisted.
          _hoisted.forEach((_h, i) => {
            // TODO: perf .forEach
            if (!_positionables.includes(_h) || get(_h).hoisted !== true) {
              _hoisted.splice(i, 1)
            }
          })

          // Remove unused from chunks.
          for (const chunk of _chunks.entries()) {
            const [chunkId, chunkPositionables] = chunk
            let empty = false
            chunkPositionables.update((_chunkPositionables) => {
              _chunkPositionables.forEach((_cP) => {
                if (!_positionables.includes(_cP)) {
                  const index = _chunkPositionables.indexOf(_cP)
                  if (index !== -1) _chunkPositionables.splice(index, 1)
                  if (_chunkPositionables.length <= 0) empty = true
                }
              })
              return _chunkPositionables
            })
            if (empty) _chunks.delete(chunkId)
          }

          _positionables.forEach((_positionable) => {
            const p = get(_positionable)
            const cI = `${Math.floor(p.x / CHUNK_WIDTH)}:${Math.floor(p.y / CHUNK_HEIGHT)}`

            // Add Hoisted.
            // TODO: See if we can make this operate only on the positionable that changed instead of the whole array.
            if (get(_positionable).hoisted === true) {
              // Remove from chunk
              if (_chunks.has(cI)) {
                const c = _chunks.get(cI)!
                c.update((_c) => {
                  const index = _c.indexOf(_positionable)
                  if (index !== -1) _c.splice(index, 1)
                  return _c
                })
              }

              if (!_hoisted.includes(_positionable)) {
                _hoisted.push(_positionable)
              }
              return
            }

            // Chunked behaviour.
            else {
              if (!_chunks.has(cI)) {
                _chunks.set(cI, writable([_positionable]))
              } else {
                const c = _chunks.get(cI)!
                if (!get(c).includes(_positionable)) {
                  c.update((_c) => {
                    _c.push(_positionable)
                    return _c
                  })
                }
              }
            }
          })
          return _chunks
        })
        return _hoisted
      })
    })
  )

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
      const index = entry[0]
      const chunkX = parseInt(index.split(':')[0])
      const chunkY = parseInt(index.split(':')[1])
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
        return true
      } else {
        return false
      }
    }, Array.from(values[0].entries()))
  })

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
  let oldVisiblePositionables: string[] = []
  const visiblePositionables = derived(
    [positionables, hoistedPositionables, visibleChunks],
    (values) => {
      const _positionables = values[0]
      const _hoistedPositionables = values[1]
      const _visibleChunks = values[2]
      // TODO: Remove dev
      const visible =
        _positionables.length <= 0
          ? _positionables
          : [
              ..._hoistedPositionables,
              ...fastFilter(
                (e) => {
                  const _e = get(e)
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
                  )
                },
                _visibleChunks.map((_p) => get(_p[1])).flat()
              )
            ]

      const visibleIds = visible.map((e) => get(e)[POSITIONABLE_KEY])

      // Leave events.
      for (let i = 0; i < oldVisiblePositionables.length; i++) {
        const id = oldVisiblePositionables[i]
        if (!visibleIds.includes(id)) {
          dispatch('positionableLeave', id)
        }
      }

      // Enter events.
      for (let i = 0; i < visibleIds.length; i++) {
        const id = visibleIds[i]
        if (!oldVisiblePositionables.includes(id)) {
          dispatch('positionableEnter', id)
        }
      }
      oldVisiblePositionables = visibleIds

      return visible
    }
  )

  // TODO: Figure out if we still need the distinction / can consolidate
  // For now we are using this additional one because we REALLY do only want the visible ones.
  // 'visiblePositionables' contains all as they are now hoised permanently!
  const onScreenPositionables = derived(
    [positionables, hoistedPositionables, visibleChunks],
    (values) => {
      const _positionables = values[0]
      const _visibleChunks = values[2]
      // TODO: Remove dev
      const visible = [
        ...fastFilter((e) => {
          const _e = get(e)
          return isInsideViewport(
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
        }, _positionables)
      ]

      return visible
    }
  )

  onMount(() => {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        // Set viewport
        const { x, y, width, height } = containerEl.getBoundingClientRect()
        viewPort.update((v) => {
          v.x = v.x
          v.y = v.y // HACK: this is needed so the viewport matches the visual board position in the new horizon switcher
          v.w = width
          v.h = height
          return v
        })
      })
      resizeObserver.observe(containerEl)
    }
    // TODO: Initialize visible chunks.
  })

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  // Utils
  function clearSelection() {
    selection.update((v) => {
      v.clear()
      return v
    })
  }

  /**
   * Bound x,y,width,height by boundaries from settings.
   * @param x
   * @param y
   * @param width
   * @param height
   */
  function applyBounds(x: number, y: number, width: number, height: number) {
    let outX = x
    let outY = y
    if ($settings.BOUNDS?.minX !== null && x < $settings.BOUNDS!.minX) {
      outX = $settings.BOUNDS!.minX
    } else if ($settings.BOUNDS?.maxX !== null && x + width > $settings.BOUNDS!.maxX) {
      outX = $settings.BOUNDS!.maxX - width
    }

    if ($settings.BOUNDS?.minY !== null && y < $settings.BOUNDS!.minY) {
      outY = $settings.BOUNDS!.minY
    } else if ($settings.BOUNDS?.maxY !== null && y + height > $settings.BOUNDS!.maxY) {
      outY = $settings.BOUNDS!.maxY - height
    }
    return { x: outX, y: outY }
  }

  // UI Handlers
  let lastViewX = 0
  let lastViewY = 0
  function onWheel(e: WheelEvent) {
    // TODO: bypasses from setting
    // TODO: ZOOM
    if (e.ctrlKey && $settings.CAN_ZOOM) {
      e.preventDefault()
      e.stopPropagation()
      mode.zoom()

      const absXOld = $viewOffset.x + e.clientX / $zoom
      const absYOld = $viewOffset.y + e.clientY / $zoom

      const delta = e.deltaY / 1000
      const newZoom = $zoom - delta * 4 // TODO: CLAMP // TODO: Zoom sensitivity cfg?

      const absXNew = $viewOffset.x + e.clientX / newZoom
      const absYNew = $viewOffset.y + e.clientY / newZoom
      const offsetX = absXOld - absXNew
      const offsetY = absYOld - absYNew

      viewOffset.set(
        { x: $viewOffset.x + offsetX, y: $viewOffset.y + offsetY },
        { duration: 0, hard: true }
      )
      zoom.set(newZoom, { duration: 0 })

      // TODO: Dispatch zoom reset
      debounce('end_zoom', 100, mode.idle)
    } else if ($settings.CAN_PAN) {
      if (hasClassOrParentWithClass(e.target as HTMLElement, 'tela-ignore')) return
      // e.preventDefault();
      // e.stopPropagation();
      mode.pan() // TODO: only if not already?

      let deltaX =
        $settings.PAN_DIRECTION === 'xy' || $settings.PAN_DIRECTION === 'x' ? e.deltaX / $zoom : 0
      const deltaY =
        $settings.PAN_DIRECTION === 'xy' || $settings.PAN_DIRECTION === 'y' ? e.deltaY / $zoom : 0

      // if (!hasClassOrParentWithClass(e.target as HTMLElement, "draggable")) {
      if ($settings.PAN_DIRECTION === 'x') {
        if (deltaX === 0) {
          mode.idle()
        }
        if (!e.ctrlKey) {
          deltaX += e.deltaY / $zoom
          mode.pan()
        }
      }
      // } else {
      //   if (deltaX < 20 && deltaX > -20) {deltaX = 0;}
      //   else {
      //     mode.pan();
      //   }
      // }

      // TODO: BOUND MAX
      let boundX = Math.floor($viewOffset.x + deltaX) // TODO: works with zoom also? prob. not..
      let boundY = Math.floor($viewOffset.y + deltaY)
      if (boundX === lastViewX && boundY === lastViewY) return

      // This monster is responsible for the "rubber band" effect / hard limits
      let reachedBounds = false

      if (isFinite($settings.BOUNDS.minX) && boundX < $settings.BOUNDS.minX) {
        boundX = $settings.BOUNDS.minX
        reachedBounds = true
      } else if (
        isFinite($settings.BOUNDS.maxX) &&
        boundX + $viewPort.w / $zoom > $settings.BOUNDS.maxX
      ) {
        boundX = $settings.BOUNDS.maxX - $viewPort.w / $zoom
        reachedBounds = true
      } else if (isFinite($settings.BOUNDS.minY) && boundY < $settings.BOUNDS.minY) {
        boundY = $settings.BOUNDS.minY
        reachedBounds = true
      } else if (
        isFinite($settings.BOUNDS.maxY) &&
        boundY + $viewPort.h / $zoom > $settings.BOUNDS.maxY
      ) {
        boundY = $settings.BOUNDS.maxY - $viewPort.h / $zoom
        reachedBounds = true
      }

      if ($settings.BOUNDS.limit === 'soft') {
        viewOffset.set({ x: boundX, y: boundY }, reachedBounds ? { soft: 0.07 } : { hard: true })
      } else {
        viewOffset.set({ x: boundX, y: boundY }, { duration: 0 })
      }

      lastViewX = boundX
      lastViewY = boundY

      // TODO: Done event --> use native pan method

      debounce('end_scroll_pan', 100, () => {
        mode.idle()
      })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === '0') {
      $settings.DEV = !$settings.DEV
    } else if ($mode === 'idle' && e.key === 'Escape') {
      clearSelection()
    } else if (e.key === 'Escape') {
      mode.idle()
    }

    if ($mode === 'dragging') {
      if (e.shiftKey) {
        allowQuickSnap.set(true)
        showQuickSnapGuides = true
      }
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      allowQuickSnap.set(false)
      showQuickSnapGuides = false
    }
  }

  // TELA Handlers
  // Idle
  /**
   * Use capture, to ensure select also works on top of draggable stuff.
   */
  function onMouseDown_idleCapture(e: MouseEvent | TouchEvent) {
    if (!e.shiftKey) return
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )
    // e.stopPropagation();
    // e.preventDefault();

    select_init.x = absX
    select_init.y = absY
    $state.selectionRect.set({
      x: absX,
      y: absY,
      w: 0,
      h: 0
    })
    mode.select()
  }
  function onMouseDown_idle(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target
    if (
      hasClassOrParentWithClass(e.target as HTMLElement, 'positionable') ||
      hasClassOrParentWithClass(e.target as HTMLElement, 'draggable') ||
      hasClassOrParentWithClass(e.target as HTMLElement, 'resizable')
    )
      return
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    // e.stopPropagation();
    // e.preventDefault();

    select_init.x = absX
    select_init.y = absY
    $state.selectionRect.set({
      x: absX,
      y: absY,
      w: 0,
      h: 0
    })
    mode.modSelect()
  }

  // Select
  function onMouseMove_select(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )
    // console.log("viewport", $viewPort);
    // console.log("viewoffset", $viewOffset.x, $viewOffset.y);
    // console.log(
    //   "targetTouches",
    //   (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
    //   (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY
    // );
    // console.log({ absX, absY });
    const offsetX = absX - select_init.x
    const offsetY = absY - select_init.y

    let x = select_init.x
    let y = select_init.y
    let w = offsetX
    let h = offsetY

    if (offsetX < 0) {
      x = absX
      w = Math.abs(offsetX)
    }
    if (offsetY < 0) {
      y = absY
      h = Math.abs(offsetY)
    }

    $state.selectionRect.update((v) => {
      v!.x = x
      v!.y = y
      v!.w = w
      v!.h = h
      return v
    })

    selection.update((_selection) => {
      _selection.clear() // TODO: Allow select multiple, off screen also?
      $visiblePositionables.forEach((_card) => {
        const c = get(_card)
        if (rectsIntersect({ x: c.x, y: c.y, w: c.width, h: c.height }, { x, y, w, h })) {
          _selection.add(c[POSITIONABLE_KEY])
        } else {
          _selection.delete(c[POSITIONABLE_KEY])
        }
      })
      return _selection
    })
    // deprecated: dispatch("selectChange", { rect: { x, y, w, h }, visibleCards });
  }

  // MetaSelect
  function onMouseMove_modSelect(e: MouseEvent | TouchEvent) {
    const target = (e as TouchEvent).targetTouches?.item(0)?.target || (e as MouseEvent).target
    const { x: absX, y: absY } = posToAbsolute(
      (e as TouchEvent).targetTouches?.item(0)?.clientX || (e as MouseEvent).clientX,
      (e as TouchEvent).targetTouches?.item(0)?.clientY || (e as MouseEvent).clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )
    const offsetX = absX - select_init.x
    const offsetY = absY - select_init.y

    let x = select_init.x
    let y = select_init.y
    let w = offsetX
    let h = offsetY

    if (offsetX < 0) {
      x = absX
      w = Math.abs(offsetX)
    }
    if (offsetY < 0) {
      y = absY
      h = Math.abs(offsetY)
    }

    $state.selectionRect.update((v) => {
      v!.x = x
      v!.y = y
      v!.w = w
      v!.h = h
      return v
    })

    dispatch('modSelectChange', { rect: $selectionRect, event: e })
  }
  function onMouseUp_modSelect(e: MouseEvent | TouchEvent) {
    dispatch('modSelectEnd', { rect: $selectionRect, event: e })
    mode.idle()
  }

  const dragState = {
    draggingPositionable: null as Writable<IPositionable<any>> | null,
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }, // TODO: Do we need this? -> Can we merge with relativeOffset?
    relativeOffset: { x: 0, y: 0 },
    positionableInit: { x: 0, y: 0 },
    autoScroll: false
  }
  $: cardSnapGuideCss = dragState.draggingPositionable
    ? `top: ${snapToGrid(get(dragState.draggingPositionable).y, $settings.GRID_SIZE)}px; left: ${snapToGrid(get(dragState.draggingPositionable).x, $settings.GRID_SIZE)}px; width: ${snapToGrid(get(dragState.draggingPositionable).width, $settings.GRID_SIZE)}px; height: ${snapToGrid(get(dragState.draggingPositionable).height, $settings.GRID_SIZE)}px;`
    : ''
  function draggable_onMouseDown(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    moveToStackingTop(stackingOrder, get(positionable)[POSITIONABLE_KEY])

    positionable.update((p) => {
      dragState.init.x = absX
      dragState.init.y = absY
      dragState.curr.x = absX
      dragState.curr.y = absY
      dragState.relativeOffset.x = absX - p.x
      dragState.relativeOffset.y = absY - p.y
      dragState.positionableInit.x = p.x
      dragState.positionableInit.y = p.y

      p.x = absX - dragState.relativeOffset.x
      p.y = absY - dragState.relativeOffset.y
      return p
    })
    dragState.draggingPositionable = positionable
  }
  let quickPreviewBackup = {
    id: '',
    x: -1,
    y: 0,
    w: 0,
    h: 0
  }
  function draggable_onMouseMove(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
      draggable: HTMLElement
    }>
  ) {
    if (hasClassOrParentWithClass(e.detail.draggable, 'tela-ignore')) {
      return
    }
    const { positionable, clientX, clientY } = e.detail
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    let startedDragging = false
    if ($mode !== 'dragging') {
      startedDragging = true
      mode.dragging()
    }

    const DRAG_AUTO_SCROLL_THRESHOLD = 40 // px
    const INCREASE_SCROLL_EVERY = 1000 // ms
    const AUTO_SCROLL_AMOUNTS = [30, 75, 100, 175] // px

    const cursorAtLeftEdge = clientX < DRAG_AUTO_SCROLL_THRESHOLD
    const cursorAtRightEdge = clientX > $viewPort.w - DRAG_AUTO_SCROLL_THRESHOLD

    function performAutoScroll(amount: number, toLeft: boolean) {
      const newOffsetX = $viewOffset.x + (toLeft ? -amount : amount)
      const boundOffset = applyBounds(newOffsetX, $viewOffset.y, $viewPort.w, $viewPort.h)

      if (boundOffset.x === $viewOffset.x) return

      viewOffset.update(
        (v) => {
          return { x: boundOffset.x, y: v.y }
        },
        { duration: 0 }
      )

      const { x: newAbsX } = posToAbsolute(
        clientX,
        clientY,
        boundOffset.x,
        $viewOffset.y,
        $viewPort,
        $zoom
      )

      dragState.offset.x = newAbsX - dragState.init.x
      dragState.curr.x = newAbsX

      positionable.update((p) => {
        const { x: boundX } = applyBounds(
          newAbsX - dragState.relativeOffset.x,
          absY - dragState.relativeOffset.y,
          p.width,
          p.height
        )

        p.x = boundX
        return p
      })
    }

    if (cursorAtLeftEdge || cursorAtRightEdge) {
      if (!dragState.autoScroll) {
        dragState.autoScroll = true

        let start: number, previousTimeStamp: number
        const stepFunc = (timeStamp: number) => {
          if (start === undefined) {
            start = timeStamp
          }
          const elapsed = timeStamp - start

          if (previousTimeStamp !== timeStamp) {
            previousTimeStamp = timeStamp

            const step = Math.min(
              Math.floor(elapsed / INCREASE_SCROLL_EVERY),
              AUTO_SCROLL_AMOUNTS.length - 1
            )
            const amount = AUTO_SCROLL_AMOUNTS[step]

            performAutoScroll(amount, cursorAtLeftEdge)
          }

          if (dragState.autoScroll) {
            window.requestAnimationFrame(stepFunc)
          }
        }

        window.requestAnimationFrame(stepFunc)
      }
    } else {
      dragState.autoScroll = false
      dragState.offset.x = absX - dragState.init.x
      dragState.curr.x = absX
    }

    dragState.offset.y = absY - dragState.init.y
    dragState.curr.y = absY

    // Handle classes
    if (clientY < $settings.QUICK_SNAP_THRESHOLD && $allowQuickSnap) {
      const domEl = document.querySelector(
        `[data-id="${get(e.detail.positionable).id}"]`
      ) as HTMLElement
      domEl.classList.remove('no-animation')
    } else {
      const domEl = document.querySelector(
        `[data-id="${get(e.detail.positionable).id}"]`
      ) as HTMLElement
      domEl.classList.add('no-animation')
    }

    positionable.update((p) => {
      // Quick Snap
      if (clientY <= $settings.QUICK_SNAP_THRESHOLD && $allowQuickSnap) {
        if (quickPreviewBackup.id !== p.id && quickPreviewBackup.x === -1) {
          quickPreviewBackup.x = p.x
          quickPreviewBackup.y = p.y
          quickPreviewBackup.w = p.width
          quickPreviewBackup.h = p.height
        }
        let snapMode: 'third-left' | 'half-left' | 'third-center' | 'half-right' | 'third-right' =
          'third-center'
        const PADD = $settings.GRID_SIZE
        if (clientX <= $viewPort.w / 9) {
          snapMode = 'third-left'
        } else if (clientX <= ($viewPort.w / 9) * 3) {
          snapMode = 'half-left'
        } else if (clientX <= ($viewPort.w / 9) * 6) {
          snapMode = 'third-center'
        } else if (clientX <= ($viewPort.w / 9) * 8) {
          snapMode = 'half-right'
        } else {
          snapMode = 'third-right'
        }

        if (snapMode === 'third-left') {
          p.x = $viewOffset.x
          p.width = $viewPort.w / 3 - PADD
        } else if (snapMode === 'half-left') {
          p.x = $viewOffset.x
          p.width = $viewPort.w / 2 - PADD
        } else if (snapMode === 'third-center') {
          p.x = $viewOffset.x + $viewPort.w / 3 + PADD
          p.width = $viewPort.w / 3 - PADD * 3 - PADD
        } else if (snapMode === 'half-right') {
          p.x = $viewOffset.x + $viewPort.w / 2 + PADD
          p.width = $viewPort.w / 2 - 25 - PADD
        } else if (snapMode === 'third-right') {
          p.x = $viewOffset.x + ($viewPort.w / 3) * 2 - PADD
          p.width = $viewPort.w / 3 - 25 + PADD
        }

        p.y = 0
        // TODO: Look into the padding again. Its off as the viewport calculations
        // dont include padding set on tela-container!
        p.height = $viewPort.h - 50 - ($viewPort.h % $settings.GRID_SIZE)
        return p
      } else {
        if (quickPreviewBackup.x !== -1) {
          p.width = quickPreviewBackup.w
          p.height = quickPreviewBackup.h
          quickPreviewBackup.x = -1
        }
      }

      const { x: boundX, y: boundY } = applyBounds(
        absX - dragState.relativeOffset.x,
        absY - dragState.relativeOffset.y,
        p.width,
        p.height
      )

      if (!cursorAtLeftEdge && !cursorAtRightEdge) {
        p.x = boundX
      }

      p.y = boundY

      snapToEdges(
        p,
        $onScreenPositionables,
        POSITIONABLE_KEY,
        $settings.GRID_SIZE,
        $settings.EDGE_SNAP_FACTOR
      )

      return p
    })

    if (startedDragging) {
      dispatch('draggableStart', { positionable })
    }
  }
  function draggable_onMouseUp(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
      draggable: HTMLElement
    }>
  ) {
    if (hasClassOrParentWithClass(e.detail.draggable, 'tela-ignore')) return
    const { positionable, clientX, clientY } = e.detail
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    const domEl = document.querySelector(
      `[data-id="${get(e.detail.positionable).id}"]`
    ) as HTMLElement
    domEl.classList.remove('no-animation')

    if (clientY > $settings.QUICK_SNAP_THRESHOLD) {
      dragState.autoScroll = false

      const initChunkX = Math.floor(dragState.positionableInit.x / CHUNK_WIDTH)
      const initChunkY = Math.floor(dragState.positionableInit.y / CHUNK_WIDTH)
      let targetChunkX: number
      let targetChunkY: number

      // TODO3: Issues cuz update positionable before chunks?
      positionable.update((p) => {
        const { x: boundX, y: boundY } = applyBounds(
          absX - dragState.relativeOffset.x,
          absY - dragState.relativeOffset.y,
          p.width,
          p.height
        )

        // p.x = boundX;
        // p.y = boundY;

        // let x = absX - dragState.relativeOffset.x;
        // let y = absY - dragState.relativeOffset.y;
        // Perform snapping
        if ($settings.SNAP_TO_GRID) {
          p.x = snapToGrid(boundX, $settings.GRID_SIZE)
          p.y = snapToGrid(boundY, $settings.GRID_SIZE)
        } else {
          p.x = boundX
          p.y = boundY
        }
        snapToEdges(
          p,
          $onScreenPositionables,
          POSITIONABLE_KEY,
          $settings.GRID_SIZE,
          $settings.EDGE_SNAP_FACTOR
        )

        targetChunkX = Math.floor(p.x / CHUNK_WIDTH)
        targetChunkY = Math.floor(p.y / CHUNK_HEIGHT)

        // Remove from old chunk (It will automatically get added to the new one by the reactive logic at the beginning).
        if (!p.hoisted) {
          chunks.update((_chunks) => {
            const initChunkId = `${initChunkX}:${initChunkY}`
            const targetChunkId = `${targetChunkX}:${targetChunkY}`
            if (initChunkId === targetChunkId) return _chunks
            const initChunk = _chunks.get(initChunkId)

            if (initChunk === undefined) {
              console.error(
                initChunk !== undefined,
                `[draggable_onMouseUp] Chunk ${initChunkId} not found!`
              )
            } else {
              let empty = false
              initChunk.update((_positionables) => {
                const i = _positionables.indexOf(positionable)
                _positionables.splice(i, 1)
                empty = _positionables.length === 0
                // TODO: What if indexOf returns -1?
                return _positionables
              })
              if (empty) {
                _chunks.delete(initChunkId)
              }
            }

            return _chunks
          })
        }

        return p
      })

      positionables.update((v) => v)
    }

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

    dragState.draggingPositionable = null
    // PERF: This is bit hacky, but works for now (Without it, the grid snapping is not as smooth).
    setTimeout(() => domEl.classList.add('no-animation'), 300)

    mode.idle()
    dispatch('draggableEnd', positionable)
  }

  function resizable_onMouseDown(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    mode.resizing()
    moveToStackingTop(stackingOrder, get(positionable)[POSITIONABLE_KEY])

    dragState.init.x = absX
    dragState.init.y = absY
    dragState.curr.x = absX
    dragState.curr.y = absY
    dragState.relativeOffset.x = absX - clientX
    dragState.relativeOffset.y = absY - clientY
    dragState.positionableInit.x = get(positionable).x
    dragState.positionableInit.y = get(positionable).y
    dragState.draggingPositionable = positionable
  }
  function resizable_onMouseMove(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
      direction: TResizeDirection
      minSize: Vec2<number>
      maxSize: Vec2<number>
    }>
  ) {
    const { positionable, clientX, clientY, direction, minSize, maxSize, event } = e.detail
    let { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY + 18,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )

    const domEl = document.querySelector(
      `[data-id="${get(e.detail.positionable).id}"]`
    ) as HTMLElement
    domEl.classList.add('no-animation')

    const preserveAspectRatio = event.shiftKey

    // prevent negative values when cursor is outside of the viewport
    absY = Math.max(absY, 0)
    absX = Math.max(absX, 0)

    dragState.offset.x = absX - dragState.init.x
    dragState.offset.y = absY - dragState.init.y
    dragState.curr.x = absX
    dragState.curr.y = absY

    positionable.update((p) => {
      let x = p.x
      let y = p.y
      let width = p.width
      let height = p.height

      const aspectRatio = p.width / p.height

      if (direction === 'right') {
        width = clamp(absX - p.x, minSize.x, maxSize.x)
        if (preserveAspectRatio) {
          height = width / aspectRatio
          y = p.y + (p.height - height) / 2
        }
      } else if (direction === 'bottom') {
        height = absY - p.y
        if (preserveAspectRatio) {
          width = height * aspectRatio
          x = p.x + (p.width - width) / 2
        }
      } else if (direction === 'top') {
        y = absY
        height = p.y + p.height - absY
        if (preserveAspectRatio) {
          width = height * aspectRatio
          x = p.x + (p.width - width) / 2
        }
      } else if (direction === 'left') {
        x = absX
        width = p.x + p.width - absX
        if (preserveAspectRatio) {
          height = width / aspectRatio
          y = p.y + (p.height - height) / 2
        }
      } else if (direction === 'top-left') {
        x = absX
        width = p.x + p.width - absX
        height = preserveAspectRatio ? width / aspectRatio : p.y + p.height - absY
        const yOffset = p.height - clamp(height, minSize.y, maxSize.y)
        y = preserveAspectRatio ? p.y + yOffset : absY
      } else if (direction === 'top-right') {
        width = absX - p.x
        height = preserveAspectRatio ? width / aspectRatio : p.y + p.height - absY
        const yOffset = p.height - clamp(height, minSize.y, maxSize.y)
        y = preserveAspectRatio ? p.y + yOffset : absY
      } else if (direction === 'bottom-left') {
        x = absX
        width = p.x + p.width - absX
        height = preserveAspectRatio ? width / aspectRatio : absY - p.y
      } else if (direction === 'bottom-right') {
        width = absX - p.x
        height = preserveAspectRatio ? width / aspectRatio : absY - p.y
      }

      let boundWidth = clamp(width, minSize.x, maxSize.x)
      let boundHeight = clamp(height, minSize.y, maxSize.y)
      let { x: boundX, y: boundY } = applyBounds(x, y, p.width, p.height)

      if (direction === 'top' || direction === 'top-left' || direction === 'top-right') {
        const snapTargets = $onScreenPositionables.filter((c) => {
          const _c = get(c)
          return (
            _c[POSITIONABLE_KEY] !== p[POSITIONABLE_KEY] &&
            Math.abs(_c.y - boundY) < $settings.GRID_SIZE / 2
          )
        })
        if (snapTargets.length > 0) {
          boundY = get(snapTargets[0]).y // - (boundY - get(snapTargets[0]).y)
          boundHeight = p.height + (p.y - get(snapTargets[0]).y)
        }
      }
      if (direction === 'bottom' || direction === 'bottom-left' || direction === 'bottom-right') {
        const snapTargets = $onScreenPositionables.filter((c) => {
          const _c = get(c)
          return (
            _c[POSITIONABLE_KEY] !== p[POSITIONABLE_KEY] &&
            Math.abs(_c.y + _c.height - (boundY + boundHeight)) < $settings.GRID_SIZE / 2
          )
        })
        if (snapTargets.length > 0) {
          boundHeight = get(snapTargets[0]).height - (boundY - get(snapTargets[0]).y)
        }
      }
      if (direction === 'left' || direction === 'top-left' || 'bottom-left') {
        const snapTargets = $onScreenPositionables.filter((c) => {
          const _c = get(c)
          return (
            _c[POSITIONABLE_KEY] !== p[POSITIONABLE_KEY] &&
            Math.abs(_c.x - boundX) < $settings.GRID_SIZE / 2
          )
        })
        if (snapTargets.length > 0) {
          boundX = get(snapTargets[0]).x
          boundWidth = p.width + (p.x - get(snapTargets[0]).x)
        }
      }
      if (direction === 'right' || direction === 'top-right' || direction === 'bottom-right') {
        const snapTargets = $onScreenPositionables.filter((c) => {
          const _c = get(c)
          return (
            _c[POSITIONABLE_KEY] !== p[POSITIONABLE_KEY] &&
            Math.abs(_c.x + _c.width - (boundX + boundWidth)) < $settings.GRID_SIZE / 2
          )
        })
        if (snapTargets.length > 0) {
          boundWidth = get(snapTargets[0]).width - (boundX - get(snapTargets[0]).x)
        }
      }

      const reachedMinHeight = height < minSize.y
      const reachedMinWidth = width < minSize.x

      // edge case: if we are preserving the aspect ratio and have reached the min sizes,
      // we should stop further adjustments of the opoosite side as well
      if (preserveAspectRatio && (reachedMinHeight || reachedMinWidth)) {
        return p
      }

      // edge case: prevent moving the positionable when min height is reached
      if (!reachedMinHeight) {
        p.y = boundY
        p.height = boundHeight
      }

      // edge case: prevent moving the positionable when min width is reached
      if (!reachedMinWidth) {
        p.x = boundX
        p.width = boundWidth
      }

      return p
    })

    dispatch('resizableStart', { positionable })
  }
  function resizable_onMouseUp(
    e: CustomEvent<{
      event: MouseEvent | TouchEvent
      positionable: Writable<IPositionable<any>>
      clientX: number
      clientY: number
      direction: TResizeDirection
      minSize: number
      maxSize: number
    }>
  ) {
    const { positionable, clientX, clientY } = e.detail
    const { x: absX, y: absY } = posToAbsolute(
      clientX,
      clientY,
      $viewOffset.x,
      $viewOffset.y,
      $viewPort,
      $zoom
    )
    // TODO: BOUNDS CHECKING& APPLY final pos

    const domEl = document.querySelector(
      `[data-id="${get(e.detail.positionable).id}"]`
    ) as HTMLElement
    domEl.classList.remove('no-animation')

    const initChunkX = Math.floor(dragState.positionableInit.x / CHUNK_WIDTH)
    const initChunkY = Math.floor(dragState.positionableInit.y / CHUNK_WIDTH)
    let targetChunkX: number
    let targetChunkY: number

    positionable.update((p) => {
      let x = p.x
      let y = p.y
      let width = p.width
      let height = p.height

      if ($settings.SNAP_TO_GRID) {
        x = snapToGrid(x, $settings.GRID_SIZE)
        y = snapToGrid(y, $settings.GRID_SIZE)
        width = snapToGrid(width, $settings.GRID_SIZE)
        height = snapToGrid(height, $settings.GRID_SIZE)
      }

      const { x: boundX, y: boundY } = applyBounds(x, y, width, height)

      p.x = boundX
      p.y = boundY
      p.width = width
      p.height = height

      targetChunkX = Math.floor(p.x / CHUNK_WIDTH)
      targetChunkY = Math.floor(p.y / CHUNK_HEIGHT)
      return p
    })

    // TODO: Move into singel functoon
    // Update chunk
    if (!get(positionable).hoisted) {
      chunks.update((_chunks) => {
        const initChunkId = `${initChunkX}:${initChunkY}`
        const targetChunkId = `${targetChunkX}:${targetChunkY}`

        if (initChunkId === targetChunkId) return _chunks

        const initChunk = _chunks.get(initChunkId)
        const targetChunk = _chunks.get(targetChunkId)

        // TODO: THis is broken again!!
        if (initChunk === undefined) {
          console.error(
            initChunk === undefined,
            `[draggable_onMouseUp] Chunk ${initChunkId} not found!`
          )
        } else {
          let empty = false
          initChunk.update((_positionables) => {
            _positionables.splice(_positionables.indexOf(positionable), 1)
            empty = _positionables.length === 0
            // TODO: What if indexOf returns -1?
            return _positionables
          })
          if (empty) {
            _chunks.delete(initChunkId)
          }
        }
        if (targetChunk === undefined) {
          _chunks.set(targetChunkId, writable([positionable]))
        } else {
          targetChunk.update((_positionables) => {
            _positionables.push(positionable)
            return _positionables
          })
        }

        return _chunks
      })
    }

    dragState.draggingPositionable = null
    // PERF: This is bit hacky, but works for now (Without it, the grid snapping is not as smooth).
    setTimeout(() => domEl.classList.add('no-animation'), 300)

    mode.idle()
    dispatch('resizableEnd', positionable)
  }

  function positionable_hoist(e: CustomEvent<string>) {
    const key = e.detail
    const positionable = $positionables.find((p) => get(p)[POSITIONABLE_KEY] === key)
    if (!positionable) {
      console.error(`[TELA] Tried to hoist non-existing positionable: ${key}`)
      return
    }
    if (get(positionable).hoisted) return

    positionable.update((p) => {
      // Remove from chunk
      const cI = `${Math.floor(p.x / CHUNK_WIDTH)}:${Math.floor(p.y / CHUNK_HEIGHT)}`
      const chunk = $chunks.get(cI)
      if (chunk !== undefined) {
        chunks.update((_chunks) => {
          let empty = false
          chunk.update((_chunk) => {
            // TODO: Perf: Compare perf of findIndex vs indexOf
            // const i = _chunk.findIndex(e => get(e)[POSITIONABLE_KEY] === key);
            const i = _chunk.indexOf(positionable)
            if (i !== -1) _chunk.splice(i, 1)
            if (_chunk.length <= 0) empty = true
            return _chunk
          })
          if (empty) {
            _chunks.delete(cI)
          }
          return _chunks
        })
      }

      // @ts-ignore we want this!
      p.hoisted = true
      return p
    })

    positionables.update((v) => v)
  }
  function positionable_unHoist(e: CustomEvent<string>) {
    const key = e.detail
    const positionable = $positionables.find((p) => get(p)[POSITIONABLE_KEY] === key)
    if (!positionable) {
      console.error(`[TELA] Tried to un-hoist non-existing positionable: ${key}`)
      return
    }
    if (!get(positionable).hoisted) return
    hoistedPositionables.update((_hoisted) => {
      return _hoisted
    })
    positionable.update((p) => {
      // @ts-ignore we want this!
      p.hoisted = false
      return p
    })

    positionables.update((v) => v)
  }

  onMount(() => {
    containerEl.addEventListener('draggable_onMouseDown', draggable_onMouseDown)
    containerEl.addEventListener('draggable_onMouseMove', draggable_onMouseMove)
    containerEl.addEventListener('draggable_onMouseUp', draggable_onMouseUp)
    containerEl.addEventListener('resizable_onMouseDown', resizable_onMouseDown)
    containerEl.addEventListener('resizable_onMouseMove', resizable_onMouseMove)
    containerEl.addEventListener('resizable_onMouseUp', resizable_onMouseUp)
    containerEl.addEventListener('tela_hoist', positionable_hoist)
    containerEl.addEventListener('tela_unhoist', positionable_unHoist)
  })
  onDestroy(() => {
    containerEl && containerEl.removeEventListener('draggable_onMouseDown', draggable_onMouseDown)
    containerEl && containerEl.removeEventListener('draggable_onMouseMove', draggable_onMouseMove)
    containerEl && containerEl.removeEventListener('draggable_onMouseUp', draggable_onMouseUp)
    containerEl && containerEl.removeEventListener('resizable_onMouseDown', resizable_onMouseDown)
    containerEl && containerEl.removeEventListener('resizable_onMouseMove', resizable_onMouseMove)
    containerEl && containerEl.removeEventListener('resizable_onMouseUp', resizable_onMouseUp)
    containerEl && containerEl.removeEventListener('tela_hoist', positionable_hoist)
    containerEl && containerEl.removeEventListener('tela_unhoist', positionable_unHoist)
  })
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<div
  class="tela-container {$$restProps.class || ''}"
  bind:this={containerEl}
  on:wheel={onWheel}
  on:wheel
  on:mousedown={(e) => {
    if (!hasClassOrParentWithClass(e.target, 'draggable')) clearSelection()
  }}
  on:mousedown
  on:keydown
>
  {#if $settings.DEV}
    <ul class="dev" style="list-style: none;">
      <li>
        <ul class="dev-txt" style="list-style: none;">
          <!-- TODO: Dynamic version inject -->
          <span style="margin-bottom: 8px;"
            ><i
              >Horizon <small style="color: #b7b7c4;"
                >{import.meta.env.R_VITE_APP_VERSION ?? 'unknown release'}
              </small></i
            ></span
          >
          <li><span>Mode:</span><span>{$mode}</span></li>
          <li>
            <span>Viewport:</span><span
              >{$viewPort.x}, {$viewPort.y}, {$viewPort.w}, {$viewPort.h}</span
            >
          </li>
          <li><span>Current Stretch:</span><span>{Math.floor($viewOffset.x / 1920) + 1}</span></li>
          <!-- NOTE: Major perf hit due to conditional slot. -->
          <!-- TODO: Look into optimizing dev overlay perf -->
          <!-- <slot name="dev" /> -->
        </ul>
      </li>
      <br />
      <DebugPanels />
    </ul>
  {/if}

  <div class="quickSnapHints" class:visible={showQuickSnapGuides}>
    <span style="flex: 1;"></span>
    <!-- <span>|</span> -->
    <span style="flex: 2;"></span>
    <!-- <span>|</span> -->
    <span style="flex: 3;"></span>
    <!-- <span>|</span> -->
    <span style="flex: 2;"></span>
    <!-- <span>|</span> -->
    <span style="flex: 1;"></span>
  </div>

  <div class="tela-board mode-{$mode}" style={transformCss}>
    {#if $mode === 'select' || $mode === 'modSelect'}
      <slot name="selectRect" />
    {/if}

    <!-- TODO (@maxu): Make this only appear when speed is low -> No big flings -->
    <!-- <div
      class="card-snap-guide"
      class:visible={dragState.draggingPositionable !== null}
      style={cardSnapGuideCss}
    ></div> -->

    {#if $settings.DEV}
      <!-- TODO: This requires updating lib users to Svelte4 -->
      <!-- TODO: Perf use iterator is much faster: https://github.com/sveltejs/svelte/issues/7425#issuecomment-1461021936 -->
      <!-- Depends on implementation using map -->
      <!-- {#each $visibleChunks as [chunkId, _] (chunkId)} -->
      {#each $visibleChunks as [chunkId, _] (chunkId)}
        {@const index = chunkId.split(':')}
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

  .card-snap-guide {
    opacity: 0%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    /* border: 2px dashed #ff0000; */
    background: rgba(191, 191, 191, 0.322);
    border-radius: var(--theme-border-radius);
    --transition-duration: 210ms;
    --transition-ease: cubic-bezier(0.34, 1.56, 0.64, 1);
    transition:
      width var(--transition-duration) var(--transition-ease),
      height var(--transition-duration) var(--transition-ease),
      top var(--transition-duration) var(--transition-ease),
      left var(--transition-duration) var(--transition-ease),
      opacity 600ms ease-in-out;
  }
  .card-snap-guide.visible {
    opacity: 100%;
  }

  .quickSnapHints {
    display: flex;
    position: fixed;
    justify-content: space-evenly;
    padding: 5px;
    top: 0;
    left: 0;
    right: 0;
    gap: 0.5rem;
    opacity: 0%;
    pointer-events: none;
    user-select: none;
    transition: opacity 70ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  .quickSnapHints.visible {
    opacity: 100%;
  }
  .quickSnapHints > span {
    width: 100%;
    height: 18px;
    text-align: center;
    user-select: none;
    color: rgba(0, 0, 0, 0.286);
    background: rgba(131, 131, 131, 0.245);
    border-radius: 8px;
  }
</style>
