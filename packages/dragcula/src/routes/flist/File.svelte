<script lang="ts" context="module">
  import { HTMLDragZone, HTMLDragItem, DragData } from "$lib/index.js";
  import type { Readable, Writable } from "svelte/store";

  export type TFile = Readable<{ name: string; children: Writable<File[]> }>;
</script>

<script lang="ts">
  export let file: TFile;

  const accepts = $file.accepts !== undefined ? file.accepts : true;
  const children = $file.children;
  const randomRgbColorFromStringHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const c = (hash & 0x00ffffff).toString(16).toUpperCase();

    return "#" + "00000".substring(0, 6 - c.length) + c + "44";
  };

  $: color = randomRgbColorFromStringHash($file.name);
</script>

<ul
  id="file-{$file.name}"
  class="file"
  style="--color: {color};"
  draggable="true"
  use:HTMLDragItem.action={{}}
  use:HTMLDragZone.action={{
    accepts: () => accepts
  }}
  on:Drop={(drag) => {
    console.info("Dropped on file", drag);
    drag.continue();
  }}
>
  {accepts}
  <li style="display: flex; align-items: center; gap: 0.35rem;">
    <!--<div style="width: 8px; height: 8px; background: {color}; border-radius: 10px;"></div>-->
    {$file.name}
  </li>
  <!--<div
		id="file-children-{$file.name}"
		class="children"
		use:HTMLDragZone.action={{}}
		on:Drop={(drag) => {
			console.info('Dropped on file', drag);
		}}
	>-->
  {#each $children as child}
    <svelte:self file={child} />
  {/each}
  <!--</div>-->
</ul>

<style lang="scss">
  :global(li) {
    background: rgba(255, 23, 65, 0.3);
  }

  :global(ul) {
    padding: 0;
    margin-left: 0rem;
    list-style: none;
  }

  :global(ul ul) {
    margin-left: 3rem;
  }

  :global(.file) {
    background: var(--color);
    max-width: 50ch;
    margin-bottom: 8px;
    width: 100%;
    border: 1px solid lime;
    user-select: none;
  }

  .children {
    padding-left: 1rem;
    min-height: 20px;
  }
</style>
