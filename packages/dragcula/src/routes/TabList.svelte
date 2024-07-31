<script lang="ts">
  import Tab, { type ITab } from "./Tab.svelte";
  import PinnedTab from "./PinnedTab.svelte";
  import { derived, writable, type Writable } from "svelte/store";
  import { HTMLAxisDragZone, HTMLDragZone, type DragculaDragEvent } from "$lib/index.js";
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
      e.preventDefault();
      return;
    }

    // Handle tab dnd
    if (e.data["test/tab"] !== undefined) {
      const dragData = e.data["test/tab"] as ITab;

      tabs.update((_tabs) => {
        let unpinnedTabsArray = get(unpinnedTabs);
        let pinnedTabsArray = get(pinnedTabs);
        let magicTabsArray = get(magicTabs);

        let fromTabs: ITab[];
        let toTabs: ITab[];

        if (e.from.id === "tabs-unpinned") {
          fromTabs = unpinnedTabsArray;
        } else if (e.from.id === "tabs-pinned") {
          fromTabs = pinnedTabsArray;
        } else if (e.from.id === "tabs-magic") {
          fromTabs = magicTabsArray;
        }
        if (e.to.id === "tabs-unpinned") {
          toTabs = unpinnedTabsArray;
        } else if (e.to.id === "tabs-pinned") {
          toTabs = pinnedTabsArray;
        } else if (e.to.id === "tabs-magic") {
          toTabs = magicTabsArray;
        }

        // CASE: to already includes tab
        if (toTabs.find((v) => v.id === dragData.id)) {
          console.warn("ONLY Update existin tab");
          const existing = fromTabs.find((v) => v.id === dragData.id);
          if (existing) {
            existing.index = e.index;
          }
          e.item.node.remove();
          fromTabs.splice(
            fromTabs.findIndex((v) => v.id === dragData.id),
            1
          );
          fromTabs.splice(e.index || 0, 0, existing);
        } else {
          console.warn("ADDING NEW ONE");
          // Remove old
          const idx = fromTabs.findIndex((v) => v.id === dragData.id);
          if (idx > -1) {
            fromTabs.splice(idx, 1);
          }

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
        }

        console.log(...pinnedTabsArray, ...unpinnedTabsArray, ...magicTabsArray);

        // Update the indices of the tabs in all lists
        const updateIndices = (tabs: ITab[]) => tabs.map((tab, index) => ({ ...tab, index }));

        unpinnedTabsArray = updateIndices(unpinnedTabsArray);
        pinnedTabsArray = updateIndices(pinnedTabsArray);
        magicTabsArray = updateIndices(magicTabsArray);

        // Combine all lists back together
        const newTabs = [...unpinnedTabsArray, ...pinnedTabsArray, ...magicTabsArray];

        console.warn("New tabs", [...newTabs]);

        return newTabs;
      });
      // Mark the drop completed
      e.preventDefault();
    }
  }

  /*
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
  use:HTMLAxisDragZone.action={{
    id: "tabs-pinned"
  }}
  on:Drop={handleCoDrop}
  on:DragEnter={(e) => {
    e.preventDefault();
  }}
>
  {#each $pinnedTabs as tab, index (tab.id)}
    {#key tab}
      <PinnedTab {tab} />
    {/key}
  {/each}
</div>

<div
  class="magical"
  axis="vertical"
  use:HTMLAxisDragZone.action={{
    id: "tabs-magic"
  }}
  on:Drop={handleCoDrop}
  on:DragEnter={(e) => {
    e.preventDefault();
  }}
>
  {#each $magicTabs as tab, index (tab.id)}
    {#key tab}
      <Tab {tab} />
    {/key}
  {/each}
</div>

<div
  class="unpinned"
  axis="vertical"
  use:HTMLAxisDragZone.action={{
    id: "tabs-unpinned"
  }}
  on:Drop={handleCoDrop}
  on:DragEnter={(e) => {
    e.preventDefault();
  }}
>
  {#each $unpinnedTabs as tab, index (tab.id)}
    {#key tab}
      <Tab
        {tab}
        on:close={(e) => {
          const id = e.detail;
          document.startViewTransition(() => {
            tabs.update((items) => items.filter((v) => v.id !== tab.id));
          });
        }}
      />
    {/key}
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
