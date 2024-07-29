<script lang="ts" context="module">
  export type WebviewNavigationEvent = { url: string; oldUrl: string }
  export type WebviewHistoryChangeEvent = { stack: string[]; index: number }

  export type WebviewEvents = {
    'webview-page-event': {
      type: WebViewEventSendNames
      data: WebViewSendEvents[keyof WebViewSendEvents]
    }
    'new-window': Electron.HandlerDetails
    'found-in-page': Electron.FoundInPageEvent
    'did-finish-load': void
    'update-target-url': string
    navigation: WebviewNavigationEvent
    'url-change': string
    'title-change': string
    'favicon-change': string
    'history-change': WebviewHistoryChangeEvent
  }
</script>

<script lang="ts">
  import type { WebviewTag } from 'electron'
  import { derived, writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import {
    WebViewEventSendNames,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'

  import type { HistoryEntriesManager } from '../../service/history'
  import { useLogScope } from '../../utils/log'
  import type { HistoryEntry } from '../../types'
  import { useDebounce } from '../../utils/debounce'

  export let src: string
  export let partition: string
  export let historyEntriesManager: HistoryEntriesManager
  export let webview: WebviewTag
  export let historyStackIds: Writable<string[]>
  export let currentHistoryIndex: Writable<number>
  export let isLoading: Writable<boolean>
  export let url = writable(src)

  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const playback = writable(false)
  export const isMuted = writable(false)
  export const didFinishLoad = writable(false)

  // @ts-ignore
  const PRELOAD_PATH = window.api.webviewPreloadPath

  const log = useLogScope('Webview')
  const dispatch = createEventDispatcher<WebviewEvents>()

  let newWindowHandlerRegistered = false
  let webviewWebContentsId: number | null = null
  let programmaticNavigation = false

  const debouncedHistoryChange = useDebounce((stack: string[], index: number) => {
    dispatch('history-change', { stack, index })
  }, 100)

  const currentHistoryEntry = derived(
    [historyStackIds, currentHistoryIndex],
    ([historyStackIds, currentHistoryIndex]) => {
      debouncedHistoryChange(historyStackIds, currentHistoryIndex)
      return historyEntriesManager.getEntry(historyStackIds[currentHistoryIndex])
    }
  )

  const updateUrl = (newUrl: string) => {
    url.set(newUrl)
    dispatch('url-change', newUrl)
  }

  const addHistoryEntry = async (newUrl: string) => {
    try {
      log.debug('Adding history entry', newUrl)
      const oldUrl = $currentHistoryEntry?.url

      if (oldUrl && oldUrl === newUrl) {
        log.debug('Skipping history entry for same URL')
        return
      }

      const entry: HistoryEntry = await historyEntriesManager.addEntry({
        type: 'navigation',
        url: newUrl,
        title: $title
      } as HistoryEntry)

      historyStackIds.update((stack) => {
        const index = $currentHistoryIndex

        // If we are not at the end of the stack, we need to truncate the stack
        if (index < stack.length - 1) {
          stack = stack.slice(0, index + 1)
        }

        return [...stack, entry.id]
      })

      currentHistoryIndex.update((n) => n + 1)
      dispatch('navigation', { url: newUrl, oldUrl: oldUrl || src })
    } catch (error) {
      log.error('Failed to add history entry', error)
    } finally {
      programmaticNavigation = false
    }
  }

  const handleRedirectNavigation = (newUrl: string) => {
    log.debug('Changing current location and history to', newUrl)
    historyStackIds.update((stack) => {
      const index = $currentHistoryIndex
      if (index >= 0 && index < stack.length) {
        stack[index] = newUrl
      }
      return stack
    })

    programmaticNavigation = true
    updateUrl(newUrl)
  }

  const handleNavigation = (newUrl: string) => {
    if (programmaticNavigation) {
      log.debug('Programmatic navigation, skipping history entry')
      programmaticNavigation = false
      return
    }

    updateUrl(newUrl)
    addHistoryEntry(newUrl)
  }

  const handleIpcMessage = (event: Electron.IpcMessageEvent) => {
    const eventType = event.args[0] as keyof WebViewSendEvents
    const eventData = event.args[1] as WebViewSendEvents[keyof WebViewSendEvents]

    // inserting text we can handle directly
    if (eventType === WebViewEventSendNames.InsertText) {
      log.debug('Inserting text into webview', eventData)
      webview.insertText(eventData as WebViewSendEvents[WebViewEventSendNames.InsertText])
      return
    }

    // check if valid event and if so pass it up
    if (Object.values(WebViewEventSendNames).includes(eventType)) {
      dispatch('webview-page-event', { type: eventType, data: eventData })
    } else {
      log.warn('Unknown webview page event', eventType, eventData)
    }
  }

  const handlePageTitleChange = (newTitle: string) => {
    title.set(newTitle)
    dispatch('title-change', newTitle)

    if ($currentHistoryEntry) {
      historyEntriesManager.updateEntry($currentHistoryEntry.id, { title: newTitle })
    }
  }

  const handleFaviconChange = (newFaviconURL: string) => {
    faviconURL.set(newFaviconURL)
    dispatch('favicon-change', newFaviconURL)
  }

  /*
    EXPORTED WEBVIEW UTILITY FUNCTIONS
  */
  export const navigate = async (targetUrl: string) => {
    try {
      log.debug('Navigating to', targetUrl)
      await webview?.loadURL(targetUrl)
    } catch (error) {
      log.error('Error navigating', error)
    }
  }

  export const goBackInHistory = () => {
    currentHistoryIndex.update((n) => {
      if (n > 0) {
        n--
        programmaticNavigation = true
        const historyEntry = historyEntriesManager.getEntry($historyStackIds[n])
        if (historyEntry) {
          navigate(historyEntry.url as string)
        }
        return n
      }
      return n
    })
  }

  export const goForwardInHistory = () => {
    currentHistoryIndex.update((n) => {
      const stack = $historyStackIds
      if (n < stack.length - 1) {
        n++
        programmaticNavigation = true
        const historyEntry = historyEntriesManager.getEntry($historyStackIds[n])
        if (historyEntry) {
          navigate(historyEntry.url as string)
        }

        return n
      }

      return n
    })
  }

  export const goToBeginningOfHistory = (fallback?: string) => {
    currentHistoryIndex.update((n) => {
      n = 0
      programmaticNavigation = true
      const historyEntry = historyEntriesManager.getEntry($historyStackIds[0])
      if (historyEntry) {
        navigate(historyEntry.url as string)
      } else if (fallback) {
        navigate(fallback)
      }

      return n
    })
  }

  /*
    INITIALIZATION
  */
  onMount(() => {
    /*
      Handle IPC event coming from the webview preload script (apps/desktop/src/preload/webview.ts)
    */
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel !== 'webview-page-event') return
      handleIpcMessage(event)
    })

    /*
      Register a window handler to handle creating new tabs from the webview
    */
    webview.addEventListener('dom-ready', (_) => {
      webviewWebContentsId = webview.getWebContentsId()

      if (!newWindowHandlerRegistered) {
        // @ts-expect-error
        window.api.registerNewWindowHandler(
          webviewWebContentsId,
          (data: Electron.HandlerDetails) => {
            dispatch('new-window', data)
          }
        )

        newWindowHandlerRegistered = true
      }
    })

    /*
      Handle loading events
    */
    webview.addEventListener('did-start-loading', () => isLoading.set(true))
    webview.addEventListener('did-stop-loading', () => isLoading.set(false))
    webview.addEventListener('did-finish-load', () => {
      dispatch('did-finish-load')
      didFinishLoad.set(true)
      handleNavigation(webview.getURL())
    })

    /*
      Handle media playback events
    */
    webview.addEventListener('media-started-playing', () => playback.set(true))
    webview.addEventListener('media-paused', () => playback.set(false))

    /*
      Handle page metadata events
    */
    webview.addEventListener('page-title-updated', (e: Electron.PageTitleUpdatedEvent) => {
      handlePageTitleChange(e.title)
    })
    webview.addEventListener('page-favicon-updated', (e: Electron.PageFaviconUpdatedEvent) => {
      handleFaviconChange(e.favicons[e.favicons.length - 1]) // Get the biggest favicon (last favicon in array)
    })
    webview.addEventListener('update-target-url', (e: Electron.UpdateTargetUrlEvent) => {
      dispatch('update-target-url', e.url)
    })

    /*
      Handle additional functionalities of the page
    */
    webview.addEventListener('found-in-page', (e: Electron.FoundInPageEvent) => {
      dispatch('found-in-page', e)
    })

    /*
      Handle navigation events
    */
    webview.addEventListener('did-navigate', (e: Electron.DidNavigateEvent) => {
      // log.debug('did navigate', e.url)

      if ($url === e.url) {
        // log.debug('Ignoring did-navigate event for same URL')
        return
      }

      handleNavigation(e.url)
    })

    webview.addEventListener('did-navigate-in-page', (e: Electron.DidNavigateInPageEvent) => {
      // log.debug('did navigate in page', e.url)
      if (!e.isMainFrame) return

      if ($url === e.url) {
        // log.debug('Ignoring did-navigate-in-page event for same URL')
        return
      }

      handleNavigation(e.url)
    })

    webview.addEventListener(
      'did-redirect-navigation',
      (e: Electron.DidRedirectNavigationEvent) => {
        // log.debug('did redirect navigation', e.url)
        if (!e.isMainFrame || !e.isInPlace) return

        handleRedirectNavigation(e.url)
      }
    )
  })

  onDestroy(() => {
    if (newWindowHandlerRegistered && webviewWebContentsId !== null) {
      // @ts-expect-error
      window.api.unregisterNewWindowHandler(webviewWebContentsId)
    }
  })
</script>

<webview
  bind:this={webview}
  {src}
  {partition}
  useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  preload={`file://${PRELOAD_PATH}`}
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
