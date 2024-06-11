<script lang="ts" context="module">
  export type NewTabEvent = { url: string; active: boolean }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { derived, type Unsubscriber } from 'svelte/store'

  import WebviewWrapper from '../Cards/Browser/WebviewWrapper.svelte'
  import type { HistoryEntriesManager } from '../../service/history'
  import type { TabPage } from './types'
  import { useLogScope } from '../../utils/log'
  import type { DetectedWebApp } from '@horizon/web-parser'
  import type { WebViewReceiveEvents } from '@horizon/types'

  const log = useLogScope('BrowserTab')
  const dispatch = createEventDispatcher<{ newTab: NewTabEvent; appDetection: DetectedWebApp }>()

  export let tab: TabPage
  export let webview: WebviewWrapper
  export let historyEntriesManager: HistoryEntriesManager

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
    if (webview) {
      return webview.executeJavaScript(code, userGesture)
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

    let allEntries = tab.historyStackIds.map((item: any) => {
      return historyEntriesManager.getEntry(item)
    })

    // the historyStack will never have a history entry of type `search`
    if (currentEntry) {
      src = currentEntry.url as string
    } else {
      console.log('currentEntry not found', tab.historyStackIds, tab.currentHistoryIndex)
      src = tab.initialLocation
    }
  }

  console.log('new tab', tab)

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

  const unsubTracker: Unsubscriber[] = []
  onMount(() => {
    if (!webview) return

    webview.historyStackIds.set(tab.historyStackIds)
    webview.currentHistoryIndex.set(tab.currentHistoryIndex)

    // TODO: no need to invoke two changes in most cases
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

    // unsubTracker.push(
    //     webview.url.subscribe((url) => {
    //         if (!url) return

    //         // tab = {
    //         //     ...tab,
    //         //     location: url
    //         // }
    //     })
    // )
  })

  onDestroy(() => {
    unsubTracker.forEach((u) => u())
  })
</script>

<WebviewWrapper
  bind:this={webview}
  {src}
  partition="persist:horizon"
  {historyEntriesManager}
  on:newWindowWebview={handleWebviewNewWindow}
  on:navigation
  on:bookmark
  on:transform
  on:detectedApp={handleDetectedApp}
  on:inlineTextReplace
  on:highlight
/>
