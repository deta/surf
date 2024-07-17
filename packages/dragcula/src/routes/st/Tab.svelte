<script lang="ts">
  import { DragItem } from "$lib/controllers.ts";
  import { createEventDispatcher } from "svelte";

  export let tab: {
    id: string;
    title: string;
    icon: string;
  };

  const dispatch = createEventDispatcher<{
    close: { id: string };
  }>();

  let draggable = true;

  let controller;
  let showPreview: string | null = null;
</script>

<div
  class="tab"
  {draggable}
  dragpreview="hoist"
  simulatedragstart="true"
  use:DragItem.action={{
    id: tab.id,
    data: { "test/tab": tab }
    /*onInit: (controller) => {
      controller.on("dragenter", (drag) => {
        showPreview = drag.targetZone.id;

        console.warn("size", drag.targetZone?.itemDomSize);
        if (drag.targetZone?.itemDomSize !== undefined) {
          //const transition = this.startViewTransition(async () => {
          drag.item.node.style.width = `${drag.targetZone?.itemDomSize.w}px`;
          drag.item.node.style.height = `${drag.targetZone?.itemDomSize.h}px`;
          //});
        }
      });
      controller.on("dragleave", (e) => {
        showPreview = null;
      });
    }*/
  }}
  style:view-transition-name="tab-{tab.id}"
>
  <img src={tab.icon} alt="" />
  <span>{tab.title}</span>
  <button on:click={() => dispatch("close", tab.id)}>X</button>
</div>

<!-- style="view-transition-name: img-{tab.id};"   style="view-transition-name: title-{tab.id};"  -->
<style lang="scss">
  .tab {
    width: auto;
    background: transparent;
    display: flex;
    font-size: 0.6em;
    align-items: center;
    padding: 0.4rem 0.8rem;
    margin-block: 3px;
    gap: 10px;
    border-radius: 8px;
    user-select: none;

    > img {
      width: 14px;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 3px;
    }
    > span {
      flex: 1;
      font-size: 0.8rem;
      font-weight: 500;
    }

    transition: background 0.12s ease-out;
    button {
      border: none;
      aspect-ratio: 1 / 1;
      border-radius: 5px;
      padding-inline: 0.5rem;
      font-size: 1em;
      font-weight: 600;
      overflow: hidden;
      background: transparent;
      opacity: 0%;
      transition: opacity 0.12s ease-out;
      &:hover {
        background: rgba(208, 208, 208, 0.9);
      }
    }
    &:hover {
      background: rgba(228, 228, 228, 0.9);
      button {
        opacity: 100%;
      }
    }
  }
</style>
