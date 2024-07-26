<script lang="ts">
  import Tab, { type ITab } from "./Tab.svelte";
  import PinnedTab from "./PinnedTab.svelte";
  import { derived, writable, type Writable } from "svelte/store";
  import { HTMLDragZone, type DragculaDragEvent } from "$lib/index.js";
  import { tick } from "svelte";
  import { get } from "svelte/store";

  export let tabs: Writable<ITab[]> = writable([]);

  const pinnedTabs = derived(tabs, ($tabs) => {
    return $tabs.filter((v) => v.pinned).sort((a, b) => a.index - b.index);
  });
  const unpinnedTabs = derived(tabs, ($tabs) => {
    return $tabs.filter((v) => !v.pinned && !v.magic).sort((a, b) => a.index - b.index);
  });
  const magicTabs = derived(tabs, ($tabs) => {
    return $tabs.filter((v) => v.magic).sort((a, b) => a.index - b.index);
  });

  async function handleCoDrop(e: DragculaDragEvent) {
    console.warn("handleCoDrop", e);

    if (e.isNative) {
      // TODO: Handle otherwise
      return;
    }

    // Handle tab dnd
    if (e.data["test/tab"] !== undefined) {
      const dragData = e.data["test/tab"] as ITab;

      // Get all the tab arrays
      let unpinnedTabsArray = get(unpinnedTabs);
      let pinnedTabsArray = get(pinnedTabs);
      let magicTabsArray = get(magicTabs);

      // Determine source and target lists
      let fromTabs: ITab[];
      let toTabs: ITab[];

      if (e.from.id === "tabs-unpinned") {
        fromTabs = unpinnedTabsArray;
      } else if (e.from.id === "tabs-pinned") {
        fromTabs = pinnedTabsArray;
      } else if (e.from.id === "tabs-magic") {
        fromTabs = magicTabsArray;
      }

      if (true || !["tabs-unpinned", "tabs-pinned", "tabs-magic"].includes(e.to?.id)) {
        // NOTE: We only want to remove the tab if its dragged out of the sidebar
        const idx = fromTabs.findIndex((v) => v.id === dragData.id);
        console.error("rem frim", [...fromTabs], idx);
        if (idx > -1) {
          fromTabs.splice(idx, 1);
        }
      } // FIX: MOVE UPDATE BLOW INTO THIS SCOPE
      {
        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: ITab[]) => tabs.map((tab, index) => ({ ...tab, index }));

        unpinnedTabsArray = updateIndices(unpinnedTabsArray);
        pinnedTabsArray = updateIndices(pinnedTabsArray);
        magicTabsArray = updateIndices(magicTabsArray);

        // Combine all lists back together
        const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray];

        console.debug("Removed old tab drag item", newTabs);

        tabs.set(newTabs);
      }
      // NOTE: This is important, as the old item needs to be removed before the new one can be added
      //await tick();

      if (e.to.id === "tabs-unpinned") {
        toTabs = unpinnedTabsArray;
      } else if (e.to.id === "tabs-pinned") {
        toTabs = pinnedTabsArray;
      } else if (e.to.id === "tabs-magic") {
        toTabs = magicTabsArray;
      }

      // Update pinned or magic state of the tab
      if (e.to.id === "tabs-pinned") {
        dragData.pinned = true;
        dragData.magic = false;
      } else if (e.to.id === "tabs-magic") {
        dragData.pinned = false;
        dragData.magic = true;
      } else {
        dragData.pinned = false;
        dragData.magic = false;
      }

      toTabs.splice(e.index || 0, 0, dragData);

      // Update the indices of the tabs in all lists
      const updateIndices = (tabs: Tab[]) => tabs.map((tab, index) => ({ ...tab, index }));

      unpinnedTabsArray = updateIndices(unpinnedTabsArray);
      pinnedTabsArray = updateIndices(pinnedTabsArray);
      magicTabsArray = updateIndices(magicTabsArray);

      // Combine all lists back together
      const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray];

      console.debug("New tabs", newTabs);

      tabs.set(newTabs);
      await tick();

      // Update the store with the changed tabs
      /*await bulkUpdateTabsStore(
        newTabs.map((tab) => ({
          id: tab.id,
          updates: { pinned: tab.pinned, magic: tab.magic, index: tab.index }
        }))
      );*/

      console.debug("State updated successfully");
    }
  }

  /*
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

      // end

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
  */
</script>

<div
  class="pinned"
  axis="horizontal"
  use:HTMLDragZone.action={{
    id: "tabs-pinned"
  }}
  on:Drop={handleCoDrop}
>
  {#each $pinnedTabs as tab, index (tab.id)}
    <PinnedTab {tab} />
  {/each}
</div>

<div
  class="magical"
  axis="vertical"
  use:HTMLDragZone.action={{
    id: "tabs-magic"
  }}
  on:Drop={handleCoDrop}
>
  {#each $magicTabs as tab, index (tab.id)}
    <Tab {tab} />
  {/each}
</div>

<div
  class="unpinned"
  axis="vertical"
  use:HTMLDragZone.action={{
    id: "tabs-unpinned"
  }}
  on:Drop={handleCoDrop}
>
  {#each $unpinnedTabs as tab, index (tab.id)}
    <Tab
      {tab}
      on:close={(e) => {
        const id = e.detail;
        document.startViewTransition(() => {
          tabs.update((items) => items.filter((v) => v.id !== tab.id));
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
