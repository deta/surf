<script lang="ts">
  import Tab from "./Tab.svelte";
  import PinnedTab from "./PinnedTab.svelte";
  import { writable, type Writable } from "svelte/store";
  import { HTMLDragZone, type DragculaDragEvent } from "$lib/index.js";
  import { tick } from "svelte";
  import { get } from "svelte/store";

  export let tabs: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
  let pinned: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
  let magical: Writable<{ id: string; title: string; icon: string }[]> = writable([]);

  async function handleDrop(drag: DragculaDragEvent) {
    /*
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

      */

    const tabData = drag.dataTransfer["test/tab"];

    const ttabs = $tabs;
    const tpinned = $pinned;
    const tmagical = $magical;

    if (drag.from.id === "tabs-unpinned") {
      const idx = ttabs.findIndex((v) => v.id === drag.item.id);
      if (idx !== -1) ttabs.splice(idx, 1);
    } else if (drag.from.id === "tabs-magic") {
      const idx = tmagical.findIndex((v) => v.id === drag.item.id);
      if (idx !== -1) tmagical.splice(idx, 1);
    } else if (drag.from.id === "tabs-pinned") {
      const idx = tpinned.findIndex((v) => v.id === drag.item.id);
      if (idx !== -1) tpinned.splice(idx, 1);
    }

    tabs.update((_tabs) => {
      magical.update((_magical) => {
        pinned.update((_pinned) => {
          return tpinned;
        });
        return tmagical;
      });
      return ttabs;
    });
    await tick();

    if (drag.to.id === "tabs-unpinned") {
      ttabs.splice(drag.index, 0, tabData);
    } else if (drag.to.id === "tabs-magic") {
      tmagical.splice(drag.index, 0, tabData);
    } else if (drag.to.id === "tabs-pinned") {
      tpinned.splice(drag.index, 0, tabData);
    }

    tabs.update((_tabs) => {
      magical.update((_magical) => {
        pinned.update((_pinned) => {
          return tpinned;
        });
        return tmagical;
      });
      return ttabs;
    });
  }

  async function onDropPinned(drag: DragculaDragEvent) {
    console.warn("onDropPinned", drag);
    if (drag.data["test/tab"] !== undefined) {
      if (drag.effect === "move") {
        let src;
        if (drag.from.id === "tabs-unpinned") {
          src = tabs;
        } else {
          src = pinned;
        }
        const idx = get(src).findIndex((v) => v.id === drag.data["test/tab"].id);
        if (idx !== -1)
          src.update((v) => {
            v.splice(idx, 1);
            return v;
          });
      }

      $pinned.push(drag.data["test/tab"]);
    }
    $pinned = $pinned;
  }

  async function onDropUnpinned(drag: DragculaDragEvent) {
    console.warn("onDropUnpinned", drag);

    if (drag.isNative) {
      // Get files
      const files = drag.data.files;
      // Create tabs from files with name as title
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imgDataUdl = URL.createObjectURL(file);
        $tabs.push({
          id: Math.random().toString(36).substr(2, 9),
          title: file.name,
          icon: imgDataUdl
        });
      }
    } else if (drag.data["test/tab"] !== undefined) {
      if (drag.effect === "move") {
        let src;
        if (drag.from.id === "tabs-pinned") {
          src = pinned;
        } else {
          src = tabs;
        }
        const idx = get(src).findIndex((v) => v.id === drag.data["test/tab"].id);
        if (idx !== -1)
          src.update((v) => {
            v.splice(idx, 1);
            return v;
          });
      }

      $tabs.push(drag.data["test/tab"]);
    }
    $tabs = $tabs;
  }
</script>

<div
  class="pinned"
  axis="horizontal"
  use:HTMLDragZone.action={{
    id: "tabs-pinned"
  }}
  on:Drop={onDropPinned}
>
  {#each $pinned as tab (tab.id)}
    <PinnedTab {tab} />
  {/each}
</div>

<!--<div
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
  on:Drop={handleDrop}
>
  {#each $magical as tab (tab.id)}
    <Tab {tab} />
  {/each}
</div>-->

<div
  class="unpinned"
  axis="vertical"
  use:HTMLDragZone.action={{
    id: "tabs-unpinned"
  }}
  on:Drop={onDropUnpinned}
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
    justify-content: center;
    align-items: center;
    padding-inline: 10px;
    margin-bottom: 10px;
  }
</style>
