<script context="module" lang="ts">
  export function posToChunkPos(posX: number, posY: number, settings: IBoardSettings) {
    return {
      chunkX: Math.floor(posX / settings.CHUNK_SIZE),
      chunkY: Math.floor(posY / settings.CHUNK_SIZE)
    };
  }
</script>
<script lang="ts">
  import { createEventDispatcher, getContext, onDestroy, onMount } from "svelte";
  import Chunk from "./Chunk.svelte";
  import { derived, get, writable, type Writable } from "svelte/store";
  import type { IPositionable } from "./Positionable.svelte";
  import type { IBoard, IBoardSettings, Vec2 } from "./index.ts";

  export let chunks: Writable<Map<string, Writable<IPositionable[]>>>;
  export let lazy = true;

  let htmlEl: HTMLDivElement;
  const dispatch = createEventDispatcher();

  const board = getContext<IBoard>("board");
  const settings = getContext<Writable<IBoardSettings>>("settings");

  const chunkComponent = import("./Chunk.svelte");

  let state = board.state;
  $: ({ viewPort } = $state);
  $: viewX = $state.viewOffset.x;
  $: viewY = $state.viewOffset.y;
  $: ({ zoom } = $state);

  let prevViewChunkX = 0;
  let prevViewChunkY = 0;
  let viewChunkX = writable(0);
  let viewChunkY = writable(0);

  // overcomplicated perf optimization -> todo: extract to custom "remembering" store
  let _viewChunkX = derived($state.viewOffset.x, (e) => Math.floor($viewX / $settings.CHUNK_SIZE));
  let _viewChunkY = derived($state.viewOffset.y, (e) => Math.floor($viewY / $settings.CHUNK_SIZE));
  _viewChunkX.subscribe((v) => {
    if (prevViewChunkX !== v) {
      prevViewChunkX = v;
      viewChunkX.set(v);
    }
  });
  _viewChunkY.subscribe((v) => {
    if (prevViewChunkY !== v) {
      prevViewChunkY = v;
      viewChunkY.set(v);
    }
  });

  $: {
    ($viewChunkX || $viewChunkY);
    dispatch("warmChunksChanged", { warmChunks: calcWarmChunks() });
  }

  // Utils
  /**
   * Calculated all chunks which are "warm" based on the loading settings.
   * Warm chunks should be loaded in the client app to be ready for display.
   */
  function calcWarmChunks() {
    const warmChunks = new Set<string>();
    const viewChunkW = Math.ceil(viewPort.w / $settings.CHUNK_SIZE / $zoom);
    const viewChunkH = Math.ceil(viewPort.h / $settings.CHUNK_SIZE / $zoom);

    for (let x = $viewChunkX - $settings.CHUNK_WARM_MARGIN; x < $viewChunkX + viewChunkW + $settings.CHUNK_WARM_MARGIN; x++) {
      for (let y = $viewChunkY - $settings.CHUNK_WARM_MARGIN; y < $viewChunkY + viewChunkH + $settings.CHUNK_WARM_MARGIN; y++) {
        warmChunks.add(`${x}:${y}`);
      }
    }

    return warmChunks;
  }

  function chunkInView(xChunk: number, yChunk: number, viewChunkX: number, viewChunkY: number) {
    return (
      xChunk + 1 + $settings.CHUNK_CULL_MARGIN / $settings.CHUNK_SIZE >= viewChunkX &&
      yChunk + 1 + $settings.CHUNK_CULL_MARGIN / $settings.CHUNK_SIZE >= viewChunkY &&
      xChunk * $settings.CHUNK_SIZE - $settings.CHUNK_SIZE - $settings.CHUNK_CULL_MARGIN <=
        $viewX + viewPort.w / $zoom &&
      yChunk * $settings.CHUNK_SIZE - $settings.CHUNK_SIZE - $settings.CHUNK_CULL_MARGIN <=
        $viewY + viewPort.h / $zoom
    );
  }

  // Handlers
  function onDraggableMoveEnd(e: CustomEvent<{ key: string, initChunk: Vec2<number>, newPos: Vec2<number> }>) {
    e.stopPropagation();
    const changed = new Set<string>();
    changed.add(`${e.detail.initChunk.x}:${e.detail.initChunk.y}`);

    // Handle chunk move
    const { chunkX: newChunkX, chunkY: newChunkY } = posToChunkPos(e.detail.newPos.x, e.detail.newPos.y, $settings);

    if (newChunkX !== e.detail.initChunk.x || newChunkY !== e.detail.initChunk.y) {
      changed.add(`${newChunkX}:${newChunkY}`);
      chunks.update(_chunks => {
        const initChunk = _chunks.get(`${e.detail.initChunk.x}:${e.detail.initChunk.y}`);
        let positionable: IPositionable | undefined;
        if (initChunk) {
          const _positionable = get(initChunk).find(p => p.key === e.detail.key);
          if (_positionable) {
            positionable = _positionable;
          }
          initChunk.update(ck => {
            ck = ck.filter(p => p.key !== e.detail.key);
            return ck;
          });
        }
        if (!positionable) {
          alert("Positionable not found in chunk");
          return _chunks; // todo: warn? dont rly need cuz if !chunked positionable should be fine.
        }
        const newChunk = _chunks.get(`${newChunkX}:${newChunkY}`);
        if (!newChunk) {
          _chunks.set(`${newChunkX}:${newChunkY}`, writable([positionable]));
        }
        else {
          newChunk.update(ck => {
            ck.push(positionable!);
            return ck;
          });
        }

        return _chunks;
      })
    }

    // Sync chunk & page
    board.onChunksChanged(chunks, changed);
  }
  function onPositionableChunkChanged(e: CustomEvent<{ key: string, initChunk: { x: number, y: number }, newChunk: { x: number, y: number }, newPos: { x: number, y: number } }>) {
    const { key, initChunk, currChunk, newPos } = e.detail;

    chunks.update(cks => {
      const initCk = cks.get(`${initChunk.x}:${initChunk.y}`);
      if (!initCk) return cks; // todo: warn? dont rly need cuz if !chunked positionable should be fine.

      // Extract positionable & remove init chunk if empty.
      let positionable: IPositionable | undefined;
      initCk.update(ck => {
        positionable = ck.find(p => p.key === key);
        if (positionable) ck = ck.filter(p => p.key !== positionable!.key);
        return ck;
      });
      if (!positionable) return cks; // todo: warn? dont rly need cuz if !chunked positionable should be fine.
      if (get(initCk).length <= 0) {
        cks.delete(`${initChunk.x}:${initChunk.y}`);
      }

      // Update positionable.
      positionable.posX = newPos.x;
      positionable.posY = newPos.y;

      // Add positionable to new chunk.
      if (!cks.has(`${currChunk.x}:${currChunk.y}`)) {
        cks.set(`${currChunk.x}:${currChunk.y}`, writable([]));
      }
      cks.get(`${currChunk.x}:${currChunk.y}`)!.update(s => {
        s.push(positionable!);
        return s;
      });

      return cks;
    });
  }

  onMount(() => {
    htmlEl.addEventListener("draggable_move_end", onPositionableChunkChanged);
  })
  onMount(() => {
    dispatch("warmChunksChanged", { warmChunks: calcWarmChunks() });
  });
  onDestroy(() => {
    htmlEl && htmlEl.removeEventListener("draggable_move_end", onPositionableChunkChanged);
  });
</script>

<div class="chunked" bind:this={htmlEl}>
<!-- {#key $chunksUpdate} -->
  {#each $chunks.entries() as [k, v] (k)}
    {@const cX = parseInt(k.split(":")[0])}
    {@const cY = parseInt(k.split(":")[1])}
    {#if chunkInView(cX, cY, $viewChunkX, $viewChunkY)}
      {#if lazy}
      {#await chunkComponent then c}
        <svelte:component
          this={c.default}
          {board}
          positionables={v}
          chunkX={cX}
          chunkY={cY}
          let:item
        >
          <slot {item}/>
        </svelte:component>
      {/await}
      {:else}
      <Chunk
          {board}
            positionables={v}
            chunkX={cX}
            chunkY={cY}
            let:item
          >
            <slot {item}/>
          </Chunk>
      {/if}
    {/if}
  {/each}
<!-- {/key} -->
</div>

<style>
  .chunked {
    display: contents;
  }
</style>