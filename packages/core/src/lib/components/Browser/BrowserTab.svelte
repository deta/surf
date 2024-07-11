<script lang="ts" context="module">
  export type NewTabEvent = { url: string; active: boolean }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { type Unsubscriber } from 'svelte/store'
  import WebviewWrapper, { type WebViewWrapperEvents } from '../Cards/Browser/WebviewWrapper.svelte'
  import type { HistoryEntriesManager } from '../../service/history'
  import type { TabPage } from './types'
  import { useLogScope } from '../../utils/log'
  import type { DetectedWebApp } from '@horizon/web-parser'
  import type { WebViewEventKeyDown, WebViewReceiveEvents } from '@horizon/types'
  import FindInPage from '../Cards/Browser/FindInPage.svelte'
  import ZoomPreview from '../Cards/Browser/ZoomPreview.svelte'
  import { isModKeyAndKeyPressed } from '../../utils/keyboard'
  import { wait } from '@horizon/web-parser/src/utils'

  const log = useLogScope('BrowserTab')
  const dispatch = createEventDispatcher<{
    newTab: NewTabEvent
    appDetection: DetectedWebApp
    webviewKeydown: WebViewEventKeyDown
  }>()

  export let tab: TabPage
  export let webview: WebviewWrapper
  export let historyEntriesManager: HistoryEntriesManager

  const zoomLevel = writable<number>(1)
  const showZoomPreview = writable<boolean>(false)
  let zoomTimer: number
  let hasMounted = false

  let findInPage: FindInPage | undefined

  export const goBack = () => {
    if (webview) {
      webview.goBack()
    }
  }

  export const goForward = () => {
    if (webview) {
      webview.goForward()
    }
  }

  export const focus = () => {
    if (webview) {
      webview.focus()
    }
  }

  export const reload = () => {
    if (webview) {
      webview.reload()
    }
  }

  export const navigate = (url: string) => {
    if (webview) {
      webview.navigate(url)
    }
  }

  export const openDevTools = () => {
    if (webview) {
      webview.openDevTools()
    }
  }

  export const detectResource = (timeoutNum?: number) => {
    console.log('detectResource', webview)
    if (webview) {
      return webview.detectResource(timeoutNum)
    }
  }

  export const executeJavaScript = (code: string, userGesture?: boolean) => {
    console.log('executeJavaScript', code)
    if (webview) {
      return webview.executeJavaScript(code, userGesture)
    }
  }

  export const zoomIn = () => {
    if (webview) {
      zoomLevel.update((z) => {
        const newZoomLevel = z + 0.05
        webview.setZoomLevel(newZoomLevel)
        return newZoomLevel
      })
    }
  }

  export const zoomOut = () => {
    if (webview) {
      zoomLevel.update((z) => {
        const newZoomLevel = z - 0.05
        webview.setZoomLevel(newZoomLevel)
        return newZoomLevel
      })
    }
  }

  export const resetZoom = () => {
    if (webview) {
      zoomLevel.set(1)
      webview.setZoomLevel(1)
    }
  }

  export const sendWebviewEvent = <T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ): void => {
    if (webview) {
      webview.sendEvent(name, data)
    }
  }

  export const canGoBack = webview?.canGoBack
  export const canGoForward = webview?.canGoForward

  let src = tab.initialLocation

  $: if (tab.historyStackIds) {
    let currentEntry = historyEntriesManager.getEntry(tab.historyStackIds[tab.currentHistoryIndex])

    if (currentEntry) {
      src = currentEntry.url as string
    } else {
      console.log('currentEntry not found', tab.historyStackIds, tab.currentHistoryIndex)
      src = tab.initialLocation
    }
  }

  console.log('new tab', tab)

  const resetZoomTimer = () => {
    if (hasMounted) {
      showZoomPreview.set(true)
      if (zoomTimer) {
        clearTimeout(zoomTimer)
      }
      zoomTimer = window.setTimeout(() => {
        showZoomPreview.set(false)
      }, 3000)
    }
  }

  zoomLevel.subscribe(() => {
    resetZoomTimer()
  })

  const handleWebviewKeydown = async (e: CustomEvent<WebViewWrapperEvents['keydownWebview']>) => {
    const event = e.detail
    if (event.key === 'Escape') {
      if (findInPage?.isOpen()) {
        findInPage?.close()
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
    } else {
      dispatch('webviewKeydown', e.detail)
    }
  }

  const handleWebviewNewWindow = async (e: CustomEvent<Electron.HandlerDetails>) => {
    const disposition = e.detail.disposition
    if (disposition === 'new-window') return

    dispatch('newTab', { url: e.detail.url, active: disposition === 'foreground-tab' })
  }

  let app: DetectedWebApp | null = null
  function handleDetectedApp(e: CustomEvent<DetectedWebApp>) {
    const detectedApp = e.detail
    log.debug('detected app', detectedApp)
    if (!app) {
      log.debug('first app detection')
      app = detectedApp
      dispatch('appDetection', detectedApp)
      return
    }

    if (
      app.appId === detectedApp.appId &&
      app.resourceType === detectedApp.resourceType &&
      app.appResourceIdentifier === detectedApp.appResourceIdentifier
    ) {
      log.debug('no change in app or resource', detectedApp)
      dispatch('appDetection', detectedApp) // TODO: differentiate between fresh detection and no change
      return
    }

    app = detectedApp
    dispatch('appDetection', detectedApp)
  }

  const handleWebviewKeyDown = (e: CustomEvent<WebViewEventKeyDown>) => {
    dispatch('webviewKeydown', e.detail)
  }

  const unsubTracker: Unsubscriber[] = []
  onMount(() => {
    if (!webview) return
    hasMounted = true

    webview.historyStackIds.set(tab.historyStackIds)
    webview.currentHistoryIndex.set(tab.currentHistoryIndex)

    unsubTracker.push(
      webview.url.subscribe(async (_: string) => {
        await wait(500)
        webview.startAppDetection()
      })
    )

    unsubTracker.push(
      webview.historyStackIds.subscribe((stack) => {
        log.debug('history stack changed', stack)
        tab.historyStackIds = stack
      })
    )
    unsubTracker.push(
      webview.currentHistoryIndex.subscribe((index) => {
        log.debug('current history index changed', index)
        tab.currentHistoryIndex = index
      })
    )

    unsubTracker.push(
      webview.faviconURL.subscribe((faviconURL) => {
        if (!faviconURL) return

        tab = {
          ...tab,
          icon: faviconURL
        }
      })
    )

    unsubTracker.push(
      webview.title.subscribe((title) => {
        if (!title) return

        tab = {
          ...tab,
          title
        }
      })
    )
  })

  onDestroy(() => {
    unsubTracker.forEach((u) => u())
  })
</script>

{#if webview}
  <FindInPage bind:this={findInPage} {webview} />
{/if}

{#if webview}
  <ZoomPreview {zoomLevel} {showZoomPreview} />
{/if}

<WebviewWrapper
  bind:this={webview}
  {src}
  partition="persist:horizon"
  {historyEntriesManager}
  on:newWindowWebview={handleWebviewNewWindow}
  on:keydownWebview={handleWebviewKeyDown}
  on:navigation
  on:bookmark
  on:transform
  on:detectedApp={handleDetectedApp}
  on:inlineTextReplace
  on:annotate
  on:annotationClick
  on:annotationRemove
  on:annotationUpdate
  on:keydownWebview={handleWebviewKeydown}
/>
