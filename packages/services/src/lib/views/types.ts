import type {
  WebContentsError,
  WebContentsViewData,
  WebContentsViewEvents,
  WebContentsViewEventType,
  WebViewEventSendNames,
  WebViewSendEvents
} from '@deta/types'
import type { WebContents, WebContentsView } from './webContentsView.svelte'
import type { NewWindowRequest } from '../ipc'

export enum WebContentsViewEmitterNames {
  MOUNTED = 'mounted',
  DESTROYED = 'destroyed',
  DATA_CHANGED = 'data-changed'
}

export type WebContentsViewEmitterEvents = {
  [WebContentsViewEmitterNames.MOUNTED]: (webContentsView: WebContents) => void
  [WebContentsViewEmitterNames.DESTROYED]: () => void
  [WebContentsViewEmitterNames.DATA_CHANGED]: (data: WebContentsViewData) => void
}

export enum WebContentsEmitterNames {
  DID_START_LOADING = 'did-start-loading',
  DID_STOP_LOADING = 'did-stop-loading',
  LOADING_CHANGED = 'loading-changed',
  PAGE_TITLE_UPDATED = 'page-title-updated',
  PAGE_FAVICON_UPDATED = 'page-favicon-updated',
  WILL_NAVIGATE = 'will-navigate',
  DID_NAVIGATE = 'did-navigate',
  DID_NAVIGATE_IN_PAGE = 'did-navigate-in-page',
  DOM_READY = 'dom-ready',
  NAVIGATED = 'navigated',
  MEDIA_PLAYBACK_CHANGED = 'media-playback-changed',
  FULLSCREEN_CHANGED = 'fullscreen-changed',
  FOCUS_CHANGED = 'focus-changed',
  HOVER_TARGET_URL_CHANGED = 'hover-target-url-changed',
  FOUND_IN_PAGE = 'found-in-page',
  KEYDOWN = 'keydown',
  PRELOAD_EVENT = 'preload-event'
}

export type WebContentsEmitterEvents = {
  [WebContentsEmitterNames.DID_START_LOADING]: () => void
  [WebContentsEmitterNames.DID_STOP_LOADING]: () => void
  [WebContentsEmitterNames.LOADING_CHANGED]: (
    isLoading: boolean,
    error: WebContentsError | null
  ) => void
  [WebContentsEmitterNames.PAGE_TITLE_UPDATED]: (newTitle: string, oldTitle: string) => void
  [WebContentsEmitterNames.PAGE_FAVICON_UPDATED]: (
    newFaviconUrl: string,
    oldFaviconUrl: string
  ) => void
  [WebContentsEmitterNames.NAVIGATED]: (
    newUrl: string,
    oldUrl: string,
    isProgrammatic: boolean
  ) => void
  [WebContentsEmitterNames.MEDIA_PLAYBACK_CHANGED]: (isPlaying: boolean) => void
  [WebContentsEmitterNames.FULLSCREEN_CHANGED]: (isFullScreen: boolean) => void
  [WebContentsEmitterNames.FOCUS_CHANGED]: (isFocused: boolean) => void
  [WebContentsEmitterNames.HOVER_TARGET_URL_CHANGED]: (url: string | null) => void
  [WebContentsEmitterNames.WILL_NAVIGATE]: () => void
  [WebContentsEmitterNames.DID_NAVIGATE]: () => void
  [WebContentsEmitterNames.DID_NAVIGATE_IN_PAGE]: () => void
  [WebContentsEmitterNames.DOM_READY]: () => void
  [WebContentsEmitterNames.FOUND_IN_PAGE]: (
    result: WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE]
  ) => void
  [WebContentsEmitterNames.KEYDOWN]: (
    event: WebViewSendEvents[WebViewEventSendNames.KeyDown]
  ) => void
  [WebContentsEmitterNames.PRELOAD_EVENT]: <T extends keyof WebViewSendEvents>(
    type: T,
    payload: WebViewSendEvents[T]
  ) => void
}

export enum ViewManagerEmitterNames {
  CREATED = 'created',
  DELETED = 'deleted',
  ACTIVATED = 'activated',
  SHOW_VIEWS = 'show-views',
  HIDE_VIEWS = 'hide-views',
  NEW_WINDOW_REQUEST = 'new-window-request',
  WINDOW_RESIZE = 'window-resize',
  SIDEBAR_CHANGE = 'sidebar-change'
}

export type ViewManagerEmitterEvents = {
  [ViewManagerEmitterNames.CREATED]: (view: WebContents) => void
  [ViewManagerEmitterNames.DELETED]: (viewId: string) => void
  [ViewManagerEmitterNames.ACTIVATED]: (view: WebContents) => void
  [ViewManagerEmitterNames.SHOW_VIEWS]: () => void
  [ViewManagerEmitterNames.HIDE_VIEWS]: () => void
  [ViewManagerEmitterNames.NEW_WINDOW_REQUEST]: (details: NewWindowRequest) => void
  [ViewManagerEmitterNames.WINDOW_RESIZE]: () => void
  [ViewManagerEmitterNames.SIDEBAR_CHANGE]: (isOpen: boolean, view?: WebContentsView) => void
}

export type BookmarkPageOpts = {
  freshWebview?: boolean
  silent?: boolean
  createdForChat?: boolean
}

export { ViewType, type ViewTypeData } from '@deta/types'
