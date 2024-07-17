<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { DragElement, DragZone } from "../dragcula.ts";
  import type { Writable } from "svelte/store";

  export let id: string;

  const dispatch = createEventDispatcher<{
    drop: { drag: DragOperation<unknown> };
  }>();
  let el: HTMLElement;

  let dragZone: DragZone<any>;
  let isActiveTarget: Writable<boolean>;

  onMount(() => {
    dragZone = new DragZone(el, id);
    isActiveTarget = dragZone.isActiveTarget;
    dragZone.on("drop", (drag: DragOperation<unknown>) => {
      dispatch("drop", { drag });
    });
  });

  // TODO: Do we need cleanup for event listeners?
</script>

<div class="dragZone" class:isActiveTarget={$isActiveTarget} data-dragzone-id={id} bind:this={el}>
  <slot />
</div>
