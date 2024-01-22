<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { get, type Writable } from "svelte/store";
  import type { Card } from "../../types";
  import { Draggable, Positionable, Resizable } from "@horizon/tela";
  import WebviewWrapper from "./WebviewWrapper.svelte";

  export let positionable: Writable<Positionable<any>>;

  $: card = $positionable as unknown as Card;

  const dispatch = createEventDispatcher<{ change: void; load: void }>();

  const minSize = { x: 100, y: 100 };
  const maxSize = { x: Infinity, y: Infinity };
  const initialSrc = $positionable.data.src;

  let el: HTMLElement;
  let webview: WebviewWrapper | undefined;

  const updateCard = () => {
    console.log("updateCard", card);
    // horizon.updateCard($card)
    dispatch("change");
  };

  const handleDragEnd = (e: any) => {
    updateCard();
  };

  onMount(() => {
    // el.addEventListener('draggable_start', onDragStart)
    // el.addEventListener('draggable_move', onDragMove)
    el.addEventListener("draggable_end", handleDragEnd);
    el.addEventListener("resizable_end", updateCard);

    // webview.addEventListener('did-finish-load', (e: any) => {
    //    dispatch('load')
    // })
  });

  onDestroy(() => {
    // el && el.addEventListener('draggable_start', onDragStart)
    // el && el.addEventListener('draggable_move', onDragMove)
    el && el.removeEventListener("draggable_end", handleDragEnd);
    el && el.removeEventListener("resizable_end", updateCard);
  });

  $: url = webview?.url;
  $: title = webview?.title;
  $: isLoading = webview?.isLoading;
  $: canGoBack = webview?.canGoBack;
  $: canGoForward = webview?.canGoForward;
  $: $positionable.data.src = $url ?? get(positionable).data.src;
  $: {
    console.log({
      url: $url,
      title: $title,
      isLoading: $isLoading,
      canGoBack: $canGoBack,
      canGoForward: $canGoForward,
    });
  }
</script>

<Positionable
  {positionable}
  data-id={$positionable.id}
  class="card {$positionable.id}"
  contained={false}
  bind:el
>
  <Resizable {positionable} direction="top-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="top-left" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-right" {minSize} {maxSize} />
  <Resizable {positionable} direction="bottom-left" {minSize} {maxSize} />

  <Draggable {positionable} class="">
    <div class="top-bar">
      <button
        class="nav-button"
        on:click={webview?.goBack}
        disabled={!$canGoBack}
      >
        ←
      </button>
      <button
        class="nav-button"
        on:click={webview?.goForward}
        disabled={!$canGoForward}
      >
        →
      </button>
      <button class="nav-button" on:click={webview?.reload}> ↻ </button>
      <input
        type="text"
        class="address-bar"
        bind:value={$positionable.data.src}
        on:keyup={(e) => {
          if (e.key === "Enter") {
            $positionable.data.src =
              "https://" +
              $positionable.data.src
                .replace("https://", "")
                .replace("http://", "");
            webview?.navigate($positionable.data.src);
          }
        }}
      />
      <div class="page-title">{$title}</div>
    </div>
  </Draggable>

  <div class="content tela-ignore">
    <WebviewWrapper
      bind:this={webview}
      src={initialSrc}
      partition="persist:horizon"
    />
  </div>
</Positionable>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    background-color: #f5f5f5;
    padding: 8px;
    border-bottom: 1px solid #ddd;
  }

  .nav-button {
    background-color: #e0e0e0;
    border: none;
    padding: 6px 12px;
    margin-right: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .nav-button:disabled {
    background-color: #cccccc;
    cursor: default;
  }

  .nav-button:hover:enabled {
    background-color: #d5d5d5;
  }

  .address-bar {
    flex-grow: 1;
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin: 0 12px;
  }

  .page-title {
    margin-left: auto;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
