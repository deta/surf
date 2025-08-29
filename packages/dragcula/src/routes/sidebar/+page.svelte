<script lang="ts">
  import { writable } from "svelte/store";
  import { HTMLAxisDragZone, DragculaDragEvent } from "$lib/index.js";
  import Tab from "./Tab.svelte";

  const tabs = writable<ITab[]>([
    {
      id: "tab-1",
      type: "page",
      title: "Tageschau",
      favicon: "https://www.tagesschau.de/favicon.ico"
    },
    { id: "tab-2", type: "page", title: "Google", favicon: "https://www.google.com/favicon.ico" },
    { id: "tabspace-1", type: "space", title: "Space One", favicon: "yellow" },
    { id: "tab-3", type: "page", title: "Github", favicon: "https://www.github.com/favicon.ico" },
    { id: "tab-4", type: "page", title: "Reddit", favicon: "https://www.reddit.com/favicon.ico" },
    {
      id: "tab-5",
      type: "page",
      title: "Hacker news",
      favicon: "https://new.ycombinator.com/favicon.ico"
    },
    { id: "tabspace-2", type: "space", title: "Space Two", favicon: "green" }
  ]);

  const pinned = writable<ITab[]>([]);

  function handleDrop(drag: DragculaDragEvent) {
    const dragTab = drag.item.data.getData("tab") as ITab;

    tabs.update((_tabs) => {
      _tabs.splice(
        _tabs.findIndex((e) => e.id === dragTab.id),
        1
      );
      _tabs.splice(drag.index ?? 0, 0, dragTab);
      return _tabs;
    });
  }
</script>

<div
  id="pinned"
  class="pinned"
  axis="horizontal"
  use:HTMLAxisDragZone.action={{
    accepts: (drag) => {
      return true;
    }
  }}
  on:Drop={handleDrop}
>
  {#each $pinned as tab}
    <Tab {tab} />
  {/each}
</div>

<div
  id="sidebar"
  class="sidebar"
  use:HTMLAxisDragZone.action={{
    accepts: (drag) => {
      return true;
    }
  }}
  on:Drop={handleDrop}
>
  {#each $tabs as tab}
    <Tab {tab} />
  {/each}
</div>

<style lang="scss">
  :global(body) {
    margin: 3rem;
  }

  .sidebar {
    font-family: sans-serif;
    display: flex;
    flex-direction: column;
  }
  .pinned {
    height: 100px;
    width: 100%;
    background: #f0f0f0;
  }

  :global([data-drag-preview]) {
    pointer-events: none !important;
    user-select: none !important;
    transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--drag-offsetX, 0px), var(--drag-offsetY, 0px))
      scale(var(--drag-scale, 1)) scale(var(--drag-scaleX, 1), var(--drag-scaleY, 1))
      rotate(var(--drag-tilt, 0));
    transition: transform 35ms cubic-bezier(0, 1.22, 0.73, 1.13);
    opacity: 75%;
  }

  :global([data-drag-zone]) {
    border: 2px solid transparent;
  }
  :global([data-drag-zone][data-drag-target="true"]) {
    border: 2px dashed gray;
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 2%;
    pointer-events: none !important;
    background: var(--color);
    transition:
      top 100ms cubic-bezier(0.2, 0, 0, 1),
      left 100ms cubic-bezier(0.2, 0, 0, 1);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical) {
    left: var(--inset);
    right: var(--inset);
    height: 2px;
    transform: translateY(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal) {
    top: var(--inset);
    bottom: var(--inset);
    width: 2px;
    transform: translateX(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::before) {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::after) {
    content: "";
    position: absolute;
    top: 0;
    right: -6px;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::before) {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::after) {
    content: "";
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
</style>
