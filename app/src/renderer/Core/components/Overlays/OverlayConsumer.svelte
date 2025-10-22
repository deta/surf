<script lang="ts">
	import type { Snippet } from "svelte";

	const { children }: { children?: Snippet } = $props();
</script>

{#key children}
	{@render children?.()}
{/key}