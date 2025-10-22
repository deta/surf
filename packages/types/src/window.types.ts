import type {
  NavigationEntry,
  Rectangle,
  Result,
  WebContentsWillNavigateEventParams
} from 'electron'
import type { ChatPrompt } from './ai.types'

export type SettingsWindowTab = 'general' | 'ai' | 'appearance' | 'advanced' | 'extensions'

export type WebContentsViewCreateOptions = {
  id?: string
  partition?: string
  url?: string
  overlayId?: string
  sandbox?: boolean
  transparent?: boolean
  bounds?: Rectangle
  preload?: string
  activate?: boolean
  permanentlyActive?: boolean
  isOverlay?: boolean
  parentViewID?: string
  additionalArguments?: string[]
  navigationHistory?: NavigationEntry[]
  navigationHistoryIndex?: number
}

export type WebContentsViewData = {
  id: string
  partition: string
  url: string
  title: string
  faviconUrl: string
  permanentlyActive: boolean
  navigationHistoryIndex: number
  navigationHistory: Electron.NavigationEntry[]
  extractedResourceId: string | null
  createdAt: string
  updatedAt: string
}

export type SearchResultLink = {
  title: string
  url: string
}

// --- WebContentsView Actions ---
export enum WebContentsViewActionType {
  ACTIVATE = 'activate',
  HIDE = 'hide',
  DESTROY = 'destroy',
  RELOAD = 'reload',
  GO_FORWARD = 'go-forward',
  GO_BACK = 'go-back',
  SET_BOUNDS = 'set-bounds',
  LOAD_URL = 'load-url',
  INSERT_TEXT = 'insert-text',
  GET_URL = 'get-url',
  FOCUS = 'focus',
  SET_AUDIO_MUTED = 'set-audio-muted',
  SET_ZOOM_FACTOR = 'set-zoom-factor',
  GET_ZOOM_FACTOR = 'get-zoom-factor',
  OPEN_DEV_TOOLS = 'open-dev-tools',
  SEND = 'send',
  FIND_IN_PAGE = 'find-in-page',
  STOP_FIND_IN_PAGE = 'stop-find-in-page',
  EXECUTE_JAVASCRIPT = 'execute-javascript',
  DOWNLOAD_URL = 'download-url',
  IS_CURRENTLY_AUDIBLE = 'is-currently-audible',
  GET_NAVIGATION_HISTORY = 'get-navigation-history',
  CAPTURE_PAGE = 'capture-page',
  CHANGE_PERMANENTLY_ACTIVE = 'change-permanently-active'
}

export interface WebContentsViewActionPayloads {
  [WebContentsViewActionType.ACTIVATE]: undefined
  [WebContentsViewActionType.DESTROY]: undefined
  [WebContentsViewActionType.HIDE]: undefined
  [WebContentsViewActionType.RELOAD]: { ignoreCache?: boolean } | undefined
  [WebContentsViewActionType.GO_FORWARD]: undefined
  [WebContentsViewActionType.GO_BACK]: undefined
  [WebContentsViewActionType.SET_BOUNDS]: Partial<Rectangle>
  [WebContentsViewActionType.LOAD_URL]: { url: string }
  [WebContentsViewActionType.INSERT_TEXT]: { text: string }
  [WebContentsViewActionType.GET_URL]: undefined
  [WebContentsViewActionType.FOCUS]: undefined
  [WebContentsViewActionType.SET_AUDIO_MUTED]: boolean
  [WebContentsViewActionType.SET_ZOOM_FACTOR]: number
  [WebContentsViewActionType.GET_ZOOM_FACTOR]: undefined
  [WebContentsViewActionType.OPEN_DEV_TOOLS]: { mode?: Electron.OpenDevToolsOptions['mode'] }
  [WebContentsViewActionType.SEND]: { channel: string; args?: any[] }
  [WebContentsViewActionType.FIND_IN_PAGE]: { text: string; options?: Electron.FindInPageOptions }
  [WebContentsViewActionType.STOP_FIND_IN_PAGE]: {
    action: 'clearSelection' | 'keepSelection' | 'activateSelection'
  }
  [WebContentsViewActionType.EXECUTE_JAVASCRIPT]: { code: string; userGesture?: boolean }
  [WebContentsViewActionType.DOWNLOAD_URL]: { url: string; options?: Electron.DownloadURLOptions }
  [WebContentsViewActionType.IS_CURRENTLY_AUDIBLE]: undefined
  [WebContentsViewActionType.GET_NAVIGATION_HISTORY]: undefined
  [WebContentsViewActionType.CAPTURE_PAGE]:
    | { rect?: Electron.Rectangle; quality?: 'low' | 'medium' | 'high' }
    | undefined
  [WebContentsViewActionType.CHANGE_PERMANENTLY_ACTIVE]: boolean
}

