<script lang="ts">
	import { derived } from 'svelte/store';
	import { getState } from '../command.js';
	import type { SeparatorProps } from '../types.js';

	type $$Props = SeparatorProps;

	export let alwaysRender: $$Props['alwaysRender'] = false;
	export let asChild: $$Props['asChild'] = false;

	const state = getState();
	const render = derived(state, ($state) => !$state.search);

	const attrs = {
		'data-cmdk-separator': '',
		role: 'separator'
	};
</script>

{#if $render || alwaysRender}
	{#if asChild}
		<slot {attrs} />
	{:else}
		<div {...attrs} {...$$restProps} />
	{/if}
{/if}
