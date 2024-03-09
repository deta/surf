<script lang="ts">
	import { generateId } from '$lib/internal/index.js';
	import { derived } from 'svelte/store';
	import { VALUE_ATTR, getCtx, getState, createGroup } from '../command.js';
	import type { GroupProps } from '../types.js';
	import { onMount } from 'svelte';

	type $$Props = GroupProps;

	export let heading: $$Props['heading'] = undefined;
	export let value = '';
	export let alwaysRender: $$Props['alwaysRender'] = false;
	export let asChild: $$Props['asChild'] = false;

	const { id } = createGroup(alwaysRender);

	const context = getCtx();
	const state = getState();
	const headingId = generateId();

	const render = derived(state, ($state) => {
		if (alwaysRender) return true;
		if (context.filter() === false) return true;
		if (!$state.search) return true;
		return $state.filtered.groups.has(id);
	});

	onMount(() => {
		const unsubGroup = context.group(id);
		return unsubGroup;
	});

	function containerAction(node: HTMLElement) {
		if (value) {
			context.value(id, value);
			node.setAttribute(VALUE_ATTR, value);
			return;
		}

		if (heading) {
			value = heading.trim().toLowerCase();
		} else if (node.textContent) {
			value = node.textContent.trim().toLowerCase();
		}

		context.value(id, value);
		node.setAttribute(VALUE_ATTR, value);
	}

	$: containerAttrs = {
		'data-cmdk-group': '',
		role: 'presentation',
		hidden: $render ? undefined : true,
		'data-value': value
	};

	const headingAttrs = {
		'data-cmdk-group-heading': '',
		'aria-hidden': true,
		id: headingId
	};

	$: groupAttrs = {
		'data-cmdk-group-items': '',
		role: 'group',
		'aria-labelledby': heading ? headingId : undefined
	};

	$: container = {
		action: containerAction,
		attrs: containerAttrs
	};

	$: group = {
		attrs: groupAttrs
	};
</script>

{#if asChild}
	<slot {container} {group} heading={{ attrs: headingAttrs }} />
{:else}
	<div use:containerAction {...containerAttrs} {...$$restProps}>
		{#if heading}
			<div {...headingAttrs}>
				{heading}
			</div>
		{/if}
		<div {...groupAttrs}>
			<slot {container} {group} heading={{ attrs: headingAttrs }} />
		</div>
	</div>
{/if}
