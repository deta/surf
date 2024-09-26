<script lang="ts">
  import { HTMLDragZone, HTMLDragItem, DragData } from "$lib/index.js";
  import { DragculaDragEvent } from "$lib/Event.js";
  import { writable } from "svelte/store";
  import Item from "./Item.svelte";

  interface IItem {
    id: string;
  }

  const pinkItems = writable([]);
  const greenItems = writable([{ id: "plane" }, { id: "girl" }]);
  const yellowItems = writable([]);
  const grayItems = writable([]);

  function handleDrop(drag: DragculaDragEvent) {
    drag.stopPropagation();
    const from =
      drag.from === null
        ? null
        : ((fromId: string | null) => {
            switch (fromId) {
              case "green":
                return greenItems;
              case "pink":
                return pinkItems;
              case "yellow":
                return yellowItems;
              case "gray":
                return grayItems;
            }
          })(drag.from.id);

    const to =
      drag.to === null
        ? null
        : ((fromId: string | null) => {
            switch (fromId) {
              case "green":
                return greenItems;
              case "pink":
                return pinkItems;
              case "yellow":
                return yellowItems;
              case "gray":
                return grayItems;
            }
          })(drag.to.id);

    const data = drag.data.getData("id");

    from?.update((items) => {
      items.splice(
        items.findIndex((e) => e.id === data),
        1
      );
      return items;
    });

    to?.update((items) => {
      items.push({ id: data });
      return items;
    });

    console.warn("dropped: ", drag.data, "from:", from, "to:", to);
    drag.continue();
  }
</script>

<div style="display:flex;">
  <div
    id="gray"
    use:HTMLDragZone.action={{}}
    style="width: 400px; height: 200px; background: gray; display:flex;justify-content:center;align-items:center;"
    on:Drop={handleDrop}
  >
    {#each $grayItems as item}
      <Item {item} />
    {/each}
    <div
      id="yellow"
      use:HTMLDragZone.action={{}}
      style="width: 300px; height: 100px; background: yellow; display:flex;justify-content:center;align-items:center;"
      on:Drop={handleDrop}
    >
      {#each $yellowItems as item}
        <Item {item} />
      {/each}
      <div
        id="pink"
        use:HTMLDragZone.action={{}}
        style="width: 150px; height: 100px; background: pink;"
        on:Drop={handleDrop}
      >
        {#each $pinkItems as item}
          <Item {item} />
        {/each}
      </div>
    </div>
  </div>
  <div
    id="green"
    use:HTMLDragZone.action={{}}
    style="width: 400px; height: 300px; background: green;"
    on:Drop={handleDrop}
  >
    {#each $greenItems as item}
      <Item {item} />
    {/each}
  </div>
</div>
<br /><br />

<!--<div
	draggable="true"
	use:HTMLDragItem.action={{
		data: new DragData({ blobber: 'merkel' })
	}}
	style="width: 260px; height: 150px; background: green; background: url('https://i.imgur.com/JTsvXOO.png'); background-size: cover;"
></div>
<div
	draggable="true"
	use:HTMLDragItem.action={{
		data: new DragData({ angela: 'merkel' })
	}}
	style="width: 200px; height: 150px; background: green; background: url('https://i.imgur.com/gNcrt3A.png'); background-size: cover;"
></div>-->

<style lang="scss">
  :global([data-drag-preview]) {
    pointer-events: none !important;
    user-select: none !important;
    transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--offsetX, 0px), var(--offsetY, 0px))
      scale(var(--scale, 1)) scale(var(--scaleX, 1), var(--scaleY, 1)) rotate(var(--tilt, 0));
    transition: transform 35ms cubic-bezier(0, 1.22, 0.73, 1.13);
    opacity: 75%;
    /*scale: var(--scaleX, 1) var(--scaleY, 1);*/
  }

  :global([data-drag-zone][data-drag-target="true"]) {
    border: 2px solid red;
  }
</style>
