import type { IconData } from '@deta/icons'

export interface NotebookSpace {
  id: string
  name: NotebookData
  created_at: string
  updated_at: string
  deleted: number
}

export interface NotebookData {
  name: string
  description: string
  icon: IconData
  index: number
}

export const NotebookEntryOrigin = {
  Blacklisted: 2,
  ManuallyAdded: 1,
  LlmQuery: 0
} as const

export type NotebookEntryOrigin = (typeof NotebookEntryOrigin)[keyof typeof NotebookEntryOrigin]

export interface NotebookEntry {
  id: string
  space_id: string
  entry_id: string
  entry_type: string
  resource_type?: string
  created_at: string
  updated_at: string
  manually_added: number
}

export const NotebookDefaults = {
  NOTE_DEFAULT_NAME: 'Untitled Note'
} as const
