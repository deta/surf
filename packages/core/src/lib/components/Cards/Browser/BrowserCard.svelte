<!-- <svelte:options immutable={true} /> -->
<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Unsubscriber, type Writable } from 'svelte/store'

  import { fade, fly } from 'svelte/transition';

  import WebviewWrapper from './WebviewWrapper.svelte'
  import type { CardBrowser, CardEvents } from '../../../types'
  import { useLogScope } from '../../../utils/log'
  import { parseStringIntoUrl } from '../../../utils/url'
  import Horizon from '../../Horizon/Horizon.svelte'
  import defaultFavicon from '../../../../../public/assets/deta.svg'


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

  const handleFinishLoading = () => {
    log.debug('finished loading', get(card))
    dispatch('load', get(card))
  }

  const handleWebviewNewWindow = (e: any) => {
    if (e.detail.disposition === 'new-window') return

    // TODO: edge case: can potentially be out of view
    horizon.addCardBrowser(e.detail.url, {
      x: $card.x + $card.width + 30,
      y: $card.y,
      width: $card.width,
      height: $card.height
    })
  }

  let value = ''
  let editing = true
  let showNavbar = false
  

  $: url = webview?.url
  $: title = webview?.title
  $: isLoading = webview?.isLoading
  $: didFinishLoad = webview?.didFinishLoad
  $: canGoBack = webview?.canGoBack
  $: canGoForward = webview?.canGoForward
  $: faviconURL = webview?.faviconURL

  $: if (!editing && $url !== 'about:blank') {
    value = $url ?? ''
  }

  $: if (!editing) {
    // Shortens URL from xyz.com/sss-www-www to xyz.com
    value = generateRootDomain(value)
  }

  $: if(editing) {
    value = $url ?? ''
  }

  // Opens the navbar when a new browser card is created
  $: if($url == 'about:blank' || $url == '') {
    showNavbar = true
  }

  function displayNavbar () {
    showNavbar = true
  }

  function disableNavbar () {
    // prevents navbar from being closed on intial card
    if($url == 'about:blank' || $url == '') {return}
    // ...also when the bar is focussed
    if(editing) {return}
    showNavbar = false
  }

  function generateRootDomain(urlInput: string | URL): string {
    if (!urlInput) {
        return ""; // Return empty string if input is falsy (empty, null, undefined, etc.)
    }

    let url;
    try {
        // If urlInput is a string, validate and parse it. Otherwise, use it directly.
        if (typeof urlInput === 'string') {
            // Basic validation to check if string resembles a URL
            if (/^https?:\/\/[^ "]+$/.test(urlInput)) {
                url = new URL(urlInput);
            } else {
                throw new Error("Invalid URL format");
            }
        } else {
            url = urlInput;
        }

        const domain = url.hostname;
        const elems = domain.split('.');
        if (elems.length < 2) {
            return ""; // Not enough domain parts
        }

        const iMax = elems.length - 1;
        const elem1 = elems[iMax - 1];
        const elem2 = elems[iMax];
        const isSecondLevelDomain = iMax >= 3 && (elem1 + elem2).length <= 5;

        return (isSecondLevelDomain ? elems[iMax - 2] + '.' : '') + elem1 + '.' + elem2;
    } catch (error) {
        console.error('Error parsing URL:', error);
        return ""; // or return some default error indication as needed
    }
}
</script>

<div class="browser-card">
  <div class="browser-wrapper">
    <WebviewWrapper
      bind:this={webview}
      src={initialSrc}
      partition="persist:horizon"
      on:wheelWebview={(event) => log.debug('wheel event from the webview: ', event.detail)}
      on:focusWebview={handleWebviewFocus}
      on:newWindowWebview={handleWebviewNewWindow}
      on:didFinishLoad={handleFinishLoading}
    />
  </div>
  <div class="bottom-bar">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="bottom-bar-trigger" on:mouseenter={displayNavbar} on:mouseleave={disableNavbar}>
        <div class="favicon-wrapper">
          {#if $didFinishLoad }
            <img in:fly={{ y: 10, duration: 500 }} out:fly={{ y: -10, duration: 500 }} class="bottom-bar-favicon" src={$faviconURL} alt={$title}/>
          {:else}
            <img in:fly={{ y: 10, duration: 500 }} out:fly={{ y: -10, duration: 500 }} class="bottom-bar-favicon" src={defaultFavicon} alt={$title}/>
          {/if}
        </div>
      
        {#if showNavbar}
        <div class="bottom-bar-collapse" in:fly={{ x: -10, duration: 160 }} out:fly={{ x: -10, duration: 60 }}>
          <button class="nav-button" on:click={webview?.goBack} disabled={!$canGoBack}> ← </button>
          <button class="nav-button" on:click={webview?.goForward} disabled={!$canGoForward}> → </button>
          <div class="address-bar-wrapper">
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
          </div>
          <button class="nav-button" on:click={webview?.reload}> ↻ </button>
          <!-- <div class="page-title">{$title}</div> -->
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .browser-card {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .browser-wrapper {
    width: 100%;
    height: 100%;
  }

  .bottom-bar {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background-color: rgba(255,255,255,0.8);
    backdrop-filter: blur(16px);
    padding: 4px;
    border-radius: 8px;
    overflow: hidden;
    border: 0.5px solid rgba(0,0,0, 0.05);
    box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.05), 0px 0px 0.5px 0px rgba(0, 0, 0, 0.20);
  }

  .bottom-bar-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bottom-bar-favicon {
      width: 60%;
      height: 60%;
      max-width: 32px;
      max-height: 32px;
  }

  .favicon-wrapper {
    position: relative;
    margin: 4px;
    width: 32px;
    height: 32px;
  }

  .favicon-wrapper > img {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%)
  }

  .bottom-bar-collapse {
    position: relative;
    margin-left: 8px;
    border-radius: 6px;
    padding: 4px;
    backdrop-filter: blur(2px);
    border: 0.5px solid rgba(0,0,0, 0.05)
  }

  .nav-button {
    border: none;
    padding: 6px 12px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s;
    border-radius: 3px;
    background: none;
    color: #E173A8;
  }

  .nav-button:disabled {
    opacity: .4;
    cursor: default;
  }

  .nav-button:hover:enabled {
    background: #F3D8F2;
  }

  .address-bar-wrapper { 
    position: relative;
    top: 0;
    display: inline-block;
  }


  .address-bar {
    position: relative;
    display: inline-block;
    top: -1.5px;
    height: 100%;
    width: 20rem;
    padding: 6px 0 6px 6px;
    border-radius: 4px;
    border: none;
    background: #ffffff;
    color: #212121;
    letter-spacing: 0.02rem;
    outline-offset: -2px;
    outline-style: hidden;
    transition: background 120ms ease-out, outline-offset 200ms cubic-bezier(.33, 1, .68, 1);
  }


  .address-bar:focus {
    background: #FBEAF2;
    outline: 2px solid #E173A8;
    outline-offset: 2px;
  }

  .address-bar:hover {
    background: #F3D8F2;
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
