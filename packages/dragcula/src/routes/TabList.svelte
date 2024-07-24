<script lang="ts">
  import Tab from "./Tab.svelte";
  import PinnedTab from "./PinnedTab.svelte";
  import { writable, type Writable } from "svelte/store";
  import { DragZone, AxisDragZone } from "$lib/index.js";

  export let tabs: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
  let pinned: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
  let magical: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
</script>

<div
  class="magical"
  axis="vertical"
  use:AxisDragZone.action={{
    id: "tabs-magic",
    acceptDrag: (drag) => {
      return true;
    }
  }}
  on:DragEnd={(e) => {
    const item = e.item;
    magical.update((items) => {
      const idx = items.findIndex((v) => v.id === item.id);
      if (idx > -1) {
        items.splice(idx, 1);
      }
      return items;
    });
  }}
  on:Drop={(e) => {
    console.warn("magic drop", e);
    magical.update((items) => {
      if (e.dataTransfer.hasOwnProperty("test/tab")) {
        const dat = e.dataTransfer["test/tab"];
        items.splice(e.index, 0, dat);
      }
      return items;
    });
  }}
>
  {#each $magical as tab (tab.id)}
    <Tab {tab} />
  {/each}
</div>
<div
  class="unpinned"
  axis="vertical"
  use:AxisDragZone.action={{
    id: "tabs-unpinned",
    acceptDrag: (drag) => {
      return true;
    }
  }}
  on:DragEnd={(e) => {
    console.warn("dragend unpinned", e);

    const item = e.item;
    tabs.update((items) => {
      const idx = items.findIndex((v) => v.id === item.id);
      if (idx > -1) {
        items.splice(idx, 1);
      }
      return items;
    });
  }}
  on:Drop={(drag) => {
    console.warn("unpin drop", drag);

    tabs.update((items) => {
      if (drag.isNative) {
        // Get files
        const files = drag.dataTransfer.files;
        // Create tabs from files with name as title
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const imgDataUdl = URL.createObjectURL(file);
          items.push({
            id: Math.random().toString(36).substr(2, 9),
            title: file.name,
            icon: imgDataUdl
          });
        }
      } else if (drag.dataTransfer.hasOwnProperty("test/card")) {
        const dat = drag.dataTransfer["test/card"];
        items.splice(drag.index, 0, {
          ...dat,
          icon: dat.banner
        });
      } else if (drag.dataTransfer.hasOwnProperty("test/tab")) {
        const dat = drag.dataTransfer["test/tab"];
        items.splice(drag.index, 0, dat);
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
  axis="horizontal"
  use:AxisDragZone.action={{
    id: "pinned",
    acceptDrag: (drag) => {
      return true;
    }
  }}
  on:DragEnd={(e) => {
    const item = e.item;
    pinned.update((items) => {
      const idx = items.findIndex((v) => v.id === item.id);
      if (idx > -1) {
        items.splice(idx, 1);
      }
      return items;
    });
  }}
  on:Drop={(e) => {
    pinned.update((items) => {
      if (e.isNative) {
        const dat = e.dataTransfer.getData("test/tab");
      }

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

  :global([data-dragcula-zone][data-dragcula-drop-target]) {
    border: 1px dashed rgba(40, 40, 40, 0.8) !important;
  }
  // Style cursor when over valid target zone
  :global(body:has([data-dragcula-can-drop="true"])) {
    //cursor: copy;
  }

  .magical {
    min-height: 100px;
    background: rgba(227, 87, 173, 0.2);
    border: 1px solid transparent;
    border-radius: 5px;
  }

  .unpinned {
    flex: 1;
    border: 1px solid transparent;
    border-radius: 5px;
    margin-block: 10px;
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
