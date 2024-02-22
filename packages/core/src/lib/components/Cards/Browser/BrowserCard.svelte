<!-- <svelte:options immutable={true} /> -->
<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Unsubscriber, type Writable } from 'svelte/store'

  import { fly } from 'svelte/transition'

  import WebviewWrapper, { type WebViewWrapperEvents } from './WebviewWrapper.svelte'
  import type { HistoryEntry, CardBrowser, CardEvents } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import { parseStringIntoUrl } from '../../../utils/url'
  import type { Horizon } from '../../../service/horizon'
  import browserBackground from '../../../../../public/assets/browser-background.png'
  import defaultFavicon from '../../../../../public/assets/deta.svg'

  import { Icon } from '@horizon/icons'

  import { isModKeyAndKeyPressed } from '../../../utils/keyboard'
  import FindInPage from './FindInPage.svelte'

  export let card: Writable<CardBrowser>
  export let horizon: Horizon
  export let active: boolean = false

  const adblockerState = horizon.adblockerState
  const historyEntriesManager = horizon.historyEntriesManager
  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('BrowserCard')

  let webview: WebviewWrapper | undefined
  let inputEl: HTMLInputElement
  let findInPage: FindInPage | undefined

  let initialSrc = $card.data.initialLocation
  if ($card.data.historyStackIds) {
    let currentEntry = historyEntriesManager.getEntry(
      $card.data.historyStackIds[$card.data.currentHistoryIndex]
    )
    // the historyStack will never have a history entry of type `search`
    if (currentEntry) initialSrc = currentEntry.url as string
  }

  const unsubTracker: Unsubscriber[] = []

  $: {
    $adblockerState
    try {
      webview?.reload()
    } catch (_) {}
  }

  onMount(() => {
    if (webview) {
      webview.historyStackIds.set($card.data.historyStackIds)
      webview.currentHistoryIndex.set($card.data.currentHistoryIndex)

      // TODO: no need to invoke two changes in most cases
      unsubTracker.push(
        webview.historyStackIds.subscribe((stack) => {
          $card.data.historyStackIds = stack
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

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key == 'Escape' && inputEl) {
        editing = false
        inputEl.blur()
      }
    })

    inputEl.addEventListener(`focus`, () => inputEl.select())
  })

  onDestroy(() => {
    unsubTracker.forEach((u) => u())
  })

  const handleToggleAdblock = async (_e: MouseEvent) => {
    horizon.adblockerState.set(!get(horizon.adblockerState))
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      let url = parseStringIntoUrl(value)
      if (!url) {
        const replacedSpaces = value.replace(/ /g, '+')
        const googleSearch = `https://google.com/search?q=${replacedSpaces}`
        url = new URL(googleSearch)

        const historyEntry = {
          type: 'search',
          searchQuery: value
        } as HistoryEntry
        historyEntriesManager.addEntry(historyEntry)
      }
      webview?.navigate(url.href)
      inputEl.blur()
    }
  }

  const handleWebviewFocus = (_e: MouseEvent) => {
    horizon.setActiveCard($card.id)
  }

  const handleFinishLoading = () => {
    log.debug('finished loading', get(card))
    dispatch('load', get(card))
  }

  const handleWebviewNewWindow = async (e: CustomEvent<Electron.HandlerDetails>) => {
    const disposition = e.detail.disposition
    if (disposition === 'new-window') return

    const newCardStore = await horizon.addCardBrowser(e.detail.url, {
      x: $card.x + $card.width + 30,
      y: $card.y,
      width: $card.width,
      height: $card.height
    })

    if (disposition === 'foreground-tab') {
      const newCard = get(newCardStore)
      horizon.scrollToCard(newCard)
      horizon.setActiveCard(newCard.id)
    }
  }

  const handleWebviewKeydown = async (e: CustomEvent<WebViewWrapperEvents['keydownWebview']>) => {
    const event = e.detail
    log.debug('keydown event', event)
    if (event.key === 'Escape') {
      if (findInPage?.isOpen()) {
        findInPage?.close()
      } else {
        horizon.activeCardId.set(null)
      }
    } else if (isModKeyAndKeyPressed(event as KeyboardEvent, 'f')) {
      log.debug('mod+f pressed')

      if (!findInPage || !webview) return

      if (findInPage.isOpen()) {
        const selection = await webview.getSelection()
        if (selection) {
          findInPage.find(selection)
        } else {
          findInPage.close()
        }
      } else {
        findInPage.open()
      }
    }
  }

  let value = ''
  let editing = false

  $: url = webview?.url
  $: title = webview?.title
  $: isLoading = webview?.isLoading
  $: didFinishLoad = webview?.didFinishLoad
  $: canGoBack = webview?.canGoBack
  $: canGoForward = webview?.canGoForward
  $: faviconURL = webview?.faviconURL
  $: playback = webview?.playback
  $: isMuted = webview?.isMuted

  $: if (!editing && $url !== 'about:blank') {
    value = $url ?? ''
  }
  $: if (active && inputEl && ($url == 'about:blank' || $url == '')) {
    inputEl.focus({ preventScroll: true })
  }
  $: if (!editing) {
    value = generateRootDomain(value)
  }
  $: if (editing) {
    value = $url ?? ''
  }

  function mute() {
    webview?.isMuted.set(true)
    webview?.setMute(true)
  }

  function unmute() {
    webview?.isMuted.set(false)
    webview?.setMute(false)
  }

  function generateRootDomain(urlInput: string | URL): string {
    if (!urlInput) {
      return ''
    }

    let url
    try {
      if (typeof urlInput === 'string') {
        if (/^https?:\/\/[^ "]+$/.test(urlInput)) {
          url = new URL(urlInput)
        } else {
          throw new Error('Invalid URL format')
        }
      } else {
        url = urlInput
      }

      const domain = url.hostname
      const elems = domain.split('.')
      if (elems.length < 2) {
        return ''
      }

      const iMax = elems.length - 1
      const elem1 = elems[iMax - 1]
      const elem2 = elems[iMax]
      const isSecondLevelDomain = iMax >= 3 && (elem1 + elem2).length <= 5

      return (isSecondLevelDomain ? elems[iMax - 2] + '.' : '') + elem1 + '.' + elem2
    } catch (error) {
      console.error('Error parsing URL:', error)
      return '' // or return some default error indication as needed
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="browser-card">
  {#if !$didFinishLoad}
    <img class="browser-background" src={browserBackground} alt={$title} />
  {/if}

  {#if webview}
    <FindInPage bind:this={findInPage} {webview} />
  {/if}

  <div class="browser-wrapper">
    <WebviewWrapper
      bind:this={webview}
      src={initialSrc}
      partition="persist:horizon"
      {historyEntriesManager}
      on:wheelWebview={(event) => log.debug('wheel event from the webview: ', event.detail)}
      on:focusWebview={handleWebviewFocus}
      on:newWindowWebview={handleWebviewNewWindow}
      on:keydownWebview={handleWebviewKeydown}
      on:didFinishLoad={handleFinishLoading}
    />
  </div>
  <div class="bottom-bar" class:active={active || value == ''}>
    <div class="bottom-bar-trigger">
      <div class="arrow-wrapper" class:hidden={!$canGoBack}>
        {#if $canGoBack}
          <button
            class="nav-button"
            on:click={webview?.goBack}
            disabled={!$canGoBack}
            in:fly={{ y: 10, duration: 160 }}
            out:fly={{ y: 10, duration: 160 }}
          >
            ←
          </button>
          <button
            class="nav-button"
            on:click={webview?.goForward}
            disabled={!$canGoForward}
            in:fly={{ y: 10, duration: 160 }}
            out:fly={{ y: 10, duration: 160 }}
          >
            →
          </button>
        {/if}
      </div>

      <div
        class="address-bar-wrapper"
        class:isEditing={editing}
        class:isActive={active}
        in:fly={{ x: -10, duration: 160 }}
        out:fly={{ x: -10, duration: 60 }}
      >
        <div class="navbar-wrapper">
          {#if !editing && active}
            <div class="adblock-wrapper">
              <div
                class="adblock"
                class:navigationActive={active}
                in:fly={{ y: 10, duration: 160 }}
              >
                <button class="nav-button btn-adblock" on:click={handleToggleAdblock}>
                  {#if $adblockerState}
                    <Icon name="adblockon" />
                  {:else}
                    <Icon name="adblockoff" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
          <input
            on:focus={() => (editing = true)}
            on:blur={() => (editing = false)}
            type="text"
            class="address-bar"
            class:isActive={active}
            placeholder="Enter URL or search term"
            bind:this={inputEl}
            bind:value
            on:keyup={handleKeyUp}
          />
          {#if active && value != ''}
            <button
              class="nav-button btn-reload"
              on:click={webview?.reload}
              in:fly={{ y: 10, duration: 160 }}
              out:fly={{ y: 10, duration: 60 }}
            >
              ↻
            </button>
          {/if}
        </div>
        <!-- <div class="page-title">{$title}</div> -->
      </div>

      <div class="mute-wrapper">
        {#if $playback}
          <div
            class="playback"
            class:navigationActive={active}
            in:fly={{ y: 4, duration: 160 }}
            out:fly={{ y: -4, duration: 160 }}
          >
            {#if $isMuted}
              <button class="nav-button btn-mute" on:click={unmute}> <Icon name="mute" /> </button>
            {:else}
              <button class="nav-button btn-mute" on:click={mute}> <Icon name="unmute" /> </button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="favicon-wrapper">
        {#if $didFinishLoad}
          <img
            in:fly={{ y: 10, duration: 500 }}
            out:fly={{ y: -10, duration: 500 }}
            class="bottom-bar-favicon"
            src={$faviconURL}
            alt={$title}
          />
        {:else}
          <img
            in:fly={{ y: 10, duration: 500 }}
            out:fly={{ y: -10, duration: 500 }}
            class="bottom-bar-favicon"
            src={defaultFavicon}
            alt={$title}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .browser-card {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    container-type: size;
    overflow: visible;
    will-change: auto;
  }

  .browser-wrapper {
    width: 100%;
    height: 100%;
  }

  .browser-background {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }

  .bottom-bar {
    position: relative;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background-color: #f7f7f8;
    backdrop-filter: blur(16px);
    padding: 4px;
    height: 3rem;
    overflow: hidden;
    border: 0.5px solid rgba(0, 0, 0, 0.05);
    transition: height 120ms cubic-bezier(0.22, 1, 0.36, 1);
    transition-delay: 80ms;
    will-change: auto;
    overflow: visible;
    box-shadow:
      0px 1px 3px 0px rgba(0, 0, 0, 0.05),
      0px 0px 0.5px 0px rgba(0, 0, 0, 0.2);
  }

  .bottom-bar-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .bottom-bar-favicon {
    width: 100%;
    height: 100%;
    max-width: 28px;
    max-height: 28px;
  }

  .favicon-wrapper {
    position: relative;
    margin: 4px;
    width: 32px;
    height: 32px;
    padding: 8px 22px 8px 12px;
    user-select: none;
  }

  .favicon-wrapper > img {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  }

  .arrow-wrapper {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.5rem 0 0.5rem;
    min-width: 5rem;
    user-select: none;
  }

  .mute-wrapper {
    min-width: 3rem;
    .playback {
      padding: 0;
      padding-right: 1rem;
    }
  }

  .adblock-wrapper {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 10;
    .btn-adblock {
      padding: 3px 7px 3px 7px;
    }
  }

  .nav-button {
    border: none;
    padding: 3px 7px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s;
    border-radius: 3px;
    background: none;
    color: #8a8a8a;
  }

  .nav-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .nav-button:hover:enabled {
    color: #e173a8;
  }

  .btn-reload {
    position: absolute;
    right: 0.5rem;
    top: 0;
    bottom: 0;
  }

  .btn-mute {
    position: relative;
    left: 0.5rem;
    top: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .navbar-wrapper {
    position: relative;
    display: flex;
    gap: 0.75rem;
    width: 70%;
    max-width: 40rem;
  }

  .address-bar-wrapper {
    position: relative;
    top: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 2rem;
    /* padding: 0 10% 0 calc(10% + 1.5rem); */
  }

  .address-bar {
    position: relative;
    display: inline-block;
    height: 100%;
    width: 100%;
    padding: 6px 2.25rem 6px 6px;
    border-radius: 4px;
    border: none;
    background: #ffffff;
    color: #212121;
    letter-spacing: 0.02rem;
    outline-offset: -2px;
    outline-style: hidden;
    text-align: center;
    transition:
      background 120ms ease-in,
      outline-offset 200ms cubic-bezier(0.33, 1, 0.68, 1);
    all: 200ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  .address-bar:focus {
    background: #fbeaf2;
    outline: 2px solid #e173a8;
    color: #000000;
    text-align: left;
    outline-offset: 2px;
    /* -webkit-mask-image: linear-gradient(to right, #000 95%, transparent 100%); */
  }

  .address-bar:hover {
    background: #ffdcee;
  }

  .address-bar-toolbar {
    position: absolute;
    bottom: 2.9rem;
    height: auto;
    width: calc(70% - 1rem);
    max-width: 40rem;
    background: rgba(255, 255, 255, 0.98);
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    box-shadow:
      0px 3px 4px 0px rgba(0, 0, 0, 0.13),
      0px 1px 2px 0px rgba(0, 0, 0, 0.1),
      0px 0px 0.5px 0px rgba(0, 0, 0, 0.12),
      0px 1px 3px 0px rgba(0, 0, 0, 0.2),
      0px 0px 1px 4px rgba(0, 0, 0, 0.01);
    outline: 2px solid white;
    border-radius: 8px;
  }

  .page-title {
    margin-left: auto;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
  }

  @container (max-width: 560px) {
    .address-bar-wrapper {
      padding: 0 0.25rem;
    }

    .address-bar-toolbar {
      position: fixed;
      left: 0.5rem;
      right: 0.5rem;
      width: calc(100% - 1rem);
      bottom: 3.5rem;
    }

    .arrow-wrapper {
      min-width: auto;
      width: auto;
      &.hidden {
        padding: 0;
      }
    }

    .navbar-wrapper {
      width: 100%;
    }

    .mute-wrapper {
      width: auto;
      min-width: auto;
    }

    .address-bar-toolbar {
      max-width: 100%;
    }
  }

  @container (max-width: 300px) {
    .adblock-wrapper {
      display: none;
    }

    .favicon-wrapper {
      display: none;
    }
  }
</style>
