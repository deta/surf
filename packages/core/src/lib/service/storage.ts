import { generateID } from '../utils/id'
import Dexie from 'dexie'

import { type HorizonData } from './horizon'
import { type Card, type Resource } from '../types'

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

export class HorizonStore<T extends { id: string }> {
  constructor(public t: Dexie.Table<T, string>) {}

  async create(item: T): Promise<string> {
    item.id = generateID()
    await this.t.add(item as T)
    return item.id
  }

  async all(): Promise<T[]> {
    return await this.t.toArray()
  }

  async read(id: string): Promise<T | undefined> {
    return await this.t.get(id)
  }

  async update(id: string, updatedItem: Partial<T>): Promise<number> {
    return await this.t.update(id, updatedItem)
  }

  async delete(id: string): Promise<void> {
    await this.t.delete(id)
  }
}

export class HorizonDatabase extends Dexie {
  cards: HorizonStore<Card>
  horizons: HorizonStore<HorizonData>
  resources: HorizonStore<Resource>

  constructor() {
    super('HorizonDatabase')

    this.version(1).stores({
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, isDefault, createdAt, updatedAt',
      resources: 'id'
    })

    this.cards = new HorizonStore<Card>(this.table('cards'))
    this.horizons = new HorizonStore<HorizonData>(this.table('horizons'))
    this.resources = new HorizonStore<Resource>(this.table('resources'))
  }

  async getCardsByHorizonId(horizonId: string) {
    return await this.cards.t.where({ horizon_id: horizonId }).toArray()
  }
}
