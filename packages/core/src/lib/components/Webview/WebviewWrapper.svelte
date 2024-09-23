<script lang="ts" context="module">
  export type WebviewWrapperEvents = {
    'webview-page-event': {
      type: WebViewEventSendNames
      data: WebViewSendEvents[keyof WebViewSendEvents]
    }
    'did-finish-load': void
    navigation: { url: string; oldUrl: string }
    'url-change': string
  }
</script>

<script lang="ts">
  import type { WebviewTag } from 'electron'
  import { derived, writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'

  import {
    CreateTabEventTrigger,
    WebViewEventReceiveNames,
    WebViewEventSendNames,
    type WebViewEventWheel,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'
  import { createHistorySwipeRecognizer, SWIPE_THRESHOLD } from '../../utils/historySwipeRecognizer'
  import type { HistoryEntriesManager } from '../../service/history'
  import { isModKeyAndKeyPressed, useLogScope } from '@horizon/utils'
  import type { DetectedResource } from '../../types'
  import type { WebServiceActionInputs } from '@horizon/web-parser'
  import Webview, { type WebviewEvents } from './Webview.svelte'
  import FindInPage from './FindInPage.svelte'
  import HistorySwipeOverlay from './HistorySwipeOverlay.svelte'
  import HoverLinkPreview from './HoverLinkPreview.svelte'
  import ZoomPreview from './ZoomPreview.svelte'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'
  import ErrorPage from './ErrorPage.svelte'
  import type { WebviewError } from '../../constants/webviewErrors'
  import { blur } from 'svelte/transition'
  import { useTabsManager } from '../../service/tabs'

  export let id: string | undefined
  export let src: string
  export let partition: string
  export let historyEntriesManager: HistoryEntriesManager
  export let url: Writable<string> | undefined = undefined
  export let historyStackIds = writable<string[]>([])
  export let currentHistoryIndex = writable(-1)

  export const canGoBack = derived(
    currentHistoryIndex,
    ($currentHistoryIndex) => $currentHistoryIndex > 0
  )
  export const canGoForward = derived(
    [currentHistoryIndex, historyStackIds],
    ([$currentHistoryIndex, $historyStackIds]) => $currentHistoryIndex < $historyStackIds.length - 1
  )
  export const isLoading = writable(false)
  export const error = writable<WebviewError | null>(null)

  const log = useLogScope('WebviewWrapper')
  const tabsManager = useTabsManager()
  const dispatch = createEventDispatcher<WebviewWrapperEvents>()

  const zoomLevel = writable<number>(1)
  const showZoomPreview = writable<boolean>(false)
  const webviewReady = writable<boolean>(false)

  let webview: WebviewTag
  let webviewComponent: Webview
  let findInPageComp: FindInPage
  let hoverTargetUrl: string
  let zoomTimer: number

  const { swipeDirection, swipeProgress, ...historySwipeRecognizer } = createHistorySwipeRecognizer(
    canGoBack,
    canGoForward,
    () => goForward(),
    () => goBack()
  )
  export const handleTrackpadScrollStart = historySwipeRecognizer.handleTrackpadScrollStart
  export const handleTrackpadScrollStop = historySwipeRecognizer.handleTrackpadScrollStop

  const handleWebviewWheel = (event: WebViewEventWheel) => historySwipeRecognizer.tick(event)

  const resetZoomTimer = () => {
    showZoomPreview.set(true)
    if (zoomTimer) {
      clearTimeout(zoomTimer)
    }
    zoomTimer = window.setTimeout(() => {
      showZoomPreview.set(false)
    }, 3000)
  }

  const startFindInPage = async () => {
    if (!findInPageComp) return

    if (findInPageComp.isOpen()) {
      const selection = await getSelection()
      if (selection) {
        findInPageComp.find(selection)
      } else {
        findInPageComp.close()
      }
    } else {
      findInPageComp.open()
    }
  }

  const handleWebviewKeydown = async (event: WebViewSendEvents[WebViewEventSendNames.KeyDown]) => {
    if (event.key === 'Escape' && findInPageComp?.isOpen()) {
      findInPageComp?.close()
    } else if (isModKeyAndKeyPressed(event as KeyboardEvent, 'f')) {
      log.debug('mod+f pressed')
      startFindInPage()
    }
  }

  const handleWebviewPageEvent = (event: CustomEvent<WebviewEvents['webview-page-event']>) => {
    const { type, data } = event.detail

    if (type === WebViewEventSendNames.KeyDown) {
      handleWebviewKeydown(data as WebViewSendEvents[WebViewEventSendNames.KeyDown])
    } else if (type === WebViewEventSendNames.Wheel) {
      handleWebviewWheel(data as WebViewSendEvents[WebViewEventSendNames.Wheel])
    }

    dispatch('webview-page-event', { type, data })
  }

  const handleWebviewNewWindow = async (e: CustomEvent<WebviewEvents['new-window']>) => {
    const disposition = e.detail.disposition
    if (disposition === 'new-window') return

    tabsManager.addPageTab(e.detail.url, {
      active: disposition === 'foreground-tab',
      trigger: CreateTabEventTrigger.Page
    })
  }

  const handleWebviewFoundInPage = (event: CustomEvent<Electron.FoundInPageEvent>) => {
    findInPageComp.handleFindResult(event.detail)
  }

  /*
    EXPORTED WEBVIEW UTILITY FUNCTIONS
  */
  export const focus = () => webview?.focus()
  export const reload = () => webview?.reload()
  export const forceReload = () => {
    error.set(null)
    webview?.reloadIgnoringCache()
  }
  export const setMute = (isMuted: boolean) => webview?.setAudioMuted(isMuted)
  export const setZoomLevel = (n: number) => webview?.setZoomFactor(n)
  export const openDevTools = () => webview?.openDevTools()
  export const findInPage = (text: string, opts?: Electron.FindInPageOptions) =>
    webview?.findInPage(text, opts)
  export const stopFindInPage = (action: 'clearSelection' | 'keepSelection') =>
    webview?.stopFindInPage(action)
  export const executeJavaScript = (code: string, userGesture = false) =>
    webview?.executeJavaScript(code, userGesture)
  export const goBack = () => webviewComponent.goBackInHistory()
  export const goForward = () => webviewComponent.goForwardInHistory()
  export const goToBeginning = (fallback?: string) =>
    webviewComponent.goToBeginningOfHistory(fallback)

  export const zoomIn = () => {
    if (webview) {
      zoomLevel.update((z) => {
        const newZoomLevel = z + 0.05
        setZoomLevel(newZoomLevel)
        return newZoomLevel
      })
    }
  }

  export const zoomOut = () => {
    if (webview) {
      zoomLevel.update((z) => {
        const newZoomLevel = z - 0.05
        setZoomLevel(newZoomLevel)
        return newZoomLevel
      })
    }
  }

  export const resetZoom = () => {
    if (webview) {
      zoomLevel.set(1)
      setZoomLevel(1)
    }
  }

  export const sendEvent = <T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ) => {
    webview?.send('webview-event', { type: name, data })
  }

  export const navigate = async (targetUrl: string) => {
    try {
      log.debug('Navigating to', targetUrl)
      await webview?.loadURL(targetUrl)
    } catch (error) {
      log.error('Error navigating', error)
    }
  }

  /*
    EXPORTED WEBVIEW IPC COMMS FUNCTIONS
  */
  export const getSelection = () => {
    return new Promise<string>((resolve) => {
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel !== 'webview-page-event') return

        const eventType = event.args[0] as WebViewEventSendNames
        const eventData = event.args[1] as WebViewSendEvents[WebViewEventSendNames]

        if (eventType === WebViewEventSendNames.Selection) {
          event.preventDefault()
          event.stopPropagation()
          resolve(eventData as WebViewSendEvents[WebViewEventSendNames.Selection])
        }
      })

      sendEvent(WebViewEventReceiveNames.GetSelection)
    })
  }

  export const startResourceDetection = () => {
    sendEvent(WebViewEventReceiveNames.GetResource)
  }

  export const detectResource = (timeoutNum = 10000) => {
    return new Promise<DetectedResource | null>((resolve) => {
      let timeout: any

      const handleEvent = (event: Electron.IpcMessageEvent) => {
        log.debug('Handling event while waiting for resource detection', event)
        if (event.channel !== 'webview-page-event') return

        const eventType = event.args[0] as WebViewEventSendNames
        const eventData = event.args[1] as WebViewSendEvents[WebViewEventSendNames]

        if (eventType === WebViewEventSendNames.DetectedResource) {
          event.preventDefault()
          event.stopPropagation()

          if (timeout) {
            clearTimeout(timeout)
          }

          webview.removeEventListener('ipc-message', handleEvent)
          resolve(eventData as WebViewSendEvents[WebViewEventSendNames.DetectedResource])
        }
      }

      const handleDidFinishLoad = () => {
        log.debug('webview finished loading, detecting resource')
        sendEvent(WebViewEventReceiveNames.GetResource)
      }

      timeout = setTimeout(() => {
        webview.removeEventListener('ipc-message', handleEvent)
        webview.removeEventListener('did-finish-load', handleDidFinishLoad)
        webview.removeEventListener('dom-ready', handleDidFinishLoad)
        resolve(null)
      }, timeoutNum)

      webview.addEventListener('ipc-message', handleEvent)

      if ($isLoading) {
        log.debug('waiting for webview to finish loading before detecting resource')
        webview.addEventListener('did-finish-load', handleDidFinishLoad)
      } else if (!$webviewReady) {
        log.debug('waiting for webview to be ready before detecting resource')
        webview.addEventListener('dom-ready', handleDidFinishLoad)
      } else {
        log.debug('webview is ready, detecting resource immediately')
        handleDidFinishLoad()
      }
    })
  }

  export const runAction = (id: string, inputs: WebServiceActionInputs, timeoutNum = 10000) => {
    log.debug('Running action', id, inputs)
    return new Promise<DetectedResource | null>((resolve) => {
      let timeout: any

      const handleEvent = (event: Electron.IpcMessageEvent) => {
        if (event.channel !== 'webview-page-event') return

        const eventType = event.args[0] as string
        const eventData = event.args[1]

        if (eventType === WebViewEventSendNames.ActionOutput && eventData.id === id) {
          event.preventDefault()
          event.stopPropagation()

          if (timeout) {
            clearTimeout(timeout)
          }

          webview.removeEventListener('ipc-message', handleEvent)
          resolve(eventData.output)
        }
      }

      timeout = setTimeout(() => {
        webview.removeEventListener('ipc-message', handleEvent)
        resolve(null)
      }, timeoutNum)

      webview.addEventListener('ipc-message', handleEvent)
      //webview.send('webview-event', { type: 'run-action', id, inputs })
      sendEvent(WebViewEventReceiveNames.RunAction, { id, inputs })
    })
  }

  export const startAppDetection = () => {
    sendEvent(WebViewEventReceiveNames.GetApp)
  }

  export const handleTransformationOutput = (text: string) => {
    sendEvent(WebViewEventReceiveNames.TransformationOutput, { text })
  }

  /*
    INITIALIZATION
  */
  onMount(() => {
    let initial = true
    const unsubZoom = zoomLevel.subscribe((_level) => {
      if (initial) {
        initial = false
        return
      }

      resetZoomTimer()
    })

    return () => {
      unsubZoom()
    }
  })
