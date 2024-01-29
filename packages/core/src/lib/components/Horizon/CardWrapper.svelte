<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Writable } from 'svelte/store'
  import type { Card } from '../../types'
  import { Draggable, Positionable, Resizable } from '@horizon/tela'
  import WebviewWrapper from './WebviewWrapper.svelte'
  import { useLogScope } from '../../utils/log'
  import { parseStringIntoUrl } from '../../utils/url'

  export let positionable: Writable<Card>
  const dispatch = createEventDispatcher<{ change: Card; load: void; delete: Card }>()
  const log = useLogScope('CardWrapper')

  const minSize = { x: 100, y: 100 }
  const maxSize = { x: Infinity, y: Infinity }
  const initialSrc = $positionable.data.src

  let value = ''
  let editing = false

  let inputEl: HTMLInputElement
  let el: HTMLElement
  let webview: WebviewWrapper | undefined

  const updateCard = () => {
    log.debug('updateCard', $positionable)
    dispatch('change', $positionable)
  }

  const handleDragEnd = (_: any) => {
    updateCard()
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      let url = parseStringIntoUrl(value)

      if (!url) {
        url = new URL(`https://google.com/search?q=${value}`)
      }

      value = url.href
      $positionable.data.src = value
      webview?.navigate(value)
      inputEl.blur()
    }
  }

  const handleDelete = () => {
    dispatch('delete', $positionable)
  }

  onMount(() => {
    // el.addEventListener('draggable_start', onDragStart)
    // el.addEventListener('draggable_move', onDragMove)
    el.addEventListener('draggable_end', handleDragEnd)
    el.addEventListener('resizable_end', updateCard)

    if (initialSrc === 'about:blank') {
      // inputEl?.focus()
    }

    let oldSrc = initialSrc
    positionable.subscribe((card) => {
      if (oldSrc !== card.data.src) {
        oldSrc = card.data.src
        updateCard()
      }
    })
  })

  onDestroy(() => {
    // el && el.addEventListener('draggable_start', onDragStart)
    // el && el.addEventListener('draggable_move', onDragMove)
    el && el.removeEventListener('draggable_end', handleDragEnd)
    el && el.removeEventListener('resizable_end', updateCard)
  })

  $: url = webview?.url
  $: title = webview?.title
  $: isLoading = webview?.isLoading
  $: canGoBack = webview?.canGoBack
  $: canGoForward = webview?.canGoForward
  $: $positionable.data.src = $url ?? $positionable.data.src

  $: if (!editing && $url !== 'about:blank' && $positionable.data.src !== 'about:blank') {
    value = $url ?? $positionable.data.src
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
      <button class="nav-button" on:click={handleDelete}> ✕ </button>
      <button class="nav-button" on:click={webview?.goBack} disabled={!$canGoBack}> ← </button>
      <button class="nav-button" on:click={webview?.goForward} disabled={!$canGoForward}>
        →
      </button>
      <button class="nav-button" on:click={webview?.reload}> ↻ </button>
      <input
        on:focus={() => (editing = true)}
        on:blur={() => (editing = false)}
        type="text"
        class="address-bar"
        placeholder="Enter URL or search term"
        bind:this={inputEl}
        bind:value
        on:keyup={handleKeyUp}
      />
      <div class="page-title">{$title}</div>
    </div>
  </Draggable>

  <div class="content tela-ignore">
    <WebviewWrapper
      bind:this={webview}
      src={initialSrc}
      partition="persist:horizon"
      on:didFinishLoad={() => dispatch('load')}
    />
  </div>
</Positionable>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background-color: #f5f5f5;
    padding: 8px;
    border-bottom: 1px solid #ddd;
    overflow: hidden;
  }

  .nav-button {
    background-color: #e0e0e0;
    border: none;
    padding: 6px 12px;
    margin-right: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
    border-radius: 3px;
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
    font-size: 0.9rem;
  }
</style>
