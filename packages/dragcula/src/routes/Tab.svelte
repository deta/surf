<script lang="ts">
  import { DragItem } from "$lib/index.ts";
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
</script>

<!--
  style:view-transition-name="tab-{tab.id}"
-->

<div
  class="tab"
  draggable="true"
  dragpreview="hoist"
  style:view-transition-name="tab-{tab.id}"
  use:DragItem.action={{
    id: tab.id,
    data: { "test/tab": tab }
  }}
  on:Drop={(e) => {
    console.warn("tab drop", e);
  }}
>
  <img src={tab.icon} alt="" />
  <span>{tab.title}</span>
  <button on:click={() => dispatch("close", tab.id)}>X</button>
</div>

<!-- style="view-transition-name: img-{tab.id};"   style="view-transition-name: title-{tab.id};"  -->
<style lang="scss">
  :global(.tab[data-dragcula-dragging="true"]) {
    background: white !important;
    opacity: 80% !important;
    box-shadow: 0 0 18px 0 rgba(40, 40, 40, 0.18);
  }
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
