export type DropdownItemSeparator = {
    type: 'separator'
}

export type DropdownItemAction = {
    id: string
    label: string
    icon?: string
    disabled?: boolean
    disabledLabel?: string
    checked?: boolean
    type?: 'default' | 'checkbox' | 'separator'
    description?: string
    subItems?: DropdownItem[]
    action?: () => void
}

export type DropdownItem = DropdownItemAction | DropdownItemSeparator