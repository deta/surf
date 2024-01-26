import { generateID } from "../utils/id"


export class LocalStorage<T> {
    key: string
    constructor(key: string) {
        this.key = key
    }

    getRaw(): string | null {
        return localStorage.getItem(this.key)
    }

    setRaw(value: string) {
        localStorage.setItem(this.key, value)
    }

    get(): T | null {
        const raw = this.getRaw()
        if (raw === null) return null
        return JSON.parse(raw) as T
    }

    set(value: T) {
        this.setRaw(JSON.stringify(value))
    }
}

export class Storage<T extends Record<string, any>> {
    items: T[]
    storage: LocalStorage<T[]>
    constructor(namespace: string) {
        this.storage = new LocalStorage<T[]>(namespace)
        this.items = this.load() ?? []
    }

    load() {
        const items = this.storage.get()
        if (items === null) return

        return items
    }

    add(value: T) {
        const id = generateID()
        const item = { id, ...value }

        this.items.push(item)
        this.storage.set(this.items)

        return item
    }

    get(id: string) {
        return this.items.find((i) => i.id === id)
    }

    update(id: string, value: Partial<T>) {
        const item = this.items.find((i) => i.id === id)
        if (!item) return

        Object.assign(item, value)
        this.storage.set(this.items)

        return item
    }

    remove(id: string) {
        this.items = this.items.filter((i) => i.id !== id)
        this.storage.set(this.items)
    }

    list() {
        return this.items
    }
}
