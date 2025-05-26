import type { SelectItem } from '../components/Atoms/SelectDropdown/index'

export type BuiltInContext = {
  id: string
  label: string
  description: string
  icon: string
}

export const newContext = {
  id: 'new',
  label: 'Create New Context',
  icon: 'add',
  data: null
} satisfies SelectItem

export const everythingContext = {
  id: 'all',
  label: 'All my Stuff',
  icon: 'save',
  description: "Everything you've collected in one place"
} satisfies BuiltInContext

export const inboxContext = {
  id: 'inbox',
  label: 'Inbox',
  icon: 'circle-dot',
  description: 'Your recent saves waiting to be organized into contexts'
} satisfies BuiltInContext

export const notesContext = {
  id: 'notes',
  label: 'Notes',
  icon: 'docs',
  description: 'All your notes in one place'
} satisfies BuiltInContext