</script>

{#if webview}
  <FindInPage bind:this={findInPageComp} {webview} {getSelection} />
  <ZoomPreview {zoomLevel} {showZoomPreview} />
  <HoverLinkPreview show={!!hoverTargetUrl} url={hoverTargetUrl} />
{/if}

{#if $error}
  <ErrorPage error={$error} on:reload={() => forceReload()} />
{/if}

{#if webview && $isLoading === true}
  <div
    transition:blur={{ amount: 4, delay: 0.25 }}
    class="absolute top-2 flex w-full justify-center z-[1001] pointer-events-none"
  >
    <div
      class="left-0 h-[6px] animate-[border-width_0.7s_infinite_alternate] rounded-full bg-gradient-to-r from-sky-500/90 to-sky-500/90 via-sky-100/50 transition-all duration-100 ease-out shadow-2xl"
    />
  </div>
{/if}

<div class="webview-container">
  {#if $swipeDirection}
    <HistorySwipeOverlay
      direction={$swipeDirection}
      progress={$swipeProgress}
      threshold={SWIPE_THRESHOLD}
    />
  {/if}

  {#if webview}
    <FindInPage bind:this={findInPageComp} {webview} {getSelection} />
    <ZoomPreview {zoomLevel} {showZoomPreview} />
    <HoverLinkPreview show={!!hoverTargetUrl} url={hoverTargetUrl} />
  {/if}

  <Webview
    {id}
    {src}
    {partition}
    {historyEntriesManager}
    {historyStackIds}
    {currentHistoryIndex}
    {isLoading}
    {error}
    {url}
    {webviewReady}
    {...$$restProps}
    bind:webview
    bind:this={webviewComponent}
    on:webview-page-event={handleWebviewPageEvent}
    on:update-target-url={(e) => (hoverTargetUrl = e.detail)}
    on:new-window={handleWebviewNewWindow}
    on:found-in-page={handleWebviewFoundInPage}
    on:navigation
    on:did-finish-load
    on:url-change
    on:title-change
    on:favicon-change
    on:history-change
  />

  {#if $error}
    <div class="error-overlay">
      <ErrorPage error={$error} on:reload={() => forceReload()} />
    </div>
  {/if}
</div>

<style>
  .webview-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background-color: white;
  }
</style>
