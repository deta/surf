<script context="module" lang="ts">
  // /**
  //  * Bit merge two numbers together.
  //  * @param x
  //  * @param y
  //  */
  // export function makeCompositChunkPos(x: number, y: number) {
  //   return (x << 4) | y;
  // }
  // /**
  //  * Bit mask to get x component.
  //  * @param pos
  //  */
  // export function compositChunkPosX(pos: number) {
  //   return ((pos & 0b11110000) >> 4);
  // }
  // /**
  //  * Bit mask to get y component.
  //  * @param pos
  //  */
  // export function compositChunkPosY(pos: number) {
  //   return (pos & 0b00001111);
  // }
  // export function absToChunkIndex(x: number, y: number, chunkSize: number) {
  //   return makeCompositChunkPos(
  //     Math.floor(x / chunkSize),
  //     Math.floor(y / chunkSize)
  //   )
  // }
  export function absToChunkIndex(x: number, y: number, chunkSize: number) {
    return [Math.floor(x / chunkSize), Math.floor(y / chunkSize)];
  }
  export function positionableInView(
      posX: number,
      posY: number,
      width: number,
      height: number,
      vX: number,
      vY: number,
      CULL_MARGIN: number,
      viewPort: Vec2<number>,
      zoom: number
    ) {
      return (
        posX + width + CULL_MARGIN >= vX &&
        posY + height + CULL_MARGIN >= vY &&
        posX - CULL_MARGIN <= vX + viewPort.x / (zoom * 0.5) &&
        posY - CULL_MARGIN <= vY + viewPort.y / (zoom * 0.5)
      );
    }
</script>

<script lang="ts">
  import { getContext } from "svelte";
  import type { IBoard, IBoardSettings } from "./types/Board.type.js";
  import type { Writable } from "svelte/store";
  import type { IPositionable } from "./Positionable.svelte";
  import { randomCssColor } from "./utils.js";

  export let positionables: Writable<IPositionable[]>;

  export let chunkX: number;
  export let chunkY: number;
  export let board: IBoard;
  const settings = getContext<Writable<IBoardSettings>>("settings");
  const state = board.state;
  $: ({ viewPort } = $state);
  $: ({ x: viewX, y: viewY } = $state.viewOffset);
  $: ({ zoom } = $state);

  $: cssStyle = `transform: translate3d(${chunkX * $settings.CHUNK_SIZE}px, ${
    chunkY * $settings.CHUNK_SIZE
  }px, 0); width: ${$settings.CHUNK_SIZE}px; height: ${$settings.CHUNK_SIZE}px; ${
    $settings.DEV.CHUNK_DBG ? `background-color: ${randomCssColor(0.5)};` : ""
  }`;

  function positionableInView(
    posX: number,
    posY: number,
    width: number,
    height: number,
    vX: number,
    vY: number
  ) {
    return (
      posX + width + $settings.CULL_MARGIN >= vX &&
      posY + height + $settings.CULL_MARGIN >= vY &&
      posX - $settings.CULL_MARGIN <= vX + viewPort.w / $zoom  &&
      posY - $settings.CULL_MARGIN <= vY + viewPort.h / $zoom
    );
  }
</script>

<div class="chunk" style={cssStyle}>
  {#if $settings.DEV.CHUNK_DBG}
    <span style="font-size: 4rem;">{`${chunkX} : ${chunkY}`}</span>
  {/if}
</div>
{#if $zoom > 0.2} <!-- todo: make cfg val -->
    {#each $positionables as positionable, i (positionable.key)}
      {#if positionableInView(positionable.posX, positionable.posY, positionable.width, positionable.height, $viewX, $viewY)}
        <slot
          item={positionable}
          key={positionable.key}
          x={positionable.posX}
          y={positionable.posY}
          width={positionable.width}
          height={positionable.height}
        />
      {/if}
    {/each}
  {/if}

<style>
  .chunk {
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    backface-visibility: hidden;
    /* will-change: transform; */

    /* transform-style: preserve-3d;
    backface-visibility: hidden;
    -webkit-transform-style: preserve-3d;
-webkit-backface-visibility: hidden; */
  }
</style>
