import type { SelectItem } from '../components/Atoms/SelectDropdown.svelte'

export const generalContext = {
  id: 'default',
  label: 'General Browsing',
  icon: 'circle-dot',
  data: null
} satisfies SelectItem

export const newContext = {
  id: 'new',
  label: 'Create New Space',
  icon: 'add',
  data: null
} satisfies SelectItem
