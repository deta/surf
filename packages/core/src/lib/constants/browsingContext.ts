import type { SelectItem } from '../components/Atoms/SelectDropdown/index'

export const generalContext = {
  id: 'default',
  label: 'Home',
  icon: 'circle-dot',
  data: null
} satisfies SelectItem

export const newContext = {
  id: 'new',
  label: 'Create New Context',
  icon: 'add',
  data: null
} satisfies SelectItem
