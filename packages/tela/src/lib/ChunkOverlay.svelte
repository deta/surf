<script lang="ts">
  import { randomCssColor } from "./utils.js";
  import type { IBoardSettings } from "./types/Board.type.js";
  import { getContext } from "svelte";
  import type { Writable } from "svelte/store";

  export let chunkX: number;
  export let chunkY: number;

  const settings = getContext<Writable<IBoardSettings>>("settings");
  const CHUNK_WIDTH = $settings.CHUNK_WIDTH;
  const CHUNK_HEIGHT = $settings.CHUNK_HEIGHT;

  const transformCss = `left: ${chunkX * CHUNK_WIDTH}px; top: ${
    chunkY * CHUNK_HEIGHT
  }px; width: ${CHUNK_WIDTH}px; height: ${CHUNK_HEIGHT}px; background: ${randomCssColor(0.5)}; pointer-events:none; z-index: -1;`;
</script>

<svelte:options immutable={true} />

<div class="chunk" style={transformCss}>
  <pre>{chunkX} : {chunkY}</pre>
</div>

<style>
  .chunk {
    position: absolute;
    pointer-events: none;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: strict;
  }
</style>
