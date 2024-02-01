<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Unsubscriber, type Writable } from 'svelte/store'

  import WebviewWrapper from './WebviewWrapper.svelte'
  import type { CardBrowser, CardEvents } from '../../../types'
  import { useLogScope } from '../../../utils/log'
  import { parseStringIntoUrl } from '../../../utils/url'
  import Horizon from '../../Horizon/Horizon.svelte'

  export let card: Writable<CardBrowser>
  export let horizon: Horizon

  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('BrowserCard')

  let webview: WebviewWrapper | undefined
  let inputEl: HTMLInputElement

  const initialSrc =
    $card.data.historyStack[$card.data.currentHistoryIndex] || $card.data.initialLocation
  const unsubTracker: Unsubscriber[] = []

  onMount(() => {
    if (webview) {
      webview.historyStack.set($card.data.historyStack)
      webview.currentHistoryIndex.set($card.data.currentHistoryIndex)

      // TODO: no need to invoke two changes in most cases
      unsubTracker.push(
        webview.historyStack.subscribe((stack) => {
          $card.data.historyStack = stack
          dispatch('change', get(card))
        })
      )
      unsubTracker.push(
        webview.currentHistoryIndex.subscribe((index) => {
          $card.data.currentHistoryIndex = index
          dispatch('change', get(card))
        })
      )
    }
  })

  onDestroy(() => {
    unsubTracker.forEach((u) => u())
  })

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      let url = parseStringIntoUrl(value)
      if (!url) url = new URL(`https://google.com/search?q=${value}`)
      webview?.navigate(url.href)
      inputEl.blur()
    }
  }

  const handleWebviewFocus = (e: MouseEvent) => {
    horizon.setActiveCard($card.id)
  }

  let value = ''
  let editing = false

  $: url = webview?.url
  $: title = webview?.title
  $: isLoading = webview?.isLoading
  $: canGoBack = webview?.canGoBack
  $: canGoForward = webview?.canGoForward

  $: if (!editing && $url !== 'about:blank') {
    value = $url ?? ''
  }

  const handleFinishLoading = () => {
    log.debug('finished loading', get(card))
    dispatch('load', get(card))
  }
</script>

<div class="browser-card">
  <div class="top-bar">
    <button class="nav-button" on:click={webview?.goBack} disabled={!$canGoBack}> ← </button>
    <button class="nav-button" on:click={webview?.goForward} disabled={!$canGoForward}> → </button>
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

  <div class="browser-wrapper">
    <WebviewWrapper
      bind:this={webview}
      src={initialSrc}
      partition="persist:horizon"
      on:wheelWebview={(event) => log.debug('wheel event from the webview: ', event.detail)}
      on:focusWebview={handleWebviewFocus}
      on:newWindowWebview={(event) => console.log('new window event: ', event.detail)}
      on:didFinishLoad={handleFinishLoading}
    />
  </div>
</div>

<style>
  .browser-card {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .browser-wrapper {
    width: 100%;
    height: 100%;
  }

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
