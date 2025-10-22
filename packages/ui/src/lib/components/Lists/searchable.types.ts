export type SearchableItem<T = any> = {
    id: string
    icon?: string
    label: string
    data: T
}