<script lang="ts" context="module">
  export type WebviewNavigationEvent = { url: string; oldUrl: string }
  export type WebviewHistoryChangeEvent = {
    entries: Electron.NavigationEntry[]
    stack: string[]
    index: number
  }

  export type WebviewEvents = {
    'webview-page-event': {
      type: WebViewEventSendNames
      data: WebViewSendEvents[keyof WebViewSendEvents]
    }
    'new-window': NewWindowRequest
    'found-in-page': Electron.FoundInPageEvent
    'did-finish-load': void
    'update-target-url': string
    navigation: WebviewNavigationEvent
    'url-change': string
    'title-change': string
    'favicon-change': string
    'history-change': WebviewHistoryChangeEvent
    'media-playback-changed': boolean
  }
</script>

<script lang="ts">
  import type { WebviewTag } from 'electron'
  import { derived, writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { useConfig } from '../../service/config'
  import {
    WebContentsViewEventType,
    WebViewEventSendNames,
    type WebContentsViewEvents,
    type WebContentsViewEventTyped,
    type WebViewSendEvents
  } from '@horizon/types'

  import type { HistoryEntriesManager } from '../../service/history'
  import {
    useLogScope,
    useDebounce,
    parseUrlIntoCanonical,
    generateID,
    shouldIgnoreWebviewErrorCode,
    isPDFViewerURL,
    processFavicons,
    getHostname
  } from '@horizon/utils'
  import { type HistoryEntry } from '../../types'
  import { useResourceManager } from '../../service/resources'
  import { Dragcula, DragOperation, DragZone, HTMLDragZone } from '@horizon/dragcula'
  import type { WebviewError } from '../../constants/webviewErrors'
  import type { NewWindowRequest } from '../../service/ipc/events'
  import { useTabsManager } from '../../service/tabs'
  import WebContents from '@horizon/core/src/lib/components/Browser/WebContents.svelte'

  const config = useConfig()
  const userConfig = config.settings

  export let id: string = crypto.randomUUID().split('-').slice(0, 1).join('')
  export let src: string
  export let partition: string
  export let active: boolean = true
  export let historyEntriesManager: HistoryEntriesManager
  export let webContents: WebContents
  export let historyStackIds: Writable<string[]>
  export let navigationHistory: Writable<Electron.NavigationEntry[]>
  export let currentHistoryIndex: Writable<number>
  export let isLoading: Writable<boolean>
  export let error: Writable<WebviewError | null>
  export let url = writable(src)
  export let webviewReady = writable(false)
  export let acceptsDrags: boolean = false
  export let webContentsId = writable<number | null>(null)

  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const isMuted = writable(false)
  export const didFinishLoad = writable(false)

  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()

  const NAVIGATION_DEBOUNCE_TIME = 500

  const log = useLogScope('Webview')
  const dispatch = createEventDispatcher<WebviewEvents>()

  let newWindowHandlerRegistered = false
  let programmaticNavigation = false
  let lastReceivedFavicons: string[] = []
  let unsubscribeTheme: () => void
  let webContentsWrapper: HTMLDivElement | null = null
  let viewId: string | null = null

  $: cleanID = id.replace('webview-', '')

  const debouncedHistoryChange = useDebounce(
    (entries: Electron.NavigationEntry[], stack: string[], index: number) => {
      dispatch('history-change', { entries, stack, index })
    },
    100
  )

  const currentHistoryEntry = derived(
    [historyStackIds, currentHistoryIndex, navigationHistory],
    ([historyStackIds, currentHistoryIndex, navigationHistory]) => {
      debouncedHistoryChange(navigationHistory, historyStackIds, currentHistoryIndex)
      return historyEntriesManager.getEntry(historyStackIds[currentHistoryIndex])
    }
  )

  const updateUrl = (newUrl: string) => {
    url.set(newUrl)
    dispatch('url-change', newUrl)
  }

  const persistNavigationHistory = async () => {
    const result = await webContents.getNavigationHistory()

    navigationHistory.set(result.entries)
    currentHistoryIndex.set(result.index)
  }

  const addHistoryEntry = useDebounce(async (newUrl: string) => {
    try {
      const oldUrl = $currentHistoryEntry?.url
      const newCanonicalUrl = parseUrlIntoCanonical(newUrl) ?? newUrl

      if (oldUrl && parseUrlIntoCanonical(oldUrl) === newCanonicalUrl) {
        log.debug('did Skipping history entry for same URL')
        return
      }

      log.debug('did Adding history entry', newUrl, 'oldUrl', oldUrl)

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

      // currentHistoryIndex.update((n) => n + 1)
      dispatch('navigation', { url: newUrl, oldUrl: oldUrl || src })
    } catch (error) {
      log.error('Failed to add history entry', error)
    } finally {
      programmaticNavigation = false
    }
  }, NAVIGATION_DEBOUNCE_TIME)

  const handleNavigation = (newUrl: string) => {
    if (isPDFViewerURL(newUrl, window.api.PDFViewerEntryPoint)) {
      try {
        const urlParams = new URLSearchParams(new URL(newUrl).search)
        newUrl = decodeURIComponent(urlParams.get('path') || '') || newUrl
      } catch (err) {
        log.error('URL parsing error:', err)
      }
    }

    updateUrl(newUrl)

    if (programmaticNavigation) {
      log.debug('Programmatic navigation, skipping history entry')
      programmaticNavigation = false
      return
    }

    persistNavigationHistory()
    addHistoryEntry(newUrl)
  }

  const handleIpcMessage = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.IPC_MESSAGE]>
  ) => {
    const event = e.detail
    if (event.channel !== 'webview-page-event') return

    const eventType = event.args[0] as keyof WebViewSendEvents
    const eventData = event.args[1] as WebViewSendEvents[keyof WebViewSendEvents]

    // inserting text we can handle directly
    if (eventType === WebViewEventSendNames.InsertText) {
      log.debug('Inserting text into webview', eventData)
      webContents.insertText(eventData as WebViewSendEvents[WebViewEventSendNames.InsertText])
      return
    }

    // Handle passtrough events as we need to handle them differently
    if ([WebViewEventSendNames.MouseMove, WebViewEventSendNames.MouseUp].includes(eventType)) {
      let data = eventData as MouseEvent
      // We need to transform from webview relative to parent window relative
      const webviewBounds = webContents.getBoundingClientRect()
      let evtName = ''
      switch (eventType) {
        case WebViewEventSendNames.MouseMove:
          evtName = 'mousemove'
          break
        case WebViewEventSendNames.MouseUp:
          evtName = 'mouseup'
          break
      }

      window.dispatchEvent(
        new MouseEvent(evtName, {
          clientX: data.clientX + (webviewBounds?.left ?? 0),
          clientY: data.clientY + (webviewBounds?.top ?? 0),
          screenX: data.screenX,
          screenY: data.screenY,
          altKey: data.altKey,
          ctrlKey: data.ctrlKey,
          metaKey: data.metaKey,
          shiftKey: data.shiftKey,
          button: data.button
        })
      )
      return
    }

    // This re-dispatches the drag events from inside the webview onto the webview element itself
    // so, that dnd gets handled correctly
    if (eventType === WebViewEventSendNames.DragEnter) {
      const drag = Dragcula.get().activeDrag
      if (!drag) {
        // TODO: (dnd): Thsi isnt entirely correct. We actually need to bootstrap the drag differently,
        // as it was first dragged over the webview.
        // For now, we just return as this isnt fully there implementaiton wise.
        /*throw new Error(
          "No active drag, can't forward webview dragenter event! This should not happen!"
        )*/
        return
      }
      let data = eventData as DragEvent
      const e = new DragEvent('dragenter', {
        dataTransfer: data.dataTransfer,
        // @ts-ignore It actually exists...
        toElement: webview,
        fromElement: null,
        relatedTarget: null
      })
      webContentsWrapper?.dispatchEvent(e)
    } else if (eventType === WebViewEventSendNames.DragLeave) {
      const drag = Dragcula.get().activeDrag
      if (!drag)
        throw new Error(
          "No active drag, can't forward webview dragleave event! This should not happen!"
        )
      const e = new DragEvent('dragleave', {
        dataTransfer: drag?.dataTransfer,
        // @ts-ignore It actually exists...
        fromElement: null
      })
      webContentsWrapper?.dispatchEvent(e)
    } else if (eventType === WebViewEventSendNames.Drop) {
      // FIX: This is never dispatched inside webviw
      const drag = Dragcula.get().activeDrag
      if (!drag) {
        // TODO: (dnd): Thsi isnt entirely correct. We actually need to bootstrap the drag differently,
        // as it was first dragged over the webview.
        //throw new Error("No active drag, can't forward webview drop event! This should not happen!")
      }
      const e = new DragEvent('drop', {
        dataTransfer: drag?.dataTransfer ?? new DataTransfer()
      })
      webContentsWrapper?.dispatchEvent(e)
      const endevent = new DragEvent('dragend', {
        dataTransfer: drag?.dataTransfer ?? new DataTransfer(),
        bubbles: true
      })
      webContentsWrapper?.dispatchEvent(endevent)
    } else if (
      eventType === WebViewEventSendNames.Drag ||
      eventType === WebViewEventSendNames.DragOver
    ) {
      let data = eventData as DragEvent
      const webviewBounds = webContents.getBoundingClientRect()
      data.clientX += webviewBounds?.left ?? 0
      data.clientY += webviewBounds?.top ?? 0
      const e = new DragEvent('drag', {
        dataTransfer: data.dataTransfer,
        clientX: data.clientX,
        clientY: data.clientY,
        pageX: data.pageX,
        pageY: data.pageY,
        screenX: data.screenX,
        screenY: data.screenY,
        altKey: data.altKey,
        ctrlKey: data.ctrlKey,
        metaKey: data.metaKey,
        shiftKey: data.shiftKey,
        bubbles: true
      })

      let activeDrag = Dragcula.get().activeDrag
      if (activeDrag === null) {
        Dragcula.get().activeDrag = DragOperation.new({
          id: `__webview_drag_${generateID()}`,
          from: undefined,
          to: DragZone.ZONES.values().find(
            (x) => (x as HTMLDragZone).element === webContentsWrapper
          ),
          dataTransfer: data.dataTransfer ?? new DataTransfer(),
          item: undefined
        })
        activeDrag = Dragcula.get().activeDrag

        Dragcula.get().prepareDragOperation()
        Dragcula.get().callHandlers('dragstart', activeDrag)
      }

      webContentsWrapper?.dispatchEvent(e)
    }

    // check if valid event and if so pass it up
    if (Object.values(WebViewEventSendNames).includes(eventType)) {
      dispatch('webview-page-event', { type: eventType, data: eventData })
    } else {
      log.warn('Unknown webview page event', eventType, eventData)
    }
  }

  const handleDOMReady = () => {
    webviewReady.set(true)

    if (!newWindowHandlerRegistered && $webContentsId) {
      window.api.registerNewWindowHandler($webContentsId, (details) => {
        dispatch('new-window', details)
      })

      newWindowHandlerRegistered = true
    }
  }

  const handleDidStartLoading = () => {
    isLoading.set(true)
    error.set(null)
  }

  const handleDidStopLoading = () => isLoading.set(false)
  const handleDidFailLoading = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.DID_FAIL_LOAD]>
  ) => {
    const event = e.detail
    if (!event.isMainFrame) {
      return
    }

    log.debug('Failed to load', event.errorCode, event.errorDescription, event.validatedURL)

    // Ignore errors that are not related to the webview itself or don't need an error page to be shown
    if (shouldIgnoreWebviewErrorCode(event.errorCode)) {
      log.debug('Ignoring error code', event.errorCode)
      return
    }

    error.set({
      code: event.errorCode,
      description: event.errorDescription,
      url: event.validatedURL
    })
  }

  const handleDidFinishLoad = async () => {
    dispatch('did-finish-load')
    didFinishLoad.set(true)
    const url = await webContents.getURL()
    handleNavigation(url)
  }

  const handlePageTitleUpdated = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.PAGE_TITLE_UPDATED]>
  ) => {
    const newTitle = e.detail.title
    title.set(newTitle)
    dispatch('title-change', newTitle)

    if ($currentHistoryEntry) {
      historyEntriesManager.updateEntry($currentHistoryEntry.id, { title: newTitle })
    }
  }

  const handlePageFaviconUpdated = async (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.PAGE_FAVICON_UPDATED]>
  ) => {
    // Store the favicons for later theme changes
    lastReceivedFavicons = e.detail.favicons

    // Get the current URL's domain for caching
    const currentUrl = await webContents.getURL()
    const domain = getHostname(currentUrl) || ''

    if (!domain) {
      log.warn('Failed to parse URL for favicon domain', currentUrl)
    }

    // Use the favicon utility to get the best favicon
    const isDarkMode = $userConfig.app_style === 'dark'
    const bestFavicon = processFavicons(lastReceivedFavicons, domain, isDarkMode)

    // Update the favicon
    handleFaviconChange(bestFavicon)
  }

  const handleDidNavigate = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE]>
  ) => {
    const newUrl = e.detail.url
    log.debug('did navigate', e.url)

    if ($url === newUrl) {
      return
    }

    handleNavigation(newUrl)
  }

  const handleDidNavigateInPage = (
    e: CustomEvent<WebContentsViewEvents[WebContentsViewEventType.DID_NAVIGATE_IN_PAGE]>
  ) => {
    const event = e.detail
    if (!event.isMainFrame) return

    if ($url === event.url) {
      return
    }

    handleNavigation(event.url)
  }

  const handleFaviconChange = useDebounce(async (newFaviconURL: string) => {
    // NOTE: This is an expensive operation invoking main thread! Make sure it is debounced
    const url = await webContents.getURL()
    if (url) {
      if (isPDFViewerURL(url, window.api.PDFViewerEntryPoint)) return
    }

    if ($faviconURL === newFaviconURL) {
      return
    }

    faviconURL.set(newFaviconURL)
    dispatch('favicon-change', newFaviconURL)
  }, 250)

  const updateFaviconForTheme = async () => {
    if (lastReceivedFavicons.length === 0 || !webContents) return

    const currentUrl = await webContents.getURL()
    const domain = getHostname(currentUrl) || ''

    if (!domain) {
      log.warn('Failed to parse URL for favicon domain', currentUrl)
    }

    const isDarkMode = $userConfig.app_style === 'dark'
    const bestFavicon = processFavicons(lastReceivedFavicons, domain, isDarkMode)
    handleFaviconChange(bestFavicon)
  }

  onMount(() => {
    unsubscribeTheme = userConfig.subscribe(
      useDebounce(() => {
        updateFaviconForTheme()
      }, 500)
    )
  })

  onDestroy(() => {
    if (unsubscribeTheme) {
      unsubscribeTheme()
    }
  })

  /*
    INITIALIZATION
  */

  let unsub = []
  onMount(async () => {
    if (!newWindowHandlerRegistered && $webContentsId) {
      window.api.registerNewWindowHandler($webContentsId, (details) => {
        dispatch('new-window', details)
      })

      newWindowHandlerRegistered = true
    }
  })

  onDestroy(() => {
    if (newWindowHandlerRegistered && $webContentsId !== null) {
      window.api.unregisterNewWindowHandler($webContentsId)
    }
  })
