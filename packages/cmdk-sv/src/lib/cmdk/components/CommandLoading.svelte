<script lang="ts">
	import type { LoadingProps } from '../types.js';

	type $$Props = LoadingProps;
	export let progress: $$Props['progress'] = 0;
	export let asChild: $$Props['asChild'] = false;

	$: attrs = {
		'data-cmdk-loading': '',
		role: 'progressbar',
		'aria-valuenow': progress,
		'aria-valuemin': 0,
		'aria-valuemax': 100,
		'aria-label': 'Loading...'
	};
</script>

{#if asChild}
	<slot {attrs} />
{:else}
	<div {...attrs} {...$$restProps}>
		<div aria-hidden>
			<slot {attrs} />
		</div>
	</div>
{/if}
