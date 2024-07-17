<script lang="ts">
  import { DragItem } from "$lib/controllers.ts";
  import { createEventDispatcher } from "svelte";

  export let card: {
    id: string;
    title: string;
    banner: string;
  };

  const dispatch = createEventDispatcher<{}>();

  let draggable = true;
</script>

<div
  class="card"
  {draggable}
  dragpreview="hoist"
  simulatedragstart="true"
  use:DragItem.action={{ id: card.id, data: { "test/card": card } }}
  style:view-transition-name="card-{card.id}"
>
  <img src={card.banner || card.icon} alt={card.title} />
  <span>{card.title}</span>
</div>

<style lang="scss">
  .card {
    width: 250px;
    height: auto;
    background: rgb(248, 248, 248);
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    user-select: none;

    img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
    }
    span {
      font-size: 1.2em;
      font-weight: 600;
    }
  }
</style>
