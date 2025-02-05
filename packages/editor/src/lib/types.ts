import type { Range } from '@tiptap/core'

export type EditorAutocompleteEvent = {
  query: string
  mentions?: MentionItem[]
}

export enum MentionItemType {
  BUILT_IN = 'built-in',
  CONTEXT = 'context',
  MODEL = 'model',
  OTHER = 'other'
}

export type MentionItem<T = any> = {
  id: string
  label: string
  suggestionLabel?: string
  aliases?: string[]
  icon?: string
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