</script>

<!-- <webview
  id={`webview-${id}`}
  bind:this={webview}
  {src}
  {partition}
  webpreferences="autoplayPolicy=document-user-activation-required,defaultFontSize=16,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true,scrollBounce=true"
  allowpopups
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (!acceptsDrags) return false
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE_ID) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        return true
      }
      return false
    }
  }}
  on:DragEnter={handleDragEnter}
  on:DragOver={handleDragOver}
  on:Drop={handleDrop}
  on:DragLeave={handleDragLeave}
  {...$$restProps}
/> -->

<!-- <div
  id="webcontentsview-container"
  bind:this={webContentsWrapper}
  style="width: 100%; height: 100%; background: white;"
></div> -->

<WebContents
  bind:this={webContents}
  bind:webContentsWrapper
  {id}
  {src}
  {partition}
  {navigationHistory}
  {currentHistoryIndex}
  {isLoading}
  {error}
  {url}
  {webviewReady}
  {acceptsDrags}
  {webContentsId}
  {active}
  on:dom-ready={handleDOMReady}
  on:did-start-loading={handleDidStartLoading}
  on:did-stop-loading={handleDidStopLoading}
  on:did-fail-load={handleDidFailLoading}
  on:did-finish-load={handleDidFinishLoad}
  on:page-title-updated={handlePageTitleUpdated}
  on:page-favicon-updated={handlePageFaviconUpdated}
  on:update-target-url={(e) => dispatch('update-target-url', e.detail.url)}
  on:did-navigate={handleDidNavigate}
  on:did-navigate-in-page={handleDidNavigateInPage}
  on:media-started-playing={() => dispatch('media-playback-changed', true)}
  on:media-paused={() => dispatch('media-playback-changed', false)}
  on:ipc-message={handleIpcMessage}
  on:found-in-page
  on:blur
  on:focus
  on:will-navigate
/>

<style lang="scss">
</style>
