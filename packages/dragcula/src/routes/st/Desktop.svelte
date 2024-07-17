<script lang="ts">
  import Card from "./Card.svelte";
  import { writable } from "svelte/store";
  import { DragZone } from "$lib/controllers.js";

  export let cards: Writable<{ id: string; title: string; icon: string }[]> = writable([]);
</script>

<div
  class="desktop"
  use:DragZone.action={{
    id: "desktop",
    removeItem: (item) => {
      cards.update((items) => {
        const idx = items.findIndex((v) => v.id === item.id);
        if (idx > -1) {
          items.splice(idx, 1);
        }
        return items;
      });
    }
  }}
  on:Drop={(e) => {
    cards.update((items) => {
      const dat = e.dataTransfer["test/tab"];
      items.push({
        ...dat,
        banner: dat.icon
      });
      return items;
    });
  }}
>
  {$cards.length}
  {#each $cards as card (card)}
    <Card {card} />
  {/each}
</div>

<style lang="scss">
  .desktop {
    width: 100%;
    background-image: #fbf9f7;
  }
</style>