export interface WebContentsViewActionOutputs {
  [WebContentsViewActionType.ACTIVATE]: boolean
  [WebContentsViewActionType.DESTROY]: boolean
  [WebContentsViewActionType.HIDE]: boolean
  [WebContentsViewActionType.RELOAD]: boolean
  [WebContentsViewActionType.GO_FORWARD]: boolean
  [WebContentsViewActionType.GO_BACK]: boolean
  [WebContentsViewActionType.SET_BOUNDS]: boolean
  [WebContentsViewActionType.LOAD_URL]: boolean
  [WebContentsViewActionType.INSERT_TEXT]: boolean
  [WebContentsViewActionType.GET_URL]: string
  [WebContentsViewActionType.FOCUS]: boolean
  [WebContentsViewActionType.SET_AUDIO_MUTED]: boolean
  [WebContentsViewActionType.SET_ZOOM_FACTOR]: boolean
  [WebContentsViewActionType.GET_ZOOM_FACTOR]: boolean
  [WebContentsViewActionType.OPEN_DEV_TOOLS]: boolean
  [WebContentsViewActionType.SEND]: boolean
  [WebContentsViewActionType.FIND_IN_PAGE]: number
  [WebContentsViewActionType.STOP_FIND_IN_PAGE]: boolean
  [WebContentsViewActionType.EXECUTE_JAVASCRIPT]: any
  [WebContentsViewActionType.DOWNLOAD_URL]: boolean
  [WebContentsViewActionType.IS_CURRENTLY_AUDIBLE]: boolean
  [WebContentsViewActionType.CAPTURE_PAGE]: string // base64 encoded image data
  [WebContentsViewActionType.GET_NAVIGATION_HISTORY]: {
    entries: NavigationEntry[]
    index: number
  }
  [WebContentsViewActionType.CHANGE_PERMANENTLY_ACTIVE]: boolean
}

export type WebContentsViewAction = {
  [K in WebContentsViewActionType]: WebContentsViewActionTyped<K, WebContentsViewActionPayloads>
}[WebContentsViewActionType]

export type WebContentsViewActionEvent = {
  [K in WebContentsViewActionType]: {
    payload: {
      viewId: string
      action: WebContentsViewActionTyped<K, WebContentsViewActionPayloads>
    }
    output: WebContentsViewActionOutputs[K]
  }
}[WebContentsViewActionType]

// --- WebContentsViewManager Actions ---
export enum WebContentsViewManagerActionType {
  CREATE = 'create',
  HIDE_ALL = 'hide-all',
  SHOW_ACTIVE = 'show-active'
}

export interface WebContentsViewManagerActionPayloads {
  [WebContentsViewManagerActionType.CREATE]: WebContentsViewCreateOptions
  [WebContentsViewManagerActionType.HIDE_ALL]: undefined
  [WebContentsViewManagerActionType.SHOW_ACTIVE]?: { id?: string } | undefined
}

export interface WebContentsViewManagerActionOutputs {
  [WebContentsViewManagerActionType.CREATE]: { viewId: string; webContentsId: number }
  [WebContentsViewManagerActionType.HIDE_ALL]: boolean
  [WebContentsViewManagerActionType.SHOW_ACTIVE]: boolean
}

export type WebContentsViewManagerAction = {
  [K in WebContentsViewManagerActionType]: WebContentsViewActionTyped<
    K,
    WebContentsViewManagerActionPayloads
  >
}[WebContentsViewManagerActionType]

export type WebContentsViewManagerActionEvent = {
  [K in WebContentsViewManagerActionType]: {
    payload: WebContentsViewActionTyped<K, WebContentsViewManagerActionPayloads>
    output: WebContentsViewManagerActionOutputs[K]
  }
}[WebContentsViewManagerActionType]

// --- WebContentsView Type Utils ---
export type WebContentsViewActionTyped<T extends string, P extends Record<T, any>> = {
  type: T
} & (P[T] extends undefined ? { payload?: P[T] } : { payload: P[T] })

