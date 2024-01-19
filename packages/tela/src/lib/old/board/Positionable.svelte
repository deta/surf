<script lang="ts">
	import type { TBoard } from '$lib/types/Board.type.js';
	import type { TPositionable } from '$lib/types/Positionable.type.js';
	import { onMount } from 'svelte';
	import type { Writable } from 'svelte/store';

	export let board: Writable<TBoard>,
    bounds: TPositionable,
    stackingOrder: string[],
    wc: boolean;

    let el: HTMLElement;

    $: transformCss = `transfrom: translate3d(${$board.viewOffset.x + bounds.pos.x}px, ${$board.viewOffset.y + bounds.pos.y}px, 0); width: ${bounds.size.x}px; height: ${bounds.size.y}px;`;

	/*$: positionCss = `left: ${$board.viewOffset.x + bounds.pos.x}px; top: ${
		$board.viewOffset.y + bounds.pos.y
	}px; width: ${bounds.size.x}px; height: ${bounds.size.y}px; z-index: ${stackingOrder.indexOf(bounds.key) >= 0 ? stackingOrder.indexOf(bounds.key) : 0}`;
*/
  // TODO: render / update only when within bounds
	/*$: asf = isInsideViewBounds(
		{ x: draggable.pos.x, y: draggable.pos.y, w: draggable.size.x, h: draggable.size.y },
		{ x: $board.viewOffset.x, y: $board.viewOffset.y, w: window.innerWidth, h: window.innerHeight },
		$board.zoom
	);*/

	onMount(() => {
    //el.style.transform = `translate(${bounds.pos.x}px, ${bounds.pos.y}px)`;
	});
</script>

<!-- <div class="positionable" style="{positionCss}">
	{bounds.key}
</div> -->
<svelte:element this="div"
  {...$$restProps}
  class="positionable {$$restProps.class}"
  style="width: {bounds.size.x}px; height: {bounds.size.y}px; transform: translate3d({bounds.pos.x - $board.viewOffset.x}px, {bounds.pos.y - $board.viewOffset.y}px, 0); {wc ? 'background: lime !important;' : ''}">
  <slot/>
</svelte:element>

<style>
	div.positionable {
		position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
	}
</style>
