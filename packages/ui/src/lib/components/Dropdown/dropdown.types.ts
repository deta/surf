export type DropdownItemSeparator = {
    type: 'separator'
}

export type DropdownItemTitle = {
    type: 'title'
    label: string
}

export type DropdownItemAction = {
    id: string
    label: string
    icon?: string
    disabled?: boolean
    disabledLabel?: string
    checked?: boolean
    type?: 'default' | 'checkbox' | 'separator' | 'title'
    description?: string
    subItems?: DropdownItem[]
    bottomSeparator?: boolean
    topSeparator?: boolean
    rightLabel?: string
    rightIcon?: string
    action?: () => void
    data?: any
}

export type DropdownItem = DropdownItemAction | DropdownItemSeparator | DropdownItemTitle