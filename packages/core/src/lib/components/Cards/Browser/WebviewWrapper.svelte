<script lang="ts" context="module">
  export type WebViewWrapperEvents = {
    wheelWebview: any
    didFinishLoad: void
    focusWebview: any
    newWindowWebview: Electron.HandlerDetails
    keyupWebview: WebViewSendEvents[WebViewEventSendNames.KeyUp]
    keydownWebview: WebViewSendEvents[WebViewEventSendNames.KeyDown]
    foundInPage: Electron.FoundInPageEvent
    selectionWebview: { text: string }
    detectedApp: DetectedWebApp
    detectedResource: WebViewSendEvents[WebViewEventSendNames.DetectedResource]
    actionOutput: { id: string; output: DetectedResource }
    navigation: { url: string; oldUrl: string }
    bookmark: WebViewSendEvents[WebViewEventSendNames.Bookmark]
    transform: WebViewSendEvents[WebViewEventSendNames.Transform]
    inlineTextReplace: WebViewSendEvents[WebViewEventSendNames.InlineTextReplace]
    annotate: WebViewSendEvents[WebViewEventSendNames.Annotate]
    annotationClick: WebViewSendEvents[WebViewEventSendNames.AnnotationClick]
    annotationRemove: WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
  }
</script>

<script lang="ts">
  import { writable, get } from 'svelte/store'
  import type { WebviewTag } from 'electron'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import type { HistoryEntriesManager } from '../../../service/history'
  import type { HistoryEntry } from '../../../types/index'
  import { useLogScope } from '../../../utils/log'
  import type {
    DetectedResource,
    DetectedWebApp,
    WebServiceActionInputs
  } from '@horizon/web-parser'
  import {
    WebViewEventReceiveNames,
    WebViewEventSendNames,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'

  const dispatch = createEventDispatcher<WebViewWrapperEvents>()
  const log = useLogScope('WebviewWrapper')

  export let src: string
  export let partition: string
  export let historyEntriesManager: HistoryEntriesManager

  export const url = writable(src)
  export const canGoBack = writable(false)
  export const canGoForward = writable(false)
  export const isLoading = writable(false)
  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const playback = writable(false)
  export const isMuted = writable(false)
  export const didFinishLoad = writable(false)

  export const historyStackIds = writable<string[]>([])
  export const currentHistoryIndex = writable(-1)
  let programmaticNavigation = false
  let newWindowHandlerRegistered = false
  let webviewWebContentsId: number | null = null
  let initialLoadDone = src == ''
  let pendingUrlUpdate: { url: string; timestamp: number } | null = null

  let webview: WebviewTag

  const updateNavigationState = () => {
    canGoBack.set(get(currentHistoryIndex) > 0)
    canGoForward.set(get(currentHistoryIndex) < (get(historyStackIds)?.length ?? 0) - 1)
  }

  const handleRedirectNav = (newUrl: string) => {
    log.debug('Handling redirect to', newUrl)
    historyStackIds.update((stack) => {
      const index = get(currentHistoryIndex)
      if (index >= 0 && index < stack.length) {
        stack[index] = newUrl
      }
      return stack
    })
    updateNavigationState()

    programmaticNavigation = true
    url.set(newUrl)
  }

  const addHistoryEntry = async (newUrl: string, pageTitle: string) => {
    log.debug('Adding history entry', newUrl)
    // This check prevents the initial load from being added to history
    // if (!initialLoadDone) {
    //   initialLoadDone = true
    //   return
    // }
    if (programmaticNavigation) {
      log.debug('Programmatic navigation, skipping history entry')
      programmaticNavigation = false
      return
    }

    try {
      const oldEntry = historyEntriesManager.getEntry($historyStackIds[$currentHistoryIndex])

      const entry: HistoryEntry = await historyEntriesManager.addEntry({
        type: 'navigation',
        url: newUrl,
        title: pageTitle
      } as HistoryEntry)

      historyStackIds.update((stack) => {
        let index = get(currentHistoryIndex)
        if (index < stack.length - 1) {
          stack = stack.slice(0, index + 1)
        }
        stack.push(entry.id)
        return stack
      })

      currentHistoryIndex.update((n) => n + 1)
      updateNavigationState()
      dispatch('navigation', { url: newUrl, oldUrl: oldEntry?.url || src })
    } catch (error) {}

    programmaticNavigation = false
  }

  $: webview, updateNavigationState()
  // $: {
  //   if (
  //     webview &&
  //     !programmaticNavigation &&
  //     initialLoadDone &&
  //     $url !== '' &&
  //     // TODO: extract this into a store of its own
  //     $url !== historyEntriesManager.getEntry(get(historyStackIds)[get(currentHistoryIndex)])?.url
  //   ) {
  //     historyEntriesManager
  //       .addEntry({ type: 'navigation', url: $url, title: 'TEST' } as HistoryEntry)
  //       .then((entry: HistoryEntry) => {
  //         historyStackIds.update((stack) => {
  //           let index = get(currentHistoryIndex)
  //           if (index < stack.length - 1) {
  //             stack = stack.slice(0, index + 1)
  //           }
  //           stack.push(entry.id)
  //           return stack
  //         })
  //         currentHistoryIndex.update((n) => n + 1)
  //         updateNavigationState()
  //       })
  //   }

  //   programmaticNavigation = false
  // }

  onMount(() => {
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return

      const eventType = event.args[0] as keyof WebViewSendEvents
      const eventData = event.args[1] as WebViewSendEvents[keyof WebViewSendEvents] // TODO: improve this so conversion below is not needed

      switch (eventType) {
        case WebViewEventSendNames.Wheel:
          dispatch('wheelWebview', eventData)
          break
        case WebViewEventSendNames.Focus:
          dispatch('focusWebview', eventData)
          break
        case WebViewEventSendNames.KeyUp:
          dispatch('keyupWebview', eventData as WebViewSendEvents[WebViewEventSendNames.KeyUp])
          break
        case WebViewEventSendNames.KeyDown:
          dispatch('keydownWebview', eventData as WebViewSendEvents[WebViewEventSendNames.KeyDown])
          break
        case WebViewEventSendNames.DetectedApp:
          dispatch('detectedApp', eventData as WebViewSendEvents[WebViewEventSendNames.DetectedApp])
          break
        case WebViewEventSendNames.InsertText:
          log.debug('Inserting text into webview', eventData)
          webview.insertText(eventData as WebViewSendEvents[WebViewEventSendNames.InsertText])
          break
        case WebViewEventSendNames.Bookmark:
          dispatch('bookmark', eventData as WebViewSendEvents[WebViewEventSendNames.Bookmark])
          break
        case WebViewEventSendNames.Transform:
          dispatch('transform', eventData as WebViewSendEvents[WebViewEventSendNames.Transform])
          break
        case WebViewEventSendNames.InlineTextReplace:
          dispatch(
            'inlineTextReplace',
            eventData as WebViewSendEvents[WebViewEventSendNames.InlineTextReplace]
          )
          break
        case WebViewEventSendNames.Annotate:
          dispatch('annotate', eventData as WebViewSendEvents[WebViewEventSendNames.Annotate])
          break
        case WebViewEventSendNames.AnnotationClick:
          dispatch(
            'annotationClick',
            eventData as WebViewSendEvents[WebViewEventSendNames.AnnotationClick]
          )
          break
        case WebViewEventSendNames.RemoveAnnotation:
          dispatch(
            'annotationRemove',
            eventData as WebViewSendEvents[WebViewEventSendNames.RemoveAnnotation]
          )
          break
        case WebViewEventSendNames.DetectedResource:
          dispatch(
            'detectedResource',
            eventData as WebViewSendEvents[WebViewEventSendNames.DetectedResource]
          )
          break
      }
    })

    webview.addEventListener('dom-ready', (_) => {
      webviewWebContentsId = webview.getWebContentsId()

      if (!newWindowHandlerRegistered) {
        // @ts-expect-error
        window.api.registerNewWindowHandler(
          webviewWebContentsId,
          (data: Electron.HandlerDetails) => {
            dispatch('newWindowWebview', data)
          }
        )

        newWindowHandlerRegistered = true
      }
    })

    webview.addEventListener('did-navigate', (e: any) => {
      log.debug('did navigate', e.url)
      url.set(e.url)
      pendingUrlUpdate = { url: e.url, timestamp: Date.now() }
    })

    webview.addEventListener('did-navigate-in-page', (e: any) => {
      log.debug('did navigate in page', e.url)
      if (e.isMainFrame) {
        url.set(e.url)

        // HOTFIX: Resolve later
        if (e.url.hostname !== 'notion.so') {
          pendingUrlUpdate = { url: e.url, timestamp: Date.now() }
        }
      }
    })

    webview.addEventListener('did-redirect-navigation', (event) => {
      log.debug('did redirect navigation')
      if (event.isMainFrame && event.isInPlace) handleRedirectNav(event.url)
    })
    webview.addEventListener('did-start-loading', () => isLoading.set(true))
    webview.addEventListener('did-stop-loading', () => isLoading.set(false))
    webview.addEventListener('page-title-updated', (e: any) => {
      log.debug('Page title updated', e.title)
      title.set(e.title)
      if (pendingUrlUpdate) {
        addHistoryEntry(pendingUrlUpdate.url, e.title)
        pendingUrlUpdate = null
      }
    })

    webview.addEventListener('did-finish-load', () => {
      dispatch('didFinishLoad')
      didFinishLoad.set(true)
    })
    webview.addEventListener('page-favicon-updated', (e: any) => {
      // Get the biggest favicon (last favicon in array)
      faviconURL.set(e.favicons[e.favicons.length - 1])
    })

    webview.addEventListener('media-started-playing', (e: any) => {
      playback.set(true)
    })

    webview.addEventListener('media-paused', (e: any) => {
      playback.set(false)
    })

    webview.addEventListener('found-in-page', (e: Electron.FoundInPageEvent) => {
      dispatch('foundInPage', e)
    })
  })

  onDestroy(() => {
    if (newWindowHandlerRegistered && webviewWebContentsId !== null) {
      // @ts-expect-error
      window.api.unregisterNewWindowHandler(webviewWebContentsId)
    }
  })

  export async function navigate(targetUrl: string): Promise<void> {
    try {
      log.debug('Navigating to', targetUrl)
      if (webview) {
        await webview.loadURL(targetUrl)
        // webview.src = targetUrl
      }
    } catch (error) {
      log.error('Error navigating', error)
    }
  }

  export function reload(): void {
    log.debug('Reloading')
    webview?.reload()
  }

  export function setMute(isMuted: boolean): void {
    webview?.setAudioMuted(isMuted)
  }

  export function goBack(): void {
    log.debug('Going back')
    currentHistoryIndex.update((n) => {
      if (n > 0) {
        n--
        programmaticNavigation = true
        const historyEntry = historyEntriesManager.getEntry(get(historyStackIds)[n])
        if (historyEntry) {
          navigate(historyEntry.url as string)
        }
        return n
      }
      return n
    })
    updateNavigationState()
  }

  export function goForward(): void {
    log.debug('Going forward')
    currentHistoryIndex.update((n) => {
      const stack = get(historyStackIds)
      if (n < stack.length - 1) {
        n++
        programmaticNavigation = true
        const historyEntry = historyEntriesManager.getEntry(get(historyStackIds)[n])
        if (historyEntry) {
          navigate(historyEntry.url as string)
        }
        return n
      }
      return n
    })
    updateNavigationState()
  }

  export function goToBeginning(fallback?: string): void {
    log.debug('Going to beginning')
    currentHistoryIndex.update((n) => {
      n = 0
      programmaticNavigation = true
      const historyEntry = historyEntriesManager.getEntry(get(historyStackIds)[0])
      if (historyEntry) {
        navigate(historyEntry.url as string)
      } else if (fallback) {
        navigate(fallback)
      }

      return n
    })
    updateNavigationState()
  }

  export function findInPage(text: string, options?: Electron.FindInPageOptions) {
    return webview?.findInPage(text, options)
  }

  export function stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection') {
    return webview?.stopFindInPage(action)
  }

  export function subscribeFindInPageResult(callback: (event: Electron.FoundInPageEvent) => void) {
    webview?.addEventListener('found-in-page', callback)

    return () => {
      webview?.removeEventListener('found-in-page', callback)
    }
  }

  export function sendEvent<T extends keyof WebViewReceiveEvents>(
    name: T,
    data?: WebViewReceiveEvents[T]
  ): void {
    log.debug('Sending event', name, data)
    webview?.send('webview-event', { type: name, data })
  }

  export function getSelection() {
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
      // webview.send('webview-event', { type: 'get-selection' })
    })
  }

  export function startResourceDetection() {
    // webview.send('webview-event', { type: 'get-resource' })
    sendEvent(WebViewEventReceiveNames.GetResource)
  }

  export function detectResource(timeoutNum = 10000) {
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

      timeout = setTimeout(() => {
        webview.removeEventListener('ipc-message', handleEvent)
        resolve(null)
      }, timeoutNum)

      webview.addEventListener('ipc-message', handleEvent)
      // webview.send('webview-event', { type: 'get-resource' })
      sendEvent(WebViewEventReceiveNames.GetResource)
    })
  }

  export function runAction(id: string, inputs: WebServiceActionInputs, timeoutNum = 10000) {
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

  export function startAppDetection() {
    // webview.send('webview-event', { type: 'get-app' })
    sendEvent(WebViewEventReceiveNames.GetApp)
  }

  export function openDevTools(): void {
    webview?.openDevTools()
  }

  export function executeJavaScript(code: string, userGesture = false) {
    return webview?.executeJavaScript(code, userGesture)
  }

  export function handleTransformationOutput(text: string) {
    // webview.send('webview-event', { type: 'get-resource' })
    sendEvent(WebViewEventReceiveNames.TransformationOutput, { text })
  }
</script>

<webview
  bind:this={webview}
  {src}
  {partition}
  useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  preload={`file://${window.api.webviewPreloadPath}`}
  webpreferences="autoplayPolicy=user-gesture-required,defaultFontSize=14"
  allowpopups
/>

<style>
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
    background: white;
  }
</style>
