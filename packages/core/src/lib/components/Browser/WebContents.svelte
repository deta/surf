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
  import { writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import {
    WebContentsViewEventType,
    WebViewEventSendNames,
    type WebContentsViewEventListener,
    type WebContentsViewEventListenerCallback,
    type WebContentsViewEvents,
    type WebViewSendEvents
  } from '@horizon/types'

  import { useLogScope } from '@horizon/utils'
  import type { NewWindowRequest } from '../../service/ipc/events'
  import { useTabsManager } from '../../service/tabs'
  import type { WebContentsView } from '@horizon/core/src/lib/service/viewManager'

  export let id: string = crypto.randomUUID().split('-').slice(0, 1).join('')
  export let src: string
  export let partition: string
  export let active: boolean = true
  export let navigationHistory: Writable<Electron.NavigationEntry[]>
  export let currentHistoryIndex: Writable<number>
  export let isReady = writable(false)
  export let webContentsId = writable<number | null>(null)
  export let webContentsWrapper: HTMLDivElement | null = null
  export let webContentsView: WebContentsView | null = null
  export let parentViewID: string | undefined = undefined
  export let isOverlay: boolean = false
  export let isLoading: Writable<boolean>

  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const didFinishLoad = writable(false)

  const tabsManager = useTabsManager()

  const log = useLogScope('WebContents')
  const dispatch = createEventDispatcher<WebContentsViewEvents>()

  let currentBounds: DOMRect | null = null
  let eventListeners: Array<WebContentsViewEventListener> = []
  let isActivated = active

  $: cleanID = id.replace('webview-', '')

  // why svelte, whyyyy?!
  $: webContentsScreenshot = webContentsView !== null ? webContentsView?.screenshot : writable(null)

  /*
    EXPORTED WEBVIEW UTILITY FUNCTIONS
  */
  export const navigate = async (targetUrl: string) => {
    try {
      log.debug('Navigating to', targetUrl)
      await webContentsView?.loadURL(targetUrl)
    } catch (error) {
      log.error('Error navigating', error)
    }
  }

  export const reload = (ignoreCache = false) => {
    webContentsView?.reload(ignoreCache)
  }

  export const goBackInHistory = () => {
    webContentsView?.goBack()
  }

  export const goForwardInHistory = () => {
    webContentsView?.goForward()
  }

  export const insertText = (text: string) => {
    webContentsView?.insertText(text)
  }

  export const getBoundingClientRect = (): DOMRect | null => {
    if (!currentBounds) {
      if (!webContentsWrapper) {
        log.error('WebContents wrapper element is not defined')
        return null
      }

      currentBounds = webContentsWrapper.getBoundingClientRect()
      log.debug('Current bounds initialized', currentBounds)
    }

    return currentBounds
  }

  export const getURL = async () => {
    return webContentsView?.getURL()
  }

  export const focus = () => {
    webContentsView?.focus()
  }

  export const setAudioMuted = (muted: boolean) => {
    webContentsView?.setAudioMuted(muted)
  }

  export const setZoomFactor = (factor: number) => {
    webContentsView?.setZoomFactor(factor)
  }

  export const openDevTools = (mode: 'right' | 'bottom' | 'detach' = 'right') => {
    webContentsView?.openDevTools(mode)
  }

  export const send = (channel: string, ...args: any[]) => {
    webContentsView?.send(channel, ...args)
  }

  export const findInPage = (
    text: string,
    options?: { forward?: boolean; matchCase?: boolean; findNext?: boolean }
  ) => {
    return webContentsView?.findInPage(text, options)
  }

  export const stopFindInPage = (
    action: 'clearSelection' | 'keepSelection' | 'activateSelection'
  ) => {
    webContentsView?.stopFindInPage(action)
  }

  export const executeJavaScript = async (code: string, userGesture = false) => {
    return webContentsView?.executeJavaScript(code, userGesture)
  }

  export const downloadURL = async (url: string, options?: Electron.DownloadURLOptions) => {
    await webContentsView?.downloadURL(url, options)
  }

  export const isCurrentlyAudible = async () => {
    return webContentsView?.isCurrentlyAudible()
  }

  export const getNavigationHistory = async () => {
    return webContentsView?.getNavigationHistory()
  }

  export const addEventListener = <T extends WebContentsViewEventType>(
    type: T,
    callback: WebContentsViewEventListenerCallback<T>
  ) => {
    eventListeners.push({ type, callback } as any)

    return () => {
      removeEventListener(type, callback)
    }
  }

  export const removeEventListener = <T extends WebContentsViewEventType>(
    type: T,
    callback: WebContentsViewEventListenerCallback<T>
  ) => {
    eventListeners = eventListeners.filter((listener) => {
      return !(listener.type === type && listener.callback === callback)
    })
  }

  export const addPageEventListener = (callback: (args: any[]) => boolean | void) => {
    return addEventListener(WebContentsViewEventType.IPC_MESSAGE, (payload) => {
      if (payload.channel === 'webview-page-event') {
        callback(payload.args)
      }
    })
  }

  export const removePageEventListener = (callback: (args: any[]) => boolean | void) => {
    return removeEventListener(WebContentsViewEventType.IPC_MESSAGE, (payload) => {
      if (payload.channel === 'webview-page-event') {
        callback(payload.args)
      }
    })
  }

  /*
    INITIALIZATION
  */

  let unsub: Array<() => void> = []
  onMount(async () => {
    if (!webContentsWrapper) {
      log.error('WebContents wrapper element is not defined')
      return
    }

    log.debug('Initializing web contents view with ID', cleanID, 'and source', src)
    isLoading.set(true)

    const bounds = webContentsWrapper.getBoundingClientRect()

    log.debug('Creating web contents view with bounds', bounds, src, cleanID)
    webContentsView = await tabsManager.viewManager.create({
      id: cleanID,
      url: src,
      partition: partition,
      activate: active,
      isOverlay: isOverlay,
      parentViewID: parentViewID,
      ...($navigationHistory.length > 0
        ? {
            navigationHistory: $navigationHistory,
            navigationHistoryIndex: Math.max(
              0,
              Math.min($currentHistoryIndex, $navigationHistory.length - 1)
            )
          }
        : {}),
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    })

    if (!webContentsView) {
      log.error('Failed to create web contents view')
      return
    }

    log.debug('Created web contents view with ID', webContentsView)

    isReady.set(true)
    $webContentsId = webContentsView.webContentsId

    const unsubWebContentsEvents = window.preloadEvents.onWebContentsViewEvent((event) => {
      // only handle events for our own view
      if (event.viewId !== cleanID) {
        return
      }

      let skipDispatch = false

      const matchingListeners = eventListeners.filter((listener) => listener.type === event.type)
      if (matchingListeners.length > 0) {
        log.debug('Found matching listeners for event', event.type, matchingListeners.length)
        matchingListeners.forEach((listener) => {
          const result = listener.callback(event.payload as any)
          if (result === false) {
            skipDispatch = true
          }
        })
      }

      if (!skipDispatch) {
        dispatch(event.type, event.payload)
      }
    })

    unsub.push(() => {
      unsubWebContentsEvents()
    })

    // setup resize observer to resize the webview when the wrapper changes size
    const resizeObserver = new ResizeObserver((entries) => {
      if (!webContentsWrapper) return
      currentBounds = webContentsWrapper.getBoundingClientRect()
      log.debug('Resizing web contents view to', currentBounds)
      webContentsView?.bounds.set({
        x: currentBounds.x,
        y: currentBounds.y,
        width: currentBounds.width,
        height: currentBounds.height
      })
    })

    resizeObserver.observe(webContentsWrapper)

    unsub.push(() => {
      log.debug('Unsubscribing from resize observer')
      resizeObserver.disconnect()
    })
  })

  onDestroy(() => {
    log.debug('Destroying web contents view', cleanID, { isOverlay, parentViewID })
    tabsManager.viewManager.destroy(cleanID)

    if (unsub) {
      unsub.forEach((fn) => fn())
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

<div
  id="webcontentsview-container"
  class="webcontentsview-container quality-{$webContentsScreenshot?.quality || 'none'}"
  bind:this={webContentsWrapper}
  style="--background-image: {$webContentsScreenshot?.image
    ? `url(${$webContentsScreenshot?.image})`
    : 'white'};"
></div>

<style lang="scss">
  .webcontentsview-container {
    width: 100%;
    height: 100%;
    background: var(--background-image, white);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(0);
    transition: filter 0.2s ease-in-out;
    overflow: hidden;

    &:not(:active) {
      filter: blur(2px);
    }
  }

  :global(.screen-picker-active .webcontentsview-container) {
    filter: none !important;
  }
</style>
