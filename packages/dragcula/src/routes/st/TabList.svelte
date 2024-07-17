<script lang="ts">
  import Tab from "./Tab.svelte";
  import PinnedTab from "./PinnedTab.svelte";
  import { writable } from "svelte/store";
  import { DragZone } from "$lib/controllers.js";
  import { VerticalDragZone } from "$lib/VerticalZone.js";
  import { HorizontalDragZone } from "$lib/HorizontalZone.js";

  export let tabs: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
  let pinned: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
</script>

<div
  class="unpinned"
  use:VerticalDragZone.action={{
    id: "tabs-unpinned",
    removeItem: (item) => {
      tabs.update((items) => {
        const idx = items.findIndex((v) => v.id === item.id);
        if (idx > -1) {
          items.splice(idx, 1);
        }
        return items;
      });
    }
  }}
  on:Drop={(e) => {
    console.warn("unpin drop", e);
    tabs.update((items) => {
      if (e.dataTransfer.hasOwnProperty("test/card")) {
        const dat = e.dataTransfer["test/card"];
        items.splice(e.index, 0, {
          ...dat,
          icon: dat.banner
        });
      } else if (e.dataTransfer.hasOwnProperty("test/tab")) {
        const dat = e.dataTransfer["test/tab"];
        items.splice(e.index, 0, dat);
      }
      return items;
    });
  }}
>
  {#each $tabs as tab (tab.id)}
    <Tab
      {tab}
      on:close={(e) => {
        const id = e.detail;
        document.startViewTransition(() => {
          tabs.update((items) => items.filter((v) => v.id !== id));
        });
      }}
    />
  {/each}
</div>

<div
  class="pinned"
  use:HorizontalDragZone.action={{
    id: "pinned",
    removeItem: (item) => {
      pinned.update((items) => {
        const idx = items.findIndex((v) => v.id === item.id);
        if (idx > -1) {
          items.splice(idx, 1);
        }
        return items;
      });
    }
  }}
  on:Drop={(e) => {
    console.warn("pin drop", e);
    pinned.update((items) => {
      if (e.dataTransfer.hasOwnProperty("test/card")) {
        const dat = e.dataTransfer["test/card"];
        const insertIdx = e.index;
        items.splice(insertIdx, 0, {
          ...dat,
          icon: dat.banner
        });
      } else if (e.dataTransfer.hasOwnProperty("test/tab")) {
        const dat = e.dataTransfer["test/tab"];
        const insertIdx = e.index;
        items.splice(insertIdx, 0, dat);
      }
      return items;
    });
  }}
>
  {#each $pinned as tab (tab.id)}
    <PinnedTab {tab} />
  {/each}
</div>

<style lang="scss">
  :global(body[data-dragcula-dragging="true"]) {
    cursor: grabbing;
    user-select: none;
  }
  :global(body[data-dragcula-dragging="true"] *:not([data-dragcula-zone])) {
    pointer-events: none;
  }
  :global(body[data-dragcula-dragging="true"] *[data-dragcula-zone]) {
    pointer-events: all;
  }

  // Style cursor when over valid target zone
  :global(body:has([data-dragcula-can-drop="true"])) {
    //cursor: copy;
  }

  .unpinned {
    flex: 1;
    border: 1px solid transparent;
    border-radius: 5px;
  }
  :global(.unpinned[data-dragcula-target="true"]) {
    border: 1px dashed rgba(40, 40, 40, 0.4);
  }

  .pinned {
    background: #eee;
    border: 1px solid #ddd;
    height: 50px;
    border-radius: 10px;
    display: flex;
    gap: 5px;
    align-items: center;
    padding-inline: 10px;
  }
</style>
