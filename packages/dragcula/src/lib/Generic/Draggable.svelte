<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { DragElement } from "../dragcula.ts";
  import type { Writable } from "svelte/store";

  export let id: string;

  /*const dispatch = createEventDispatcher<{
    drop: { id: string; data: any };
  }>();*/
  let el: HTMLElement;

  let dragElement: DragElement<any>;
  let isDragging: Writable<boolean>;
  let isOverZone: Writable<boolean>;

  onMount(() => {
    dragElement = new DragElement(el, id);
    isDragging = dragElement.isDragging;
    isOverZone = dragElement.isOverZone;
  });
</script>

<div
  class:draggable={true}
  class:dragging={$isDragging}
  class:overZone={$isOverZone}
  data-draggable-id={id}
  bind:this={el}
  on:mousedown={(e) => dragElement.startDrag()}
  style:view-transition-name="item-{id}"
  {...$$restProps}
>
  <slot />
</div>

<style lang="scss">
  .draggable {
    //width: fit-content;
    //height: fit-content;
  }
  /*:global(.draggable > *) {
    width: 100% !important;
    height: 100%;
  }*/
</style>
