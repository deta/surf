<svelte:options immutable={true} />

<script lang="ts">
  import Positionable from "./Positionable.svelte";
</script>

<Positionable {...$$restProps} />
