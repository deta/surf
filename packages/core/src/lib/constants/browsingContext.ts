import type { SelectItem } from '../components/Atoms/SelectDropdown/index'

export const newContext = {
  id: 'new',
  label: 'Create New Context',
  icon: 'add',
  data: null
} satisfies SelectItem

export const configureBrowsingContext = {
  id: 'configure',
  label: 'Configure',
  icon: 'settings',
  data: 'configure-browsing-contexts'
} satisfies SelectItem
