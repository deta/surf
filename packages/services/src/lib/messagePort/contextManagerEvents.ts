import type { MentionItem } from '@deta/editor'
import type { ChatPrompt, SearchResultLink } from '@deta/types'

export type GeneratePromptsPayload = {
  mentions?: MentionItem[]
  text?: string
}

export enum WebContentsViewContextManagerActionType {
  GET_ITEMS = 'get-items',
  ADD_TABS_CONTEXT = 'add-tabs-context',
  ADD_WEB_SEARCH_CONTEXT = 'add-web-search-context',
  ADD_TAB_CONTEXT = 'add-tab-context',
  ADD_ACTIVE_TAB_CONTEXT = 'add-active-tab-context',
  ADD_RESOURCE_CONTEXT = 'add-resource-context',
  ADD_NOTEBOOK_CONTEXT = 'add-notebook-context',
  REMOVE_CONTEXT_ITEM = 'remove-context-item',
  CLEAR_ALL_CONTEXT = 'clear-all-context',
  GENERATE_PROMPTS = 'generate-prompts'
}

export interface WebContentsViewContextManagerActionPayloads {
  [WebContentsViewContextManagerActionType.GET_ITEMS]: { prompt: string } | undefined
  [WebContentsViewContextManagerActionType.ADD_TABS_CONTEXT]: undefined
  [WebContentsViewContextManagerActionType.ADD_WEB_SEARCH_CONTEXT]: { results: SearchResultLink[] }
  [WebContentsViewContextManagerActionType.ADD_TAB_CONTEXT]: { id: string }
  [WebContentsViewContextManagerActionType.ADD_ACTIVE_TAB_CONTEXT]: undefined
  [WebContentsViewContextManagerActionType.ADD_RESOURCE_CONTEXT]: { id: string }
  [WebContentsViewContextManagerActionType.ADD_NOTEBOOK_CONTEXT]: { id: string }
  [WebContentsViewContextManagerActionType.REMOVE_CONTEXT_ITEM]: { id: string }
  [WebContentsViewContextManagerActionType.CLEAR_ALL_CONTEXT]: undefined
  [WebContentsViewContextManagerActionType.GENERATE_PROMPTS]: GeneratePromptsPayload | undefined
}

export interface WebContentsViewContextManagerActionOutputs {
  [WebContentsViewContextManagerActionType.GET_ITEMS]: {
    resources: string[]
    inlineImages: string[]
  } | null
  [WebContentsViewContextManagerActionType.ADD_TABS_CONTEXT]: null
  [WebContentsViewContextManagerActionType.ADD_WEB_SEARCH_CONTEXT]: null
  [WebContentsViewContextManagerActionType.ADD_TAB_CONTEXT]: null
  [WebContentsViewContextManagerActionType.ADD_ACTIVE_TAB_CONTEXT]: null
  [WebContentsViewContextManagerActionType.ADD_RESOURCE_CONTEXT]: null
  [WebContentsViewContextManagerActionType.ADD_NOTEBOOK_CONTEXT]: null
  [WebContentsViewContextManagerActionType.REMOVE_CONTEXT_ITEM]: null
  [WebContentsViewContextManagerActionType.CLEAR_ALL_CONTEXT]: null
  [WebContentsViewContextManagerActionType.GENERATE_PROMPTS]: ChatPrompt[]
}

export type WebContentsViewActionTyped<T extends string, P extends Record<T, any>> = {
  type: T
} & (P[T] extends undefined ? { payload?: P[T] } : { payload: P[T] })
