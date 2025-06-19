<script lang="ts" context="module">
  export type WebviewNavigationEvent = { url: string; oldUrl: string }
  export type WebviewHistoryChangeEvent = { stack: string[]; index: number }

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
  import { ResourceTypes, WebViewEventSendNames, type WebViewSendEvents } from '@horizon/types'

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
  import { DragTypeNames, type HistoryEntry } from '../../types'
  import {
    useResourceManager,
    type ResourceAnnotation,
    type ResourceLink,
    type ResourceObject
  } from '../../service/resources'
  import type { TabPage } from '../../types/browser.types'
  import {
    Dragcula,
    DragOperation,
    DragZone,
    HTMLDragZone,
    type DragculaDragEvent
  } from '@horizon/dragcula'
  import type { WebviewError } from '../../constants/webviewErrors'
  import type { NewWindowRequest } from '../../service/ipc/events'

  const config = useConfig()
  const userConfig = config.settings

  export let id: string = crypto.randomUUID().split('-').slice(0, 1).join('')
  export let src: string
  export let partition: string
  export let historyEntriesManager: HistoryEntriesManager
  export let webview: WebviewTag
  export let historyStackIds: Writable<string[]>
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

  const NAVIGATION_DEBOUNCE_TIME = 500

  const log = useLogScope('Webview')
  const dispatch = createEventDispatcher<WebviewEvents>()

  let newWindowHandlerRegistered = false
  let programmaticNavigation = false
  let lastReceivedFavicons: string[] = []
  let unsubscribeTheme: () => void

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

      currentHistoryIndex.update((n) => n + 1)
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

    // Handle passtrough events as we need to handle them differently
    if ([WebViewEventSendNames.MouseMove, WebViewEventSendNames.MouseUp].includes(eventType)) {
      let data = eventData as MouseEvent
      // We need to transform from webview relative to parent window relative
      const webviewBounds = webview.getBoundingClientRect()
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
          clientX: data.clientX + webviewBounds.left,
          clientY: data.clientY + webviewBounds.top,
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
      webview.dispatchEvent(e)
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
      webview.dispatchEvent(e)
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
      webview.dispatchEvent(e)
      const endevent = new DragEvent('dragend', {
        dataTransfer: drag?.dataTransfer ?? new DataTransfer(),
        bubbles: true
      })
      webview.dispatchEvent(endevent)
    } else if (
      eventType === WebViewEventSendNames.Drag ||
      eventType === WebViewEventSendNames.DragOver
    ) {
      let data = eventData as DragEvent
      const webviewBounds = webview.getBoundingClientRect()
      data.clientX += webviewBounds.left
      data.clientY += webviewBounds.top
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
          to: DragZone.ZONES.values().find((x) => (x as HTMLDragZone).element === webview),
          dataTransfer: data.dataTransfer ?? new DataTransfer(),
          item: undefined
        })
        activeDrag = Dragcula.get().activeDrag

        Dragcula.get().prepareDragOperation()
        Dragcula.get().callHandlers('dragstart', activeDrag)
      }

      webview.dispatchEvent(e)
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

  const handleFaviconChange = useDebounce((newFaviconURL: string) => {
    // NOTE: This is an expensive operation invoking main thread! Make sure it is debounced
    if (webview?.getURL()) {
      if (isPDFViewerURL(webview?.getURL(), window.api.PDFViewerEntryPoint)) return
    }

    if ($faviconURL === newFaviconURL) {
      return
    }

    faviconURL.set(newFaviconURL)
    dispatch('favicon-change', newFaviconURL)
  }, 250)

  const updateFaviconForTheme = () => {
    if (lastReceivedFavicons.length === 0 || !webview) return

    const currentUrl = webview.getURL()
    const domain = getHostname(currentUrl) || ''

    if (!domain) {
      log.warn('Failed to parse URL for favicon domain', currentUrl)
    }

    const isDarkMode = $userConfig.app_style === 'dark'
    const bestFavicon = processFavicons(lastReceivedFavicons, domain, isDarkMode)
    handleFaviconChange(bestFavicon)
  }

  onMount(() => {
    if (!webview) return

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

  const handleDragEnter = async (drag: DragculaDragEvent) => {
    const resourceId = drag.item?.data.getData(DragTypeNames.SURF_RESOURCE_ID)
    webview.focus()
    drag.continue()

    if (!resourceId) return
    const resource = await resourceManager.getResource(resourceId)
    if (!resource) return
    const token = await window.api.createToken(resource.id)

    webview?.send(
      'set-drag-metadata',
      JSON.stringify({ token, resource: resource.getTransferableObject() })
    )
  }

  const handleDragOver = (drag: DragculaDragEvent) => {
    drag.continue()
  }
  const handleDrop = async (drag: DragculaDragEvent) => {
    drag.continue()
  }
  const handleDragLeave = (drag: DragculaDragEvent) => {
    webview.blur()
    drag.continue()
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
      webviewReady.set(true)
      $webContentsId = webview.getWebContentsId()

      if (!newWindowHandlerRegistered) {
        window.api.registerNewWindowHandler($webContentsId, (details) => {
          dispatch('new-window', details)
        })

        newWindowHandlerRegistered = true
      }
    })

    /*
      Handle loading events
    */
    webview.addEventListener('did-start-loading', () => {
      isLoading.set(true)
      error.set(null)
    })
    webview.addEventListener('did-stop-loading', () => isLoading.set(false))
    webview.addEventListener('did-fail-load', (e: Electron.DidFailLoadEvent) => {
      if (!e.isMainFrame) {
        return
      }

      log.debug('Failed to load', e.errorCode, e.errorDescription, e.validatedURL)

      // Ignore errors that are not related to the webview itself or don't need an error page to be shown
      if (shouldIgnoreWebviewErrorCode(e.errorCode)) {
        log.debug('Ignoring error code', e.errorCode)
        return
      }

      error.set({ code: e.errorCode, description: e.errorDescription, url: e.validatedURL })
    })
    webview.addEventListener('did-finish-load', () => {
      dispatch('did-finish-load')
      didFinishLoad.set(true)
      handleNavigation(webview.getURL())
    })

    /*
      Handle media playback events
    */
    webview.addEventListener('media-started-playing', () =>
      dispatch('media-playback-changed', true)
    )
    webview.addEventListener('media-paused', () => dispatch('media-playback-changed', false))

    /*
      Handle page metadata events
    */
    webview.addEventListener('page-title-updated', (e: Electron.PageTitleUpdatedEvent) => {
      handlePageTitleChange(e.title)
    })

    webview.addEventListener('page-favicon-updated', (event: Electron.PageFaviconUpdatedEvent) => {
      // Store the favicons for later theme changes
      lastReceivedFavicons = event.favicons

      // Get the current URL's domain for caching
      const currentUrl = webview.getURL()
      const domain = getHostname(currentUrl) || ''

      if (!domain) {
        log.warn('Failed to parse URL for favicon domain', currentUrl)
      }

      // Use the favicon utility to get the best favicon
      const isDarkMode = $userConfig.app_style === 'dark'
      const bestFavicon = processFavicons(event.favicons, domain, isDarkMode)

      // Update the favicon
      handleFaviconChange(bestFavicon)
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
  })

  onDestroy(() => {
    if (newWindowHandlerRegistered && $webContentsId !== null) {
      window.api.unregisterNewWindowHandler($webContentsId)
    }
  })
</script>

<webview
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
/>

<style lang="scss">
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
    background: white;
  }
</style>
