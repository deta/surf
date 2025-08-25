import type {
  WebContentsError,
  WebContentsViewData,
  WebContentsViewEvents,
  WebContentsViewEventType,
  WebViewEventSendNames,
  WebViewSendEvents,
} from "@deta/types";
import type { WebContents } from "./webContentsView.svelte";
import type { NewWindowRequest } from "../ipc";

export enum WebContentsViewEmitterNames {
  MOUNTED = "mounted",
  DESTROYED = "destroyed",
  DATA_CHANGED = "data-changed",
}

export type WebContentsViewEmitterEvents = {
  [WebContentsViewEmitterNames.MOUNTED]: (webContentsView: WebContents) => void;
  [WebContentsViewEmitterNames.DESTROYED]: () => void;
  [WebContentsViewEmitterNames.DATA_CHANGED]: (
    data: WebContentsViewData,
  ) => void;
};

export enum WebContentsEmitterNames {
  LOADING_CHANGED = "loading-changed",
  PAGE_TITLE_UPDATED = "page-title-updated",
  PAGE_FAVICON_UPDATED = "page-favicon-updated",
  NAVIGATED = "navigated",
  MEDIA_PLAYBACK_CHANGED = "media-playback-changed",
  FULLSCREEN_CHANGED = "fullscreen-changed",
  FOCUS_CHANGED = "focus-changed",
  HOVER_TARGET_URL_CHANGED = "hover-target-url-changed",
  FOUND_IN_PAGE = "found-in-page",
  KEYDOWN = "keydown",
  PRELOAD_EVENT = "preload-event",
}

export type WebContentsEmitterEvents = {
  [WebContentsEmitterNames.LOADING_CHANGED]: (
    isLoading: boolean,
    error: WebContentsError | null,
  ) => void;
  [WebContentsEmitterNames.PAGE_TITLE_UPDATED]: (
    newTitle: string,
    oldTitle: string,
  ) => void;
  [WebContentsEmitterNames.PAGE_FAVICON_UPDATED]: (
    newFaviconUrl: string,
    oldFaviconUrl: string,
  ) => void;
  [WebContentsEmitterNames.NAVIGATED]: (
    newUrl: string,
    oldUrl: string,
    isProgrammatic: boolean,
  ) => void;
  [WebContentsEmitterNames.MEDIA_PLAYBACK_CHANGED]: (
    isPlaying: boolean,
  ) => void;
  [WebContentsEmitterNames.FULLSCREEN_CHANGED]: (isFullScreen: boolean) => void;
  [WebContentsEmitterNames.FOCUS_CHANGED]: (isFocused: boolean) => void;
  [WebContentsEmitterNames.HOVER_TARGET_URL_CHANGED]: (
    url: string | null,
  ) => void;
  [WebContentsEmitterNames.FOUND_IN_PAGE]: (
    result: WebContentsViewEvents[WebContentsViewEventType.FOUND_IN_PAGE],
  ) => void;
  [WebContentsEmitterNames.KEYDOWN]: (
    event: WebViewSendEvents[WebViewEventSendNames.KeyDown],
  ) => void;
  [WebContentsEmitterNames.PRELOAD_EVENT]: <T extends keyof WebViewSendEvents>(
    type: T,
    payload: WebViewSendEvents[T],
  ) => void;
};

export enum ViewManagerEmitterNames {
  CREATED = "created",
  DELETED = "deleted",
  ACTIVATED = "activated",
  SHOW_VIEWS = "show-views",
  HIDE_VIEWS = "hide-views",
  NEW_WINDOW_REQUEST = "new-window-request",
}

export type ViewManagerEmitterEvents = {
  [ViewManagerEmitterNames.CREATED]: (view: WebContents) => void;
  [ViewManagerEmitterNames.DELETED]: (viewId: string) => void;
  [ViewManagerEmitterNames.ACTIVATED]: (view: WebContents) => void;
  [ViewManagerEmitterNames.SHOW_VIEWS]: () => void;
  [ViewManagerEmitterNames.HIDE_VIEWS]: () => void;
  [ViewManagerEmitterNames.NEW_WINDOW_REQUEST]: (
    details: NewWindowRequest,
  ) => void;
};
