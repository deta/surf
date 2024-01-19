<script lang="ts">
  import Draggable from "$lib/Draggable.svelte";
  import Positionable from "$lib/Positionable.svelte";
  import type { IPositionable } from "$lib/Positionable.svelte";
  import Resizable from "$lib/Resizable.svelte";
  import { hoistPositionable, unHoistPositionable } from "$lib/utils.js";
  import { createEventDispatcher } from "svelte";
  import type { Writable } from "svelte/store";

  export let card: Writable<IPositionable<"key">>;
  let el: HTMLElement;
  const dispatch = createEventDispatcher();

  function clickHoist() {
    if ($card.hoisted) {
      unHoistPositionable($card.key, el);
    }
    else {
      hoistPositionable($card.key, el);
    }
  }

  function onDelete() {
    dispatch("delete", $card.key);
  }
</script>

<!-- <svelte:options immutable={true} /> -->

<Positionable positionable={card} bind:el>
  <!-- TODO: Switch to mouse logic only -->
  <Resizable positionable={card} direction="top"/>
  <Resizable positionable={card} direction="right" />
  <Resizable positionable={card} direction="bottom" />
  <Resizable positionable={card} direction="left" />
  <Resizable positionable={card} direction="top-right" />
  <Resizable positionable={card} direction="top-left" />
  <Resizable positionable={card} direction="bottom-right" />
  <Resizable positionable={card} direction="bottom-left" />
  <Draggable positionable={card}>
    card
    <button on:click={clickHoist}>{$card.hoisted ? 'unHoist' : 'hoist'}</button>
    <button on:click={onDelete}>delete</button>
    <br>
    <br>
    <input type="range" min="0" max="2000" />
    <textarea rows="3" />
    <br />
    <div contenteditable="true">fio bar test asf</div>
  </Draggable>
</Positionable>
