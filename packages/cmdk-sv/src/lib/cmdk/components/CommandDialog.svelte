<script lang="ts">
	import type { DialogProps } from '../types.js';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Transition } from '$lib/internal/types.js';
	import { Command } from '$lib/index.js';

	type ContentT = $$Generic<Transition>;
	type ContentIn = $$Generic<Transition>;
	type ContentOut = $$Generic<Transition>;
	type OverlayT = $$Generic<Transition>;
	type OverlayIn = $$Generic<Transition>;
	type OverlayOut = $$Generic<Transition>;

	type $$Props = DialogProps<ContentT, ContentIn, ContentOut, OverlayT, OverlayIn, OverlayOut>;

	export let open: $$Props['open'] = false;
	export let value: $$Props['value'] = undefined;
	export let portal: $$Props['portal'] = undefined;
	export let overlayClasses: $$Props['overlayClasses'] = undefined;
	export let contentClasses: $$Props['contentClasses'] = undefined;

	export let contentTransition: $$Props['contentTransition'] = undefined;
	export let contentTransitionConfig: $$Props['contentTransitionConfig'] = undefined;
	export let contentInTransition: $$Props['contentInTransition'] = undefined;
	export let contentInTransitionConfig: $$Props['contentInTransitionConfig'] = undefined;
	export let contentOutTransition: $$Props['contentOutTransition'] = undefined;
	export let contentOutTransitionConfig: $$Props['contentOutTransitionConfig'] = undefined;

	export let overlayTransition: $$Props['overlayTransition'] = undefined;
	export let overlayTransitionConfig: $$Props['overlayTransitionConfig'] = undefined;
	export let overlayInTransition: $$Props['overlayInTransition'] = undefined;
	export let overlayInTransitionConfig: $$Props['overlayInTransitionConfig'] = undefined;
	export let overlayOutTransition: $$Props['overlayOutTransition'] = undefined;
	export let overlayOutTransitionConfig: $$Props['overlayOutTransitionConfig'] = undefined;

	$: overlayProps = {
		class: overlayClasses,
		transition: overlayTransition,
		transitionConfig: overlayTransitionConfig,
		inTransition: overlayInTransition,
		inTransitionConfig: overlayInTransitionConfig,
		outTransition: overlayOutTransition,
		outTransitionConfig: overlayOutTransitionConfig,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		'data-cmdk-overlay': '' as any
	};

	$: contentProps = {
		class: contentClasses,
		transition: contentTransition,
		transitionConfig: contentTransitionConfig,
		inTransition: contentInTransition,
		inTransitionConfig: contentInTransitionConfig,
		outTransition: contentOutTransition,
		outTransitionConfig: contentOutTransitionConfig,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		'data-cmdk-dialog': '' as any
	};

	export let label: $$Props['label'] = undefined;
</script>

<DialogPrimitive.Root bind:open {...$$restProps}>
	{#if portal === null}
		<DialogPrimitive.Overlay {...overlayProps} />
		<DialogPrimitive.Content aria-label={label} {...contentProps}>
			<Command.Root {...$$restProps} bind:value>
				<slot />
			</Command.Root>
		</DialogPrimitive.Content>
	{:else}
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay {...overlayProps} />
			<DialogPrimitive.Content aria-label={label} {...contentProps}>
				<Command.Root {...$$restProps} bind:value>
					<slot />
				</Command.Root>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	{/if}
</DialogPrimitive.Root>
