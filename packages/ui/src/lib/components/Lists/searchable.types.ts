export type SearchableItem<T extends any> = {
    id: string
    icon?: string
    label: string
    data: T
}