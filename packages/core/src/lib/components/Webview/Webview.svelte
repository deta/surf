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
  }
</script>

<script lang="ts">
  import type { WebviewTag } from 'electron'
  import { derived, writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import {
    ResourceTypes,
    WebViewEventSendNames,
    type WebViewReceiveEvents,
    type WebViewSendEvents
  } from '@horizon/types'

  import type { HistoryEntriesManager } from '../../service/history'
  import { useLogScope, useDebounce } from '@horizon/utils'
  import type { AnnotationHighlightData, HistoryEntry } from '../../types'
  import type {
    ResourceAnnotation,
    ResourceChatThread,
    ResourceLink,
    ResourceObject
  } from '../../service/resources'
  import type { Tab, TabPage } from '../../types/browser.types'
  import { HTMLDragZone, type DragculaDragEvent } from '@horizon/dragcula'
  import type { WebviewError } from '../../constants/webviewErrors'
  import type { NewWindowRequest } from '../../service/ipc/events'

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

  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const playback = writable(false)
  export const isMuted = writable(false)
  export const didFinishLoad = writable(false)

  const PRELOAD_PATH = window.api.webviewPreloadPath
  const ERROR_CODES_TO_IGNORE = [-3] // -3 is ERR_ABORTED
  const NAVIGATION_DEBOUNCE_TIME = 500

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

  const addHistoryEntry = useDebounce(async (newUrl: string) => {
    try {
      const oldUrl = $currentHistoryEntry?.url

      if (oldUrl && oldUrl === newUrl) {
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
      if (
        eventType === WebViewEventSendNames.MouseMove ||
        eventType === WebViewEventSendNames.MouseUp
      ) {
        let data = eventData as MouseEvent
        // We need to transform from webview relative to parent window relative
        const webviewBounds = webview.getBoundingClientRect()
        data.clientX += webviewBounds.left
        data.clientY += webviewBounds.top
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
            clientX: data.clientX,
            clientY: data.clientY,
            screenX: data.screenX,
            screenY: data.screenY,
            altKey: data.altKey,
            ctrlKey: data.ctrlKey,
            metaKey: data.metaKey,
            shiftKey: data.shiftKey
          })
        )
      }
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
    if ($faviconURL === newFaviconURL) {
      return
    }

    faviconURL.set(newFaviconURL)
    dispatch('favicon-change', newFaviconURL)
  }

  /**
   * Convert drag data into serialized format transferable to webview.
   * @param typesOnly - Use for all events except on:Drop, so that it doesnt fetch the data all the time during a drag as it should only be readable on drop anyways.
   */
  const serializeDragDataForWebview = async (
    data: { [key: string]: unknown } | DataTransfer,
    typesOnly = false
  ): Promise<{
    strings: { type: string; value: string | undefined }[]
    files: { name: string; type: string; buffer: ArrayBuffer | undefined }[]
  }> => {
    const serialized: {
      strings: { type: string; value: string | undefined }[]
      files: {
        name: string
        type: string
        buffer: ArrayBuffer | undefined
      }[]
    } = {
      strings: [],
      files: []
    }
    /// When the drag is a native drag, we need to handle it differently
    if (data instanceof DataTransfer) {
      for (const item of data.items) {
        if (item.kind === 'string') {
          const value = await new Promise<string>((resolve) => item.getAsString(resolve))
          serialized.strings.push({ type: item.type, value })
        } else if (item.kind === 'file') {
          const file = item.getAsFile()
          if (!file) continue
          serialized.files.push({
            name: file.name ?? `File ${serialized.files.length + 1}`,
            type: file.type,
            buffer: await file.arrayBuffer()
          })
        }
      }
    } else {
      if (data['surf/tab'] !== undefined) {
        const tab = data['surf/tab'] as TabPage // TODO: This is prob the wrong type re: currentLocation ? @Maxi
        if (typesOnly) {
          serialized.strings.push({ type: 'surf/tab', value: undefined })
        } else {
          serialized.strings.push({ type: 'text/uri-list', value: tab.currentLocation })
        }
      }
      if (data['oasis/resource'] !== undefined) {
        const resource = data['oasis/resource'] as ResourceObject
        if (
          (
            [
              ResourceTypes.LINK,
              ResourceTypes.ARTICLE,
              ResourceTypes.POST,
              ResourceTypes.POST_REDDIT,
              ResourceTypes.POST_TWITTER,
              ResourceTypes.POST_YOUTUBE,
              ResourceTypes.CHANNEL_YOUTUBE,
              ResourceTypes.PLAYLIST_YOUTUBE,
              ResourceTypes.CHAT_THREAD,
              ResourceTypes.CHAT_THREAD_SLACK
            ] as string[]
          ).includes(resource.type)
        ) {
          if (typesOnly) {
            serialized.strings.push({ type: 'text/uri-list', value: undefined })
          } else {
            let url = ''
            if (
              (
                [ResourceTypes.LINK, ResourceTypes.POST, ResourceTypes.ARTICLE] as string[]
              ).includes(resource.type)
            ) {
              url = (await (resource as ResourceLink).getParsedData())?.url
            } else {
              url = resource.metadata?.sourceURI ?? ''
            }
            serialized.strings.push({ type: 'text/uri-list', value: url })
          }
        } else if (([ResourceTypes.ANNOTATION] as string[]).includes(resource.type)) {
          let text = ''
          if (typesOnly) {
            serialized.strings.push({ type: 'text/plain', value: undefined })
          } else {
            const data = await (resource as ResourceAnnotation).getParsedData()
            const userComment = data.data.content_plain ?? ''

            text = `Highlight: ${data.anchor?.data['content_plain']}\n
${userComment === '' ? '' : `Comment: ${userComment}`}\n
Page: ${(resource as ResourceAnnotation).metadata?.sourceURI}\n
Made with Deta Surf.`
            serialized.strings.push({ type: 'text/plain', value: text })
          }
        }

        /// Default case is to treat as file
        else {
          if (typesOnly) {
            serialized.files.push({
              name: resource.metadata?.name ?? `File ${serialized.files.length + 1}`,
              type: resource.type,
              buffer: undefined
            })
          } else {
            const blob = await resource.getData()
            serialized.files.push({
              name: resource.metadata?.name ?? `File ${serialized.files.length + 1}`,
              type: blob.type,
              buffer: await blob.arrayBuffer()
            })
          }
        }
      }
    }
    return serialized
  }

  const handleDragEnter = async (drag: DragculaDragEvent) => {
    if (drag.item !== null) drag.item.dragEffect = 'copy'
    // TODO: allow move item with meta key?
    // convert coords to webview relative

    const bounds = webview.getBoundingClientRect()
    const clientX = drag.clientX - bounds.left
    const clientY = drag.clientY - bounds.top

    // TODO: Wrap Try catch abort
    const data = await serializeDragDataForWebview(drag.data, false)
    webview.send('webview-event', {
      type: 'simulate_drag_start',
      data: {
        clientX,
        clientY,
        screenX: drag.screenX,
        screenY: drag.screenY,
        pageX: drag.pageX - bounds.left,
        pageY: drag.pageY - bounds.top,
        data
      }
    })
    drag.continue()
  }
  const handleDragOver = (drag: DragculaDragEvent) => {
    if (drag.item !== null) drag.item.dragEffect = 'copy'
    // TODO: allow move with meta key?
    // convert coords to webview relative

    const bounds = webview.getBoundingClientRect()
    const clientX = drag.clientX - bounds.left
    const clientY = drag.clientY - bounds.top
    const screenX = drag.screenX
    const screenY = drag.screenY

    // TODO: Wrap Try catch abort
    webview.send('webview-event', {
      type: 'simulate_drag_update',
      data: {
        clientX,
        clientY,
        screenX,
        screenY,
        pageX: drag.pageX - bounds.left,
        pageY: drag.pageY - bounds.top
      }
    })
    drag.continue()
  }
  const handleDrop = async (drag: DragculaDragEvent) => {
    const bounds = webview.getBoundingClientRect()
    const clientX = drag.clientX - bounds.left
    const clientY = drag.clientY - bounds.top
    const screenX = drag.screenX
    const screenY = drag.screenY

    // TODO: Wrap Try catch abort
    const data = await serializeDragDataForWebview(drag.data, false)

    await webview.send('webview-event', {
      type: 'simulate_drag_end',
      data: {
        action: 'drop',
        clientX,
        clientY,
        screenX,
        screenY,
        pageX: drag.pageX - bounds.left,
        pageY: drag.pageY - bounds.top
        //data // Currently we dont update it.. but we could..
      }
    })

    if (data.strings[0]?.type === 'text/plain') {
      webview.insertText(data.strings[0].value)
    }
  }
  const handleDragLeave = (drag: DragculaDragEvent) => {
    webview.send('webview-event', {
      type: 'simulate_drag_end',
      data: {
        action: 'abort'
      }
    })
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
      webviewWebContentsId = webview.getWebContentsId()

      if (!newWindowHandlerRegistered) {
        window.api.registerNewWindowHandler(webviewWebContentsId, (details) => {
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
      if (ERROR_CODES_TO_IGNORE.includes(e.errorCode)) {
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
    webview.addEventListener('media-started-playing', () => playback.set(true))
    webview.addEventListener('media-paused', () => playback.set(false))

    /*
      Handle page metadata events
    */
    webview.addEventListener('page-title-updated', (e: Electron.PageTitleUpdatedEvent) => {
      handlePageTitleChange(e.title)
    })
    webview.addEventListener('page-favicon-updated', (event: Electron.PageFaviconUpdatedEvent) => {
      const getSize = (url: string): number => {
        const dims = url.match(/(\d+)x(\d+)/)
        return dims
          ? parseInt(dims[1]) * parseInt(dims[2])
          : Math.pow(parseInt(url.match(/\d+/)?.[0] || '0'), 2)
      }

      const getPriority = (url: string): number => {
        if (url.startsWith('data:image/')) return 3
        if (url.endsWith('.svg')) return 2
        if (url.endsWith('.ico')) return 1
        return 0
      }

      const sortedFavicons = event.favicons.sort((a, b) => {
        return getPriority(b) - getPriority(a) || getSize(b) - getSize(a)
      })

      handleFaviconChange(sortedFavicons[0])
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

    // webview.addEventListener(
    //   'did-redirect-navigation',
    //   (e: Electron.DidRedirectNavigationEvent) => {
    //     // log.debug('did redirect navigation', e.url)
    //     if (!e.isMainFrame || !e.isInPlace) return

    //     handleRedirectNavigation(e.url)
    //   }
    // )
  })

  onDestroy(() => {
    if (newWindowHandlerRegistered && webviewWebContentsId !== null) {
      window.api.unregisterNewWindowHandler(webviewWebContentsId)
    }
  })
</script>

<webview
  {id}
  bind:this={webview}
  {src}
  {partition}
  preload={`file://${PRELOAD_PATH}`}
  webpreferences="autoplayPolicy=user-gesture-required,defaultFontSize=14,contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true"
  allowpopups
  use:HTMLDragZone.action={{}}
  on:DragEnter={handleDragEnter}
  on:DragOver={handleDragOver}
  on:Drop={handleDrop}
  on:DragLeave={handleDragLeave}
  {...$$restProps}
/>

<style>
  webview {
    user-select: none;
    width: 100%;
    height: 100%;
    background: white;
  }
</style>
