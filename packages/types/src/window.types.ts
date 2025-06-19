import type { Rectangle } from 'electron'

export type SettingsWindowTab = 'general' | 'ai' | 'appearance' | 'advanced' | 'extensions'

export type WebContentsViewCreateOptions = {
  id?: string
  partition: string
  url?: string
  bounds?: Rectangle
}

export enum WebContentsViewActionType {
  ACTIVATE = 'activate',
  HIDE = 'hide',
  DESTROY = 'destroy',
  RELOAD = 'reload',
  GO_FORWARD = 'go-forward',
  GO_BACK = 'go-back',
  SET_BOUNDS = 'set-bounds',
  LOAD_URL = 'load-url',
  HIDE_ALL = 'hide-all',
  SHOW_ACTIVE = 'show-active'
}

export interface WebContentsViewActionPayloads {
  [WebContentsViewActionType.ACTIVATE]: void
  [WebContentsViewActionType.DESTROY]: void
  [WebContentsViewActionType.HIDE]: void
  [WebContentsViewActionType.RELOAD]: { ignoreCache?: boolean }
  [WebContentsViewActionType.GO_FORWARD]: void
  [WebContentsViewActionType.GO_BACK]: void
  [WebContentsViewActionType.SET_BOUNDS]: { bounds: Rectangle }
  [WebContentsViewActionType.LOAD_URL]: { url: string }
  [WebContentsViewActionType.HIDE_ALL]: void
  [WebContentsViewActionType.SHOW_ACTIVE]: void
}

export type WebContentsViewActionTyped<T extends WebContentsViewActionType> = {
  type: T
  payload: WebContentsViewActionPayloads[T]
}

export type WebContentsViewAction =
  | WebContentsViewActionTyped<WebContentsViewActionType.ACTIVATE>
  | WebContentsViewActionTyped<WebContentsViewActionType.DESTROY>
  | WebContentsViewActionTyped<WebContentsViewActionType.HIDE>
  | WebContentsViewActionTyped<WebContentsViewActionType.RELOAD>
  | WebContentsViewActionTyped<WebContentsViewActionType.GO_FORWARD>
  | WebContentsViewActionTyped<WebContentsViewActionType.GO_BACK>
  | WebContentsViewActionTyped<WebContentsViewActionType.SET_BOUNDS>
  | WebContentsViewActionTyped<WebContentsViewActionType.LOAD_URL>
  | WebContentsViewActionTyped<WebContentsViewActionType.HIDE_ALL>
  | WebContentsViewActionTyped<WebContentsViewActionType.SHOW_ACTIVE>
