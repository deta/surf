<script lang="ts">
  import { HTMLDragItem, DragculaDragEvent } from "$lib/index.js";
  import type { DataTypes, IShape } from "./+page.svelte";

  export let item: IShape;

  function handleDragStart(drag: DragculaDragEvent) {
    drag.item!.data.setData("item", item);
  }
</script>

<div
  id="item-{item.id}"
  draggable="true"
  class="item {item.type}"
  style="background: {item.color};"
  style:view-transition-name={item.id}
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
></div>

<style lang="scss">
  .item {
    width: 100px;
    height: 100px;
  }

  :global(.item[data-drag-preview]) {
    transition: all 230ms;
    transition-timing-function: cubic-bezier(0.22, 1.21, 0.71, 1.13);
  }
  :global(.item[data-drag-preview][data-drag-target="squares"]) {
    border-radius: 0;
  }
  :global(.item[data-drag-preview][data-drag-target="circles"]) {
    border-radius: 100%;
    width: 150px;
    height: 150px;
  }

  :global(.item[data-drag-preview][data-drag-target="roundeds"]) {
    border-radius: 1.5rem;
  }

  :global(.item.square) {
  }
  :global(.item.circle) {
    border-radius: 100%;
    width: 150px;
    height: 150px;
  }
  :global(.item.rounded) {
    border-radius: 1.5rem;
  }
</style>
