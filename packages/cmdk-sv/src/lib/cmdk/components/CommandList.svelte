<script lang="ts">
	import { isHTMLElement } from '$lib/internal/index.js';
	import { getCtx, getState } from '../command.js';
	import type { ListProps } from '../types.js';

	const { ids } = getCtx();
	const state = getState();

	type $$Props = ListProps;

	export let el: $$Props['el'] = undefined;
	export let asChild: $$Props['asChild'] = false;

	function sizerAction(node: HTMLElement) {
		let animationFrame: number;
		const listEl = node.closest('[data-cmdk-list]');
		if (!isHTMLElement(listEl)) {
			return;
		}

		const observer = new ResizeObserver(() => {
			animationFrame = requestAnimationFrame(() => {
				const height = node.offsetHeight;
				listEl.style.setProperty('--cmdk-list-height', height.toFixed(1) + 'px');
			});
		});

		observer.observe(node);
		return {
			destroy() {
				cancelAnimationFrame(animationFrame);
				observer.unobserve(node);
			}
		};
	}

	const listAttrs = {
		'data-cmdk-list': '',
		role: 'listbox',
		'aria-label': 'Suggestions',
		id: ids.list,
		'aria-labelledby': ids.input
	};

	const sizerAttrs = {
		'data-cmdk-list-sizer': ''
	};

	const list = {
		attrs: listAttrs
	};

	const sizer = {
		attrs: sizerAttrs,
		action: sizerAction
	};
</script>

{#if asChild}
	{#key $state.search === ''}
		<slot {list} {sizer} />
	{/key}
{:else}
	<div {...listAttrs} bind:this={el} {...$$restProps}>
		<div {...sizerAttrs} use:sizerAction>
			{#key $state.search === ''}
				<slot />
			{/key}
		</div>
	</div>
{/if}
