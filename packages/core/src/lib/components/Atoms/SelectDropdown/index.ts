import type { Icons } from '@horizon/icons'

export type SelectItem = {
  id: string
  label: string
  disabled?: boolean
  icon?: Icons | string
  description?: string
  descriptionIcon?: Icons | string
  data: any
}

export { default as SelectDropdown } from './SelectDropdown.svelte'
export { default as SelectDropdownItem } from './SelectDropdownItem.svelte'