// --- WebContentsView Events ---
export enum WebContentsViewEventType {
  // Load Events
  DID_START_LOADING = 'did-start-loading',
  DID_STOP_LOADING = 'did-stop-loading',
  DID_FINISH_LOAD = 'did-finish-load',
  DID_FAIL_LOAD = 'did-fail-load',
  DOM_READY = 'dom-ready',

  // Navigation Events
  WILL_NAVIGATE = 'will-navigate',
  DID_NAVIGATE = 'did-navigate',
  DID_NAVIGATE_IN_PAGE = 'did-navigate-in-page',

  // Page Events
  UPDATE_TARGET_URL = 'update-target-url',
  PAGE_TITLE_UPDATED = 'page-title-updated',
  PAGE_FAVICON_UPDATED = 'page-favicon-updated',
  FOUND_IN_PAGE = 'found-in-page',
  IPC_MESSAGE = 'ipc-message',

  // Media Events
  MEDIA_STARTED_PLAYING = 'media-started-playing',
  MEDIA_PAUSED = 'media-paused',

  // Focus and Blur Events
  FOCUS = 'focus',
  BLUR = 'blur',
  ENTER_HTML_FULL_SCREEN = 'enter-html-full-screen',
  LEAVE_HTML_FULL_SCREEN = 'leave-html-full-screen'
}

// values of the enum WebContentsViewEventType e.g. did-start-loading
export type WebContentsViewEventTypeNames = `${WebContentsViewEventType}`

export interface WebContentsViewEventPayloads {
  [WebContentsViewEventType.DID_START_LOADING]: undefined
  [WebContentsViewEventType.DID_STOP_LOADING]: undefined
  [WebContentsViewEventType.DID_FINISH_LOAD]: undefined
  [WebContentsViewEventType.DID_FAIL_LOAD]: {
    errorCode: number
    errorDescription: string
    validatedURL: string
    isMainFrame: boolean
    frameProcessId: number
    frameRoutingId: number
  }
  [WebContentsViewEventType.DOM_READY]: undefined
  [WebContentsViewEventType.WILL_NAVIGATE]: {
    url: string
    isInPlace: boolean
    isMainFrame: boolean
    frameProcessId: number
    frameRoutingId: number
  }
  [WebContentsViewEventType.DID_NAVIGATE]: {
    url: string
    httpResponseCode: number
    httpStatusText: string
  }
  [WebContentsViewEventType.DID_NAVIGATE_IN_PAGE]: {
    url: string
    isMainFrame: boolean
    frameProcessId: number
    frameRoutingId: number
  }
  [WebContentsViewEventType.UPDATE_TARGET_URL]: {
    url: string
  }
  [WebContentsViewEventType.PAGE_TITLE_UPDATED]: {
    title: string
    explicitSet: boolean
  }
  [WebContentsViewEventType.PAGE_FAVICON_UPDATED]: {
    favicons: string[]
  }
  [WebContentsViewEventType.MEDIA_STARTED_PLAYING]: undefined
  [WebContentsViewEventType.MEDIA_PAUSED]: undefined
  [WebContentsViewEventType.FOCUS]: undefined
  [WebContentsViewEventType.BLUR]: undefined
  [WebContentsViewEventType.FOUND_IN_PAGE]: {
    result: Result
  }
  [WebContentsViewEventType.IPC_MESSAGE]: {
    channel: string
    args: any[]
  }
  [WebContentsViewEventType.ENTER_HTML_FULL_SCREEN]: undefined
  [WebContentsViewEventType.LEAVE_HTML_FULL_SCREEN]: undefined
}

export type WebContentsViewEventTyped<T extends WebContentsViewEventType> = {
  type: T
  viewId: string
  payload: WebContentsViewEventPayloads[T]
}

export type WebContentsViewEvent = {
  [K in WebContentsViewEventType]: WebContentsViewEventTyped<K>
}[WebContentsViewEventType]

export type WebContentsViewEvents = {
  [K in WebContentsViewEventType]: WebContentsViewEventPayloads[K]
}

export type WebContentsViewEventListenerCallback<T extends WebContentsViewEventType> = (
  args: WebContentsViewEventPayloads[T]
) => boolean | void

export type WebContentsViewEventListenerTyped<T extends WebContentsViewEventType> = {
  type: T
  callback: WebContentsViewEventListenerCallback<T>
}

export type WebContentsViewEventListener = {
  [K in WebContentsViewEventType]: WebContentsViewEventListenerTyped<K>
}[WebContentsViewEventType]
