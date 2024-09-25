<script lang="ts">
  import { onMount } from "svelte";
  import { HTMLDragZone, HTMLDragItem, DragData } from "$lib/index.js";
  import { log } from "$lib/utils/internal.js";
  import { writable } from "svelte/store";
  import { type TFile } from "./File.svelte";
  import File from "./File.svelte";

  const root: TFile = writable({
    name: "root",
    children: writable([
      writable({
        name: "file1",
        accepts: false,
        children: writable([
          writable({ name: "file1 next", children: writable([]) }),
          writable({ name: "file1 next next", children: writable([]) })
        ])
      }),
      writable({ name: "file2 next", children: writable([]) }),
      writable({ name: "file 3", children: writable([]) })
    ])
  });
</script>

<File file={root} />

<br /><br />

<div
  class="hoverable"
  on:dragenter={(e) => e.target.classList.add("hover")}
  on:dragleave={(e) => e.target.classList.remove("hover")}
>
  hoverable
  <span>foo</span>
</div>

<style>
  :global([data-drag-preview]) {
    pointer-events: none !important;
    user-select: none !important;
    transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--drag-offsetX, 0px), var(--drag-offsetY, 0px))
      scale(var(--drag-scale, 1)) scale(var(--drag-scaleX, 1), var(--drag-scaleY, 1))
      rotate(var(--drag-tilt, 0));
    transition: transform 35ms cubic-bezier(0, 1.22, 0.73, 1.13);
    opacity: 75%;
    /*scale: var(--scaleX, 1) var(--scaleY, 1);*/
  }

  :global([data-drag-zone]) {
    border: 2px solid transparent;
  }
  :global([data-drag-zone][data-drag-target="true"]) {
    border: 2px dashed gray;
  }

  .hoverable {
    background: lightgray;
    padding: 1rem;

    &:hover,
    &.hover {
      background: gray;
    }
  }
</style>
