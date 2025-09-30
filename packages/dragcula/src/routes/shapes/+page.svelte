<script context="module" lang="ts">
  export interface IShape {
    id: string;
    type: "square" | "circle" | "rounded";
    color: string;
  }

  /*export interface DataTypes {
		[key: string]: string;
		item: IShape;
	}*/

  const randomRgbColorFromStringHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const c = (hash & 0x00ffffff).toString(16).toUpperCase();

    return "#" + "00000".substring(0, 6 - c.length) + c;
  };
</script>

<script lang="ts">
  import { HTMLAxisDragZone, DragculaDragEvent, HTMLDragItem } from "$lib/index.js";
  import { tick } from "svelte";
  import Shape from "./Item.svelte";
  import { writable } from "svelte/store";

  const bucketSquare = writable([
    {
      id: crypto.randomUUID().toString(),
      type: "square",
      color: randomRgbColorFromStringHash("asfaf")
    }
  ]);
  const bucketCircle = writable([
    {
      id: crypto.randomUUID().toString(),
      type: "circle",
      color: randomRgbColorFromStringHash("asfaf244545")
    }
  ]);
  const bucketRounded = writable([
    {
      id: crypto.randomUUID().toString(),
      type: "rounded",
      color: randomRgbColorFromStringHash("asfafsafsafs")
    },
    {
      id: crypto.randomUUID().toString(),
      type: "rounded",
      color: randomRgbColorFromStringHash("dh783z")
    },
    {
      id: crypto.randomUUID().toString(),
      type: "rounded",
      color: randomRgbColorFromStringHash("2as2hs")
    }
  ]);

  async function handleDrop(drag: DragculaDragEvent<{ item: IShape }>) {
    const from =
      drag.from === null
        ? null
        : ((fromId: string | null) => {
            switch (fromId) {
              case "squares":
                return bucketSquare;
              case "circles":
                return bucketCircle;
              case "roundeds":
                return bucketRounded;
            }
          })(drag.from.id);

    const to =
      drag.to === null
        ? null
        : ((fromId: string | null) => {
            switch (fromId) {
              case "squares":
                return bucketSquare;
              case "circles":
                return bucketCircle;
              case "roundeds":
                return bucketRounded;
            }
          })(drag.to.id);

    const data = drag.data.getData("item");

    from?.update((items) => {
      items.splice(
        items.findIndex((e) => e.id === data.id),
        1
      );
      return items;
    });

    //const transition = await HTMLDragItem.startTransition(async () => {
    to?.update((items) => {
      data.type = drag.to!.id.substring(0, drag.to!.id.length - 1) as
        | "square"
        | "circle"
        | "rounded";
      items.splice(drag.index ?? 0, 0, data);
      return items;
    });
    //}, false);

    drag.continue();
  }
</script>

<svelte:window
  on:dragend={(e) => {
    console.warn("WIDNWO DRAG END", e);
  }}
/>

<main>
  <div
    id="squares"
    class="bucket"
    axis="vertical"
    use:HTMLAxisDragZone.action={{
      accepts: (drag) => {
        return true;
      }
    }}
    on:Drop={handleDrop}
  >
    {#each $bucketSquare as item}
      <Shape {item} />
    {/each}
  </div>
  <div
    id="circles"
    class="bucket"
    axis="vertical"
    use:HTMLAxisDragZone.action={{}}
    on:Drop={handleDrop}
  >
    {#each $bucketCircle as item}
      <Shape {item} />
    {/each}
  </div>
  <div
    id="roundeds"
    class="bucket"
    axis="vertical"
    use:HTMLAxisDragZone.action={{}}
    on:Drop={handleDrop}
  >
    {#each $bucketRounded as item}
      <Shape {item} />
    {/each}
  </div>
</main>

<br />

Foo

<style lang="scss">
  :global(::view-transition-group(*)) {
    animation-duration: 230ms;
    animation-timing-function: ease-in-out;
  }
  :global([data-drag-preview]) {
    //cursor: grabbing !important;
    //pointer-events: none !important;
    //user-select: none !important;
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
  main {
    width: 100%;
    min-height: 400px;
    height: fit-content;
    background: rgba(0, 0, 0, 0.05);

    display: flex;
    justify-content: space-around;
  }

  .bucket {
    min-width: 100px;
    display: flex;
    flex-direction: column;
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 2%;
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
