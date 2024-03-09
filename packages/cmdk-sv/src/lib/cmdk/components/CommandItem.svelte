<script lang="ts">
	import {
		addEventListener,
		executeCallbacks,
		generateId,
		isUndefined
	} from '$lib/internal/index.js';
	import { onMount } from 'svelte';
	import { VALUE_ATTR, getCtx, getGroup, getState } from '../command.js';
	import type { ItemProps } from '../types.js';
	import { derived } from 'svelte/store';

	type $$Props = ItemProps;

	export let disabled: $$Props['disabled'] = false;
	export let value: string = '';
	export let onSelect: $$Props['onSelect'] = undefined;
	export let alwaysRender: $$Props['alwaysRender'] = false;
	export let asChild: $$Props['asChild'] = false;
	export let id: string = generateId();

	const groupContext = getGroup();
	const context = getCtx();
	const state = getState();

	const trueAlwaysRender = alwaysRender ?? groupContext?.alwaysRender;

	const render = derived(state, ($state) => {
		if (trueAlwaysRender || context.filter() === false || !$state.search) return true;
		const currentScore = $state.filtered.items.get(id);
		if (isUndefined(currentScore)) return false;
		return currentScore > 0;
	});

	let isFirstRender = true;

	onMount(() => {
		isFirstRender = false;
		const unsub = context.item(id, groupContext?.id);
		return unsub;
	});

	const selected = derived(state, ($state) => $state.value === value);

	function action(node: HTMLElement) {
		if (!value && node.textContent) {
			value = node.textContent.trim().toLowerCase();
		}
		context.value(id, value);
		node.setAttribute(VALUE_ATTR, value);

		const unsubEvents = executeCallbacks(
			addEventListener(node, 'pointermove', () => {
				if (disabled) return;
				select();
			}),
			addEventListener(node, 'click', () => {
				if (disabled) return;
				handleItemClick();
			})
		);

		return {
			destroy() {
				unsubEvents();
			}
		};
	}

	function handleItemClick() {
		select();
		onSelect?.(value);
	}

	function select() {
		state.updateState('value', value, true);
	}

	$: attrs = {
		'aria-disabled': disabled ? true : undefined,
		'aria-selected': $selected ? true : undefined,
		'data-disabled': disabled ? true : undefined,
		'data-selected': $selected ? true : undefined,
		'data-cmdk-item': '',
		'data-value': value,
		role: 'option',
		id
	};
</script>

{#if $render || isFirstRender}
	{#if asChild}
		<slot {action} {attrs} />
	{:else}
		<div {...attrs} use:action {...$$restProps}>
			<slot {action} {attrs} />
		</div>
	{/if}
{/if}
