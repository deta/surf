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
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { useConfig } from '../../service/config'
  import {
    WebContentsViewEventType,
    WebContentsViewManagerActionType,
    WebViewEventSendNames,
    type WebContentsViewActionPayloads,
    type WebContentsViewEventListener,
    type WebContentsViewEventListenerCallback,
    type WebContentsViewEventPayloads,
    type WebContentsViewEvents,
    type WebViewSendEvents
  } from '@horizon/types'

  import type { HistoryEntriesManager } from '../../service/history'
  import { useLogScope, wait } from '@horizon/utils'
  import { useResourceManager } from '../../service/resources'
  import type { NewWindowRequest } from '../../service/ipc/events'
  import { WebContentsViewActionType } from '@horizon/types'
  import { useTabsManager } from '../../service/tabs'
  import Tab from '@horizon/core/src/lib/components/Core/Tab.svelte'

  const config = useConfig()
  const userConfig = config.settings

  export let id: string = crypto.randomUUID().split('-').slice(0, 1).join('')
  export let src: string
  export let partition: string
  export let active: boolean = true
  export let navigationHistory: Writable<Electron.NavigationEntry[]>
  export let currentHistoryIndex: Writable<number>
  export let isReady = writable(false)
  export let webContentsId = writable<number | null>(null)
  export let webContentsWrapper: HTMLDivElement | null = null
  export let isOverlay = false

  export const title = writable('')
  export const faviconURL = writable<string>('')
  export const didFinishLoad = writable(false)

  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()

  const log = useLogScope('WebContents')
  const dispatch = createEventDispatcher<WebContentsViewEvents>()

  let currentBounds: DOMRect | null = null
  let eventListeners: Array<WebContentsViewEventListener> = []
  let isActivated = active
  let backgroundImage: string | null = null

  $: cleanID = id.replace('webview-', '')

  /*
    EXPORTED WEBVIEW UTILITY FUNCTIONS
  */
  export const navigate = async (targetUrl: string) => {
    try {
      log.debug('Navigating to', targetUrl)
      window.api.webContentsViewAction(cleanID, WebContentsViewActionType.LOAD_URL, {
        url: targetUrl
      })
    } catch (error) {
      log.error('Error navigating', error)
    }
  }

  export const reload = (ignoreCache = false) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.RELOAD, { ignoreCache })
  }

  export const goBackInHistory = () => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.GO_BACK)
  }

  export const goForwardInHistory = () => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.GO_FORWARD)
  }

  export const insertText = (text: string) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.INSERT_TEXT, { text })
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
    const url = await window.api.webContentsViewAction(cleanID, WebContentsViewActionType.GET_URL)
    return url
  }

  export const focus = () => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.FOCUS)
  }

  export const setAudioMuted = (muted: boolean) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.SET_AUDIO_MUTED, muted)
  }

  export const setZoomFactor = (factor: number) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.SET_ZOOM_FACTOR, factor)
  }

  export const openDevTools = (
    mode: WebContentsViewActionPayloads[WebContentsViewActionType.OPEN_DEV_TOOLS]['mode'] = 'right'
  ) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.OPEN_DEV_TOOLS, { mode })
  }

  export const send = (channel: string, ...args: any[]) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.SEND, { channel, args })
  }

  export const findInPage = (
    text: string,
    options?: { forward?: boolean; matchCase?: boolean; findNext?: boolean }
  ) => {
    return window.api.webContentsViewAction(cleanID, WebContentsViewActionType.FIND_IN_PAGE, {
      text,
      options
    })
  }

  export const stopFindInPage = (
    action: 'clearSelection' | 'keepSelection' | 'activateSelection'
  ) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.STOP_FIND_IN_PAGE, {
      action
    })
  }

  export const executeJavaScript = async (code: string, userGesture = false) => {
    return window.api.webContentsViewAction(cleanID, WebContentsViewActionType.EXECUTE_JAVASCRIPT, {
      code,
      userGesture
    })
  }

  export const downloadURL = async (url: string, options?: Electron.DownloadURLOptions) => {
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.DOWNLOAD_URL, {
      url,
      options
    })
  }

  export const isCurrentlyAudible = async () => {
    const isAudible = await window.api.webContentsViewAction(
      cleanID,
      WebContentsViewActionType.IS_CURRENTLY_AUDIBLE
    )
    return isAudible
  }

  export const getNavigationHistory = async () => {
    const history = await window.api.webContentsViewAction(
      cleanID,
      WebContentsViewActionType.GET_NAVIGATION_HISTORY
    )
    return history
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

  export const refreshBackgroundImage = async () => {
    const dataURL = await window.api.webContentsViewAction(
      cleanID,
      WebContentsViewActionType.CAPTURE_PAGE,
      {}
    )
    if (dataURL) {
      log.debug('Setting background image for web contents view', cleanID)
      backgroundImage = `url(${dataURL})`
    } else {
      log.warn('No data URL returned for captured page')
    }
  }

  export const show = async () => {
    log.debug('Showing web contents view', cleanID)
    await window.api.webContentsViewAction(cleanID, WebContentsViewActionType.ACTIVATE)
  }

  export const hide = async () => {
    log.debug('Hiding web contents view', cleanID)
    await refreshBackgroundImage()
    await window.api.webContentsViewAction(cleanID, WebContentsViewActionType.HIDE)
  }

  $: if ($webContentsId && cleanID) {
    if (active && !isActivated) {
      isActivated = true
      show()
    } else if (!active && isActivated) {
      isActivated = false
      hide()
    }
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

    const bounds = webContentsWrapper.getBoundingClientRect()

    log.debug('Creating web contents view with bounds', bounds, src, cleanID)
    const result = await window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.CREATE,
      {
        id: cleanID,
        url: src,
        partition: partition,
        activate: active,
        isOverlay,
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
      }
    )

    if (!result || !result.viewId) {
      log.error('Failed to create web contents view')
      return
    }

    const { viewId, webContentsId: wcId } = result

    log.debug('Created web contents view with ID', viewId)

    isReady.set(true)
    $webContentsId = wcId

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
      window.api.webContentsViewAction(viewId, WebContentsViewActionType.SET_BOUNDS, {
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

    tabsManager.on('hide-views', () => {
      if (tabsManager.activeTabIdValue === cleanID || (isOverlay && active)) {
        refreshBackgroundImage()
      }
    })

    // const activeTabId = tabsManager.activeTabId
    // let prevId = tabsManager.activeTabIdValue
    // const unsubTab = activeTabId.subscribe((tabId) => {
    //   if (tabId !== cleanID) {
    //     if (prevId === cleanID) {
    //       log.debug('Deactivating web contents view', cleanID)
    //       window.api.webContentsViewAction(viewId, WebContentsViewActionType.HIDE)

    //       prevId = tabId
    //     }

    //     return
    //   }

    //   window.api.webContentsViewAction(viewId, WebContentsViewActionType.ACTIVATE)

    //   prevId = tabId
    // })

    // unsub.push(() => {
    //   log.debug('Unsubscribing from active tab ID')
    //   unsubTab()
    // })
  })

  onDestroy(() => {
    log.debug('Destroying web contents view', cleanID, isOverlay)
    window.api.webContentsViewAction(cleanID, WebContentsViewActionType.DESTROY)

    if (unsub) {
      unsub.forEach((fn) => fn())
    }

    if (isOverlay && tabsManager.showNewTabOverlayValue === 0) {
      window.api.webContentsViewManagerAction(WebContentsViewManagerActionType.SHOW_ACTIVE)
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
  class="webcontentsview-container"
  bind:this={webContentsWrapper}
  style="--background-image: {backgroundImage};"
></div>

<style lang="scss">
  .webcontentsview-container {
    width: 100%;
    height: 100%;
    background: var(--background-image, white);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(2px);
  }
</style>
