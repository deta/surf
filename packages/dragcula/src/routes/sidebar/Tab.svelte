<script lang="ts" context="module">
  export interface ITab {
    id: string;
    type: "page" | "space";
    title: string;
    favicon: string;
  }
</script>

<script lang="ts">
  import type { DragculaDragEvent } from "$lib/Event.js";

  import { HTMLDragItem, HTMLDragZone } from "$lib/index.js";
  export let tab: ITab;

  function handleDragStart(drag: DragculaDragEvent) {
    drag.item!.data.setData("tab", tab);
  }

  function handleDrop(drag: DragculaDragEvent) {
    const dropTab = drag.item?.data.getData("tab") as ITab;
    console.warn("Dropping page onto space", dropTab.title, " >> ", tab.title);
  }
</script>

<div
  id="tab-{tab.title}"
  class="tab"
  class:space={tab.type === "space"}
  style={tab.type === "space" ? "--color: {tab.favicon};" : ""}
  draggable="true"
  use:HTMLDragItem.action={{}}
  on:DragStart={handleDragStart}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (tab.type !== "space") return false;
      const tabData = drag.item?.data.getData("tab");
      if (tabData.type !== "page") return false;
      return true;
    }
  }}
  on:Drop={handleDrop}
>
  {#if tab.type === "space"}
    <div
      style="width: 16px; height: 16px; background: {tab.favicon}; border-radius: 10px; border: 1px solid black;"
    ></div>
  {:else}
    <img src={tab.favicon} alt={tab.title} />
  {/if}
  <span>{tab.title}</span>
</div>

<style lang="scss">
  .tab {
    width: 25ch;
    display: flex;
    gap: 0.5rem;
    border-radius: 0.75rem;
    padding: 0.5rem 0.75rem;

    &.space {
      /* Space-specific styles can be added here */
    }

    &:hover {
      background: rgba(235, 235, 235, 0.8);
    }

    img {
      width: 18px;
      aspect-ratio: 1 / 1;
    }
  }

  :global(.tab[data-drag-preview]) {
    background: rgba(0, 0, 0, 0.1);
    transition: all 230ms;
    transition-timing-function: cubic-bezier(0.22, 1.21, 0.71, 1.13);
  }
</style>
