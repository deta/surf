<script context="module" lang="ts">
	export function calcViewBounds(viewOffset: Vec2, zoom: number, viewportSize: Vec2): Vec4 {
		const viewSize = {
			x: viewportSize.x / zoom,
			y: viewportSize.y / zoom
		};

		const viewBounds = {
			x: viewOffset.x - viewSize.x / 2,
			y: viewOffset.y - viewSize.y / 2,
			w: viewSize.x,
			h: viewSize.y
		};

		return viewBounds;
	}

  export function isInsideViewBounds(rec: Vec4, view: Vec4, zoom: number): boolean {
    return (
      rec.x >= view.x &&
      rec.y >= view.y &&
      rec.x + rec.w <= view.x + view.w &&
      rec.y + rec.h <= view.y + view.h
    );
  }

</script>

<script lang="ts">
	import type { TBoard } from '$lib/types/Board.type.js';
	import type { Vec2, Vec4 } from '$lib/types/Utils.type.js';
	import { clamp, hasClassOrParentWithClass, twoDecimalTrunc } from '$lib/utils.js';
  import { createEventDispatcher } from 'svelte';
	  import type { writable, Writable } from 'svelte/store';

	export let activeBoard: Writable<TBoard>;

    const dispatch = createEventDispatcher();

	// activeBoard.set({
	// 	key: '234',
	// 	zoom: 1,
	// 	viewOffset: { x: 0, y: 0 },
  //   positionables: writable([]),
  //   inView: writable([])
	// });

  let dragState = {
    init: { x: 0, y: 0 },
    curr: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  }

  $: fooX = 20 + $activeBoard.viewOffset.x;
  $: fooY = 20 + $activeBoard.viewOffset.y;

  $: checkerX = (x: number) => (x * 200) + $activeBoard.viewOffset.x;
  $: checkerY= (y: number) => (y * 200) + $activeBoard.viewOffset.y;

  let checkers = [];
  const num = 20;
  // for (let x = -num; x < num; x++) {
  //   for (let y = -num; y < num; y++) {
  //     checkers.push({ x, y });
  //   }
  // }

  // UI Handlers
  function onMouseWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      //const zoom = clamp(twoDecimalTrunc(($activeBoard.zoom + delta / 500)), 0.1, 1.9);
      const zoom = clamp($activeBoard.zoom + delta / 500, 0.1, 1.9);
      console.log("zoom", zoom, 2- zoom)
      $activeBoard.zoom = zoom;
    }
    else {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = e.deltaX;
      const deltaY = e.deltaY;
      $activeBoard.viewOffset = {
        x: $activeBoard.viewOffset.x + deltaX / $activeBoard.zoom,
        y: $activeBoard.viewOffset.y + deltaY / $activeBoard.zoom
      };
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (hasClassOrParentWithClass(e.target as HTMLElement, 'no-pan')) return;
    dragState.init = { x: e.clientX, y: e.clientY };
    dragState.curr = { x: e.clientX, y: e.clientY };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    dragState.offset = {
      x: Math.floor((e.clientX - dragState.curr.x) / $activeBoard.zoom),
      y: Math.floor((e.clientY - dragState.curr.y) / $activeBoard.zoom)
    };

    dragState.curr = { x: e.clientX, y: e.clientY };

    $activeBoard.viewOffset = {
      x: $activeBoard.viewOffset.x - dragState.offset.x,
      y: $activeBoard.viewOffset.y - dragState.offset.y
    };
  }

  function onMouseUp(e: MouseEvent) {
    window.removeEventListener('mousemove', onMouseMove);
    dispatch('dragEnd', { pos: $activeBoard.viewOffset })
  }

</script>

<svelte:body
  on:mousedown={onMouseDown}
  on:wheel|nonpassive={onMouseWheel}/>

<section id="board"
  style="transform-origin: top left; transform: scale({2- $activeBoard.zoom});"
  > <!-- trunc -->
  <slot/>
</section>

<style>
  #board {
    position: relative;
    cursor: grab;
    overscroll-behavior-x: contain;
  }
</style>
