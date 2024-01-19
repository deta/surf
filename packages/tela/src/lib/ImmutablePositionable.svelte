<script lang="ts">
  import Positionable from "./Positionable.svelte";
</script>

<svelte:options immutable={true} />

<Positionable {...$$restProps} />