import type { Range } from '@tiptap/core'

export type EditorAutocompleteEvent = {
  query: string
  mentions?: MentionItem[]
}

export enum MentionItemType {
  BUILT_IN = 'built-in',
  CONTEXT = 'context',
  RESOURCE = 'resource',
  NOTEBOOK = 'notebook',
  ALL_TABS = 'all-tabs',
  ACTIVE_TAB = 'active-tab',
  MODEL = 'model',
  OTHER = 'other',
  TAB = 'tab'
}

export type MentionItem<T = any> = {
  id: string
  label: string
  suggestionLabel?: string
  aliases?: string[]
  icon?: string
  faviconURL?: string
  data?: T
  type?: MentionItemType
  hideInRoot?: boolean
  hideInSearch?: boolean
}

export type EditorRewriteEvent = {
  prompt: string
  text: string
  range: Range
  mentions?: MentionItem[]
}

export type EditorSimilaritiesSearchEvent = {
  text: string
  range: Range
  loading: boolean
}

export type LinkItemsFetcher = (query: string) => Promise<MentionItem[]>
