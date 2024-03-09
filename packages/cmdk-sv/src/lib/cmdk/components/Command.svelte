<script lang="ts">
	import {
		addEventListener,
		executeCallbacks,
		srOnlyStyles,
		styleToString
	} from '$lib/internal/index.js';
	import { createCommand } from '../command.js';
	import type { CommandProps } from '../types.js';

	type $$Props = CommandProps;

	export let label: $$Props['label'] = undefined;
	export let shouldFilter: $$Props['shouldFilter'] = true;
	export let filter: $$Props['filter'] = undefined;
	export let value: $$Props['value'] = undefined;
	export let onValueChange: $$Props['onValueChange'] = undefined;
	export let loop: $$Props['loop'] = undefined;
	export let onKeydown: $$Props['onKeydown'] = undefined;
	export let state: $$Props['state'] = undefined;
	export let ids: $$Props['ids'] = undefined;
	export let asChild: $$Props['asChild'] = false;

	const {
		commandEl,
		handleRootKeydown,
		ids: commandIds,
		state: stateStore
	} = createCommand({
		label,
		shouldFilter,
		filter,
		value,
		onValueChange: (next) => {
			if (next !== value) {
				value = next;
				onValueChange?.(next);
			}
		},
		loop,
		state,
		ids
	});

	function syncValueAndState(value: string | undefined) {
		if (value && value !== $stateStore.value) {
			$stateStore.value = value;
		}
	}

	$: syncValueAndState(value);

	function rootAction(node: HTMLDivElement) {
		commandEl.set(node);

		const unsubEvents = executeCallbacks(addEventListener(node, 'keydown', handleKeydown));

		return {
			destroy: unsubEvents
		};
	}

	const rootAttrs = {
		role: 'application',
		id: commandIds.root,
		'data-cmdk-root': ''
	};

	const labelAttrs = {
		'data-cmdk-label': '',
		for: commandIds.input,
		id: commandIds.label,
		style: styleToString(srOnlyStyles)
	};

	function handleKeydown(e: KeyboardEvent) {
		onKeydown?.(e);
		if (e.defaultPrevented) return;
		handleRootKeydown(e);
	}

	const root = {
		action: rootAction,
		attrs: rootAttrs
	};

	$: slotProps = {
		root,
		label: { attrs: labelAttrs },
		stateStore,
		state: $stateStore
	};
</script>

{#if asChild}
	<slot {...slotProps} />
{:else}
	<div use:rootAction {...rootAttrs} {...$$restProps}>
		<!-- svelte-ignore a11y-label-has-associated-control applied in attrs -->
		<label {...labelAttrs}>
			{label ?? ''}
		</label>
		<slot {...slotProps} />
	</div>
{/if}
