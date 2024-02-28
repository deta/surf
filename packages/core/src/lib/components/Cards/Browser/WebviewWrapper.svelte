<script lang="ts" context="module">
  export type WebViewWrapperEvents = {
    wheelWebview: any
    didFinishLoad: void
    focusWebview: any
    newWindowWebview: Electron.HandlerDetails
    keyupWebview: { key: string }
    keydownWebview: { key: string; ctrlKey: boolean; shiftKey: boolean; metaKey: boolean }
    foundInPage: Electron.FoundInPageEvent
    selectionWebview: { text: string }
  }
</script>

<script lang="ts">
  import { writable, get } from 'svelte/store'
  import type { WebviewTag } from 'electron'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import type { HistoryEntriesManager } from '../../../service/horizon'
  import type { HistoryEntry } from '../../../types'
  import { useLogScope } from '../../../utils/log'

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
  export const faviconURL = writable<string[]>([])
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
  window.g = () => historyEntriesManager.entriesStore.subscribe((h) => console.log(h))
  window.h = () => historyStackIds.subscribe((h) => console.log(h))
  window.s = (q: string) => historyEntriesManager.searchEntries(q)

  const updateNavigationState = () => {
    canGoBack.set(get(currentHistoryIndex) > 0)
    canGoForward.set(get(currentHistoryIndex) < get(historyStackIds).length - 1)
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

  const addHistoryEntry = async (url: string, pageTitle: string) => {
    log.debug('Adding history entry', url)
    if (!initialLoadDone) {
      initialLoadDone = true
      return
    }
    if (programmaticNavigation) {
      log.debug('Programmatic navigation, skipping history entry')
      programmaticNavigation = false
      return
    }

    try {
      const entry: HistoryEntry = await historyEntriesManager.addEntry({
        type: 'navigation',
        url: url,
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
    console.log(get(historyEntriesManager.entriesStore))
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return

      const eventData = event.args[0]
      const eventType = eventData.type as string
      delete eventData.type

      switch (eventType) {
        case 'wheel':
          dispatch('wheelWebview', eventData)
          break
        case 'focus':
          dispatch('focusWebview', eventData)
          break
        case 'keyup':
          dispatch('keyupWebview', eventData)
          break
        case 'keydown':
          dispatch('keydownWebview', eventData)
          break
      }
    })

    webview.addEventListener('dom-ready', (_) => {
      webviewWebContentsId = webview.getWebContentsId()

      if (!newWindowHandlerRegistered) {
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
        if (!e.url.hostname === 'notion.so') {
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
      window.api.unregisterNewWindowHandler(webviewWebContentsId)
    }
  })

  export function navigate(targetUrl: string): void {
    log.debug('Navigating to', targetUrl)
    if (webview) {
      webview.src = targetUrl
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

  export function getSelection() {
    return new Promise<string>((resolve) => {
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel !== 'selection') return
        resolve(event.args[0])
      })

      webview.send('webview-event', { type: 'get-selection' })
    })
  }

  export function openDevTools(): void {
    webview?.openDevTools()
  }
</script>

<webview
  bind:this={webview}
  {src}
  {partition}
  preload={`file://${window.api.webviewPreloadPath}`}
  webpreferences="autoplayPolicy=user-gesture-required"
  allowpopups
/>

<style>
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
  }
</style>
