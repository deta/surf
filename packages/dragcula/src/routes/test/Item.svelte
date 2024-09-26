<script lang="ts">
  import { HTMLDragZone, HTMLDragItem, DragData } from "$lib/index.js";

  export let item: { id: string };

  const imgUrl = {
    plane: "https://i.imgur.com/JTsvXOO.png",
    girl: "https://i.imgur.com/gNcrt3A.png"
  }[item.id];
</script>

<div
  draggable="true"
  use:HTMLDragItem.action={{
    data: new DragData({ id: item.id })
  }}
  style={`width: 140px; height: 120px; background: green; background: url('${imgUrl}'); background-size: cover;`}
></div>
