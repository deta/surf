<!-- <svelte:options immutable={true} /> -->
<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { get, type Unsubscriber, type Writable } from 'svelte/store'
  import { writable } from 'svelte/store'
  import { fly } from 'svelte/transition'

  import WebviewWrapper, { type WebViewWrapperEvents } from './WebviewWrapper.svelte'
  import {
    type HistoryEntry,
    type CardBrowser,
    type CardEvents,
    ResourceTypes,
    type ResourceDataArticle
  } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import {
    parseStringIntoUrl,
    generateRootDomain,
    checkIfUrl,
    prependProtocol
  } from '../../../utils/url'
  import type { Horizon } from '../../../service/horizon'
  import browserBackground from '../../../../../public/assets/browser-background.png'
  import defaultFavicon from '../../../../../public/assets/deta.svg'

  import AddressToolbar from './modules/toolbar/AddressToolbar.svelte'
  import BrowserHomescreen from './modules/homescreen/BrowserHomescreen.svelte'
  import { Icon } from '@horizon/icons'

  import { isModKeyAndKeyPressed } from '../../../utils/keyboard'
  import FindInPage from './FindInPage.svelte'
  import StackItem from '../../Stack/StackItem.svelte'
  import { wait } from '../../../utils/time'
  import { WebParser, type DetectedResource, type DetectedWebApp } from '@horizon/web-parser'
  import type { MagicFieldParticipant } from '../../../service/magicField'
  import { focusModeEnabled, exitFocusMode, enterFocusMode } from '../../../utils/focusMode'
  import { getServiceRanking, updateServiceRanking } from '../../../utils/services'
  import { visorEnabled } from '../../../utils/visor'

  export let card: Writable<CardBrowser>
  export let horizon: Horizon
  export let active: boolean = false
  export let magicFieldParticipant: MagicFieldParticipant | null = null

  const deactivateToolbar = writable(false)
  const bookmarkingInProgress = writable(false)

  const adblockerState = horizon.adblockerState
  const historyEntriesManager = horizon.historyEntriesManager
  const dispatch = createEventDispatcher<CardEvents>()
  const log = useLogScope('BrowserCard')

  let webview: WebviewWrapper | undefined
  let inputEl: HTMLInputElement
  let findInPage: FindInPage | undefined
  let currentCardHistory = writable()

  let initialSrc = $card.data.initialLocation
  $: if ($card.data.historyStackIds) {
    let currentEntry = historyEntriesManager.getEntry(
      $card.data.historyStackIds[$card.data.currentHistoryIndex]
    )

    let allEntries = $card.data.historyStackIds.map((item: any) => {
      return historyEntriesManager.getEntry(item)
    })

    currentCardHistory.set(allEntries)

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
          log.debug('history stack changed', stack)
          $card.data.historyStackIds = stack
          dispatch('change', get(card))
        })
      )
      unsubTracker.push(
        webview.currentHistoryIndex.subscribe((index) => {
          log.debug('current history index changed', index)
          $card.data.currentHistoryIndex = index
          dispatch('change', get(card))
        })
      )

      unsubTracker.push(webview.url.subscribe(handleUrlChange))
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

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      goToURL()
    }
  }

  const handleCallFromToolbar = () => {
    goToURL()
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
    if (event.key === 'Escape') {
      if (findInPage?.isOpen()) {
        findInPage?.close()
      } else {
        horizon.activeCardId.set(null)
      }
    } else if (event.altKey) {
      e.preventDefault()
      // NOTE: For demo launch only?
      let { viewOffset, viewPort } = get(horizon.board.state)
      viewOffset = get(viewOffset)
      viewPort = get(viewPort)
      if (event.key === 'ArrowLeft') {
        card.update((v) => {
          v.x = viewOffset.x
          v.y = 0
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h
          return v
        })
      } else if (event.key === 'ArrowRight') {
        card.update((v) => {
          v.x = viewOffset.x + viewPort.w / 2 + 5
          v.y = 0
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h
          return v
        })
      } else if (event.code === 'KeyU') {
        card.update((v) => {
          v.x = viewOffset.x
          v.y = 0
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h / 2 - 5
          return v
        })
      } else if (event.code === 'KeyI') {
        card.update((v) => {
          v.x = viewOffset.x + viewPort.w / 2 + 5
          v.y = 0
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h / 2 - 5
          return v
        })
      } else if (event.code === 'KeyJ') {
        card.update((v) => {
          v.x = viewOffset.x
          v.y = viewPort.h / 2 + 5
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h / 2 - 5
          return v
        })
      } else if (event.code === 'KeyK') {
        card.update((v) => {
          v.x = viewOffset.x + viewPort.w / 2 + 5
          v.y = viewPort.h / 2 + 5
          v.width = viewPort.w / 2 - 5
          v.height = viewPort.h / 2 - 5
          return v
        })
      } else if (event.code === 'Enter') {
        card.update((v) => {
          if (v.isMaximized === true) {
            v.x = v.maximizeBackup.x
            v.y = v.maximizeBackup.y
            v.width = v.maximizeBackup.width
            v.height = v.maximizeBackup.height
            v.isMaximized = undefined
            v.maximizeBackup = undefined
          } else {
            v.isMaximized = true
            v.maximizeBackup = { x: v.x, y: v.y, width: v.width, height: v.height }
            v.x = viewOffset.x
            v.y = 0
            v.width = viewPort.w
            v.height = viewPort.h
          }
          return v
        })
      }
    } else if (isModKeyAndKeyPressed(event as KeyboardEvent, 'f')) {
      /*else if (event.code === 'Space' && event.shiftKey) {
      if ($focusModeEnabled) {
        exitFocusMode(horizon.board)
      } else {
        // TODO: Make this work
        enterFocusMode([$card.id], horizon.board, horizon.cards)
      }
      // TODO: Catch OPT + TAB / SHIFT TAB to toggle between cards
    }*/
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
  $: isBookmarked = !!$card.resourceId

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

  $: console.log('value', value)

  function goToURL() {
    const isURL = checkIfUrl(value)
    if (isURL) {
      const url = prependProtocol(value, false)
      webview?.navigate(url)
      inputEl.blur()
      return
    }

    const url = parseStringIntoUrl(value)
    if (!url) return

    webview?.navigate(url.href)
    inputEl.blur()
  }

  function goHome() {
    webview?.goToBeginning($card.data.initialLocation)
  }

  function mute() {
    webview?.isMuted.set(true)
    webview?.setMute(true)
  }

  function unmute() {
    webview?.isMuted.set(false)
    webview?.setMute(false)
  }

  function handleFaviconClick() {
    log.debug('favicon clicked')
    const parsedUrl = parseStringIntoUrl($url ?? '')
    log.debug('parsed url', parsedUrl)
    if (!parsedUrl) return

    if (parsedUrl.pathname !== '/') {
      value = parsedUrl.origin
      goToURL()
    } else {
      webview?.reload()
    }
  }

  async function handleUrlChange(url: string) {
    log.debug('url changed', url)

    if (!$didFinishLoad) return

    // give the webview some time to load the page
    await wait(500)

    // TODO: do we need to run this on every url change? Since it is running in the webview and is only the lightweight detection it should be fine
    webview?.startAppDetection() // we will be notified when detection is done in handleDetectedApp
  }

  function removeResourceLinking() {
    log.debug('removing resource link')
    $card.resourceId = ''
    dispatch('change', $card)
  }

  async function handleBookmark() {
    try {
      if (value === '') return

      if (isBookmarked) {
        removeResourceLinking()
        return
      }

      log.debug('bookmarking', value)
      bookmarkingInProgress.set(true)

      const detectedResource = await webview?.detectResource()
      log.debug('extracted resource data', detectedResource)

      if (!detectedResource) {
        log.debug('no resource detected')
        return
      }

      const resource = await horizon.resourceManager.createResourceOther(
        new Blob([JSON.stringify(detectedResource.data)], { type: detectedResource.type }),
        { name: $title ?? '', sourceURI: $url, alt: '' }
      )

      log.debug('created resource', resource)

      card.update((card) => {
        card.resourceId = resource.id
        return card
      })

      dispatch('change', get(card))
    } catch (e) {
      log.error('error creating resource', e)
    } finally {
      bookmarkingInProgress.set(false)
    }
  }

  let app: DetectedWebApp | null = null
  function handleDetectedApp(e: CustomEvent<DetectedWebApp>) {
    const detecteApp = e.detail
    log.debug('detected app', detecteApp)
    if (!app) {
      log.debug('first app detection')
      app = detecteApp
      return
    }

    if (app.appId !== detecteApp.appId) {
      if (detecteApp.appId) {
        const currentRank = getServiceRanking(detecteApp.appId)
        console.warn('curr rank', detecteApp.appId, currentRank)
        updateServiceRanking(detecteApp.appId, currentRank + 1)
      }
    }

    if (
      app.appId === detecteApp.appId &&
      app.resourceType === detecteApp.resourceType &&
      app.appResourceIdentifier === detecteApp.appResourceIdentifier
    ) {
      log.debug('no change in app or resource', detecteApp)
      return
    }

    if (!!$card.resourceId) {
      removeResourceLinking()
    }

    app = detecteApp
  }

  function handleAddressDragStart(e: DragEvent) {
    if (!e.dataTransfer) {
      log.error('no data transfer')
      return
    }

    log.debug('dragging url', $url)

    const urlData = $url ?? ''

    e.dataTransfer.setData('text/uri-list', urlData)
    e.dataTransfer.setData('text/space-source', urlData)
  }

  onMount(() => {
    magicFieldParticipant?.onFieldEnter((field) => {
      if (!magicFieldParticipant) return
      if (!get(magicFieldParticipant.fieldParticipation)) return

      const isSupported = field.supportedResource === 'text/plain'

      magicFieldParticipant.fieldParticipation.update((p) => ({
        ...p!,
        supported: isSupported
      }))
    })

    magicFieldParticipant?.onRequestData(async (type: string, callback) => {
      log.debug('magic field requesting data', type)

      if (type === 'text/plain') {
        log.debug('detecting resource')
        const detectedResource = await webview?.detectResource()
        log.debug('bitch', detectedResource)
        if (!detectedResource) {
          log.debug('no resource detected')
          callback(null)
          return
        }

        log.debug('detectedResource', detectedResource)

        const resourceContent = WebParser.getResourceContent(
          detectedResource.type,
          detectedResource.data
        )
        if (!resourceContent.html && !resourceContent.plain) {
          log.debug('no content found in resource')
          callback(null)
          return
        }

        callback(resourceContent.html ?? resourceContent.plain)
      } else {
        callback(null)
      }
    })
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="browser-card">
  {#if $url == ''}
    <BrowserHomescreen {webview} {horizon} />
  {/if}
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
      on:focusWebview={handleWebviewFocus}
      on:newWindowWebview={handleWebviewNewWindow}
      on:keydownWebview={handleWebviewKeydown}
      on:didFinishLoad={handleFinishLoading}
      on:detectedApp={handleDetectedApp}
    />
  </div>
  <div
    class="bottom-bar"
    class:active={active || value == ''}
    style={$visorEnabled ? '' : 'pointer-events: auto;'}
  >
    <div class="bottom-bar-trigger">
      <div class="arrow-wrapper">
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
        <button
          class="nav-button icon-button"
          on:click={goHome}
          disabled={value === ''}
          in:fly={{ y: 10, duration: 160 }}
          out:fly={{ y: 10, duration: 160 }}
        >
          <Icon name="home" size="15px" />
        </button>
      </div>

      <div
        class="address-bar-wrapper"
        class:isEditing={editing}
        class:isActive={active}
        in:fly={{ x: -10, duration: 160 }}
        out:fly={{ x: -10, duration: 60 }}
      >
        {#if editing && value !== ''}
          <div
            class="address-bar-toolbar"
            class:isEditing={editing}
            class:deactivated={$deactivateToolbar}
            in:fly={{ y: 4, duration: 180, delay: 120 }}
            out:fly={{ y: 10, duration: 60 }}
          >
            <AddressToolbar
              bind:inputValue={value}
              cardHistory={$currentCardHistory}
              {horizon}
              on:call-url-from-toolbar={handleCallFromToolbar}
            />
          </div>
        {/if}
        <div class="navbar-wrapper" draggable="true" on:dragstart={handleAddressDragStart}>
          <input
            on:focus={() => (editing = true)}
            on:blur={() => {
              // hide toolbar until the callback performing the action is completed
              deactivateToolbar.set(true)
              setTimeout(() => {
                editing = false
                deactivateToolbar.set(false)
              }, 100)
            }}
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

      <div>
        <button
          class="nav-button icon-button"
          on:click={handleBookmark}
          in:fly={{ y: 10, duration: 160 }}
          out:fly={{ y: 10, duration: 160 }}
        >
          {#if $bookmarkingInProgress}
            <Icon name="spinner" size="15px" />
          {:else if isBookmarked}
            <Icon name="bookmarkFilled" size="15px" />
          {:else}
            <Icon name="bookmark" size="15px" />
          {/if}
        </button>
      </div>

      <div class="favicon-wrapper">
        {#if $didFinishLoad}
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <img
            in:fly={{ y: 10, duration: 500 }}
            out:fly={{ y: -10, duration: 500 }}
            class="bottom-bar-favicon"
            src={$faviconURL}
            alt={$title}
            on:click={handleFaviconClick}
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
    container-name: browsercard;
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
    background: radial-gradient(100% 100% at 52.74% 100%, #f2f2f2 0%, #f9f9f9 100%);
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
    cursor: pointer;
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
    align-items: center;
    gap: 0.5rem;
    padding: 0 1.5rem 0 0.5rem;
    min-width: 5rem;
    user-select: none;
  }

  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mute-wrapper {
    min-width: 3rem;
    .playback {
      padding: 0;
      padding-right: 1rem;
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
    background: radial-gradient(115% 115% at 50% 100%, #ffd3f0 0%, #ffdff4 100%);
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
    &.deactivated {
      opacity: 0;
    }
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
    .favicon-wrapper {
      display: none;
    }
  }
</style>
