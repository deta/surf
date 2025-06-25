import type { Rectangle } from 'electron'

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
  additionalArguments?: string[]
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

export type WebContentsViewAction = {
  [K in WebContentsViewActionType]: WebContentsViewActionTyped<K>
}[WebContentsViewActionType]

export enum WebContentsViewEventType {
  DID_FINISH_LOAD = 'did-finish-load',
  DID_FAIL_LOAD = 'did-fail-load'
}

export interface WebContentsViewEventPayloads {
  [WebContentsViewEventType.DID_FINISH_LOAD]: void
  [WebContentsViewEventType.DID_FAIL_LOAD]: {
    errorCode: number
    errorDescription: string
    validatedURL: string
  }
}

export type WebContentsViewEventTyped<T extends WebContentsViewEventType> = {
  type: T
  payload: WebContentsViewEventPayloads[T]
}

export type WebContentsViewEvent = {
  [K in WebContentsViewEventType]: WebContentsViewEventTyped<K>
}[WebContentsViewEventType]
