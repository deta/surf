import type { Icons } from '@deta/icons'

export type SelectItem = {
  id: string
  label: string
  disabled?: boolean
  icon?: Icons | string
  description?: string
  descriptionIcon?: Icons | string
  iconUrl?: string
  kind?: 'default' | 'danger'
  topSeparator?: boolean
  bottomSeparator?: boolean
  data: any
}

export { default as SelectDropdown } from './SelectDropdown.svelte'
export { default as SelectDropdownItem } from './SelectDropdownItem.svelte'
