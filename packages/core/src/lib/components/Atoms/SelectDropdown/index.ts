import type { Icons } from '@horizon/icons'

export type SelectItem = {
  id: string
  label: string
  icon?: Icons
  data: any
}

export { default as SelectDropdown } from './SelectDropdown.svelte'
export { default as SelectDropdownItem } from './SelectDropdownItem.svelte'
